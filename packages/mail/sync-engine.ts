import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq, or, and, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { MailProvider, RemoteMessage } from './provider';
import { OutreachService } from '../services/outreach.service';
import { LoggerService } from '../services/logger.service';

export class SyncEngine {
  private provider: MailProvider;
  private accountId: string;

  constructor(provider: MailProvider, accountId: string) {
    this.provider = provider;
    this.accountId = accountId;
  }

  async runSync(): Promise<void> {
    // 1. Get sync checkpoint
    let syncState = await db.select().from(schema.mailSyncState).where(eq(schema.mailSyncState.accountId, this.accountId)).limit(1).then(res => res[0]);
    if (!syncState) {
      await db.insert(schema.mailSyncState).values({
        id: uuidv4(),
        accountId: this.accountId,
        syncStatus: 'syncing',
        updatedAt: new Date(),
      });
      syncState = await db.select().from(schema.mailSyncState).where(eq(schema.mailSyncState.accountId, this.accountId)).limit(1).then(res => res[0]);
    } else {
      await db.update(schema.mailSyncState).set({ syncStatus: 'syncing', updatedAt: new Date() }).where(eq(schema.mailSyncState.id, syncState.id));
    }

    try {
      await LoggerService.logNotebookEntry('account', this.accountId, 'sync_started', `Started mail sync loop`, { actorType: 'system', actorName: 'SyncEngine' });

      // 2. Poll the provider for Delta
      const delta = await this.provider.syncDelta(syncState.lastHistoryId || null);

      // 3. Upsert mailboxes
      for (const rawBox of delta.addedMailboxes) {
        const existingPath = await db.select().from(schema.mailboxes)
          .where(and(eq(schema.mailboxes.accountId, this.accountId), eq(schema.mailboxes.providerId, rawBox.providerId)))
          .limit(1).then(res => res[0]);
        
        if (!existingPath) {
          await db.insert(schema.mailboxes).values({
            id: uuidv4(),
            accountId: this.accountId,
            name: rawBox.name,
            providerId: rawBox.providerId,
            createdAt: new Date(),
          });
        }
      }

      // Pre-load all mailboxes to resolve inbox mappings
      const allMailboxes = await db.select().from(schema.mailboxes).where(eq(schema.mailboxes.accountId, this.accountId));
      const providerIdToBoxId = new Map(allMailboxes.map(m => [m.providerId!, m.id]));

      // 4. Process added/changed messages
      for (const rm of delta.addedMessages) {
        await this.upsertMessage(rm, providerIdToBoxId);
      }

      // 5. Update checkpoint
      await db.update(schema.mailSyncState).set({
        lastSyncedAt: new Date(),
        lastHistoryId: delta.lastHistoryId,
        syncStatus: 'idle',
        errorMessage: null,
        updatedAt: new Date(),
      }).where(eq(schema.mailSyncState.id, syncState.id));
      
      await LoggerService.logNotebookEntry('account', this.accountId, 'sync_completed', `Sync cycle completed: ${delta.addedMessages.length} fresh messages`, { actorType: 'system', actorName: 'SyncEngine', metadataJson: { addedMessagesLimit: delta.addedMessages.length } });

    } catch (e: any) {
      console.error('Sync error:', e);
      await db.update(schema.mailSyncState).set({
        syncStatus: 'error',
        errorMessage: e.message || 'Unknown sync error',
        updatedAt: new Date(),
      }).where(eq(schema.mailSyncState.id, syncState.id));
      await LoggerService.logNotebookEntry('account', this.accountId, 'sync_error', `Sync failed: ${e.message}`, { actorType: 'system', actorName: 'SyncEngine', metadataJson: { error: e.message } });
    }
  }

  private async upsertMessage(rm: RemoteMessage, mailboxMap: Map<string, string>) {
    // Look up existing message by providerId
    const existing = await db.select().from(schema.messages).where(eq(schema.messages.providerId, rm.providerId)).limit(1).then(r => r[0]);

    const primaryBoxId = rm.mailboxProviderIds.length > 0 ? mailboxMap.get(rm.mailboxProviderIds[0]) : null;

    if (existing) {
      // Update read state, mailboxes
      await db.update(schema.messages).set({
        readState: rm.readState,
        mailboxId: primaryBoxId || existing.mailboxId,
      }).where(eq(schema.messages.id, existing.id));
      return;
    }

    // Determine thread ID securely using JWZ approximations
    let targetThreadId: string | null = null;

    if (rm.inReplyTo || rm.referencesHeader) {
      // Find parent message by remoteMessageId
      const refs = [rm.inReplyTo, ...((rm.referencesHeader || '').split(' '))].filter(Boolean);
      for (const ref of refs) {
        if (!ref) continue;
        const parent = await db.select().from(schema.messages).where(eq(schema.messages.remoteMessageId, ref)).limit(1).then(r => r[0]);
        if (parent && parent.threadId) {
          targetThreadId = parent.threadId;
          break;
        }
      }
    }

    if (!targetThreadId) {
      // Create new thread
      targetThreadId = uuidv4();
      await db.insert(schema.threads).values({
        id: targetThreadId,
        subject: rm.subject,
        status: 'active',
        createdAt: rm.receivedAt,
        updatedAt: rm.receivedAt,
      });
      await LoggerService.logNotebookEntry('thread', targetThreadId, 'created', `New thread started: ${rm.subject}`, { actorType: 'system', actorName: 'SyncEngine' });
    } else {
      // Elevate thread updated timestamp
      await db.update(schema.threads).set({
        updatedAt: rm.receivedAt > new Date() ? rm.receivedAt : new Date()
      }).where(eq(schema.threads.id, targetThreadId));
    }

    // Insert new message securely
    const newMessageId = uuidv4();
    await db.insert(schema.messages).values({
      id: newMessageId,
      providerId: rm.providerId,
      threadId: targetThreadId,
      mailboxId: primaryBoxId,
      from: rm.from,
      to: rm.to,
      cc: rm.cc || null,
      bcc: rm.bcc || null,
      subject: rm.subject,
      snippet: rm.snippet,
      plainTextBody: rm.plainTextBody,
      htmlBody: rm.htmlBody || null,
      receivedAt: rm.receivedAt,
      readState: rm.readState,
      remoteMessageId: rm.remoteMessageId,
      inReplyTo: rm.inReplyTo || null,
      referencesHeader: rm.referencesHeader || null,
    });
    
    await LoggerService.logNotebookEntry('message', newMessageId, 'ingested', `Message ingested: ${rm.subject}`, { actorType: 'system', actorName: 'SyncEngine', parentEntityType: 'thread', parentEntityId: targetThreadId, metadataJson: { from: rm.from } });
  }

  async sendDraft(draftId: string): Promise<void> {
    const draft = await db.select().from(schema.drafts).where(eq(schema.drafts.id, draftId)).limit(1).then(r => r[0]);
    if (!draft || draft.status !== 'approved' || draft.sentAt) return; // Only process approved drafts

    const contact = draft.contactId ? await db.select().from(schema.contacts).where(eq(schema.contacts.id, draft.contactId)).limit(1).then(r => r[0]) : null;
    if (!contact) {
      await db.update(schema.drafts).set({ reviewQueueState: 'rejected', blockedReason: 'No resolved contact email to dispatch to.', updatedAt: new Date() }).where(eq(schema.drafts.id, draft.id));
      return;
    }

    // Grab threading headers if it links to an Inbox Thread
    let inReplyTo = '';
    let references = '';
    if (draft.linkedInboxThreadId) {
      const msgs = await db.select().from(schema.messages).where(eq(schema.messages.threadId, draft.linkedInboxThreadId!));
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        inReplyTo = lastMsg.remoteMessageId || '';
        const existingRefs = lastMsg.referencesHeader || lastMsg.remoteMessageId || '';
        references = existingRefs + (inReplyTo ? ` ${inReplyTo}` : '');
      }
    }

    const { success, providerId } = await this.provider.sendDraft({
      to: contact.email || contact.name,
      subject: draft.subject || '',
      body: draft.body || '',
      inReplyTo,
      references
    });

    if (success) {
      // Delegate status transition through the service — not inline mutations
      await OutreachService.markDraftSent(draftId);
      // Re-trigger sync to pull the newly sent message into the local cache immediately
      await this.runSync();
    } else {
      await OutreachService.markDraftRejected(draftId, 'Provider rejected draft dispatch');
    }
  }
}
