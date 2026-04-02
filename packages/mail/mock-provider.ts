import { MailProvider, SyncDelta, RemoteMessage, Mailbox } from './provider';
import { v4 as uuidv4 } from 'uuid';

export class MockMailProvider implements MailProvider {
  private email: string;
  private currentHistoryId: number = 1000;
  
  // In-memory stable storage of what a remote provider would hold
  private mailboxes: Mailbox[] = [
    { providerId: 'INBOX', name: 'Inbox' },
    { providerId: 'SENT', name: 'Sent Mail' },
  ];
  
  private messages: RemoteMessage[] = [];

  constructor(email: string) {
    this.email = email;
  }

  async initialize(credentialsJSON: string): Promise<void> {
    // Generate some initial fake emails with proper standard IDs
    this.messages.push({
      providerId: `msg-${uuidv4()}`,
      mailboxProviderIds: ['INBOX'],
      from: 'founder@acme.com',
      to: this.email,
      subject: 'Interested in your product',
      snippet: 'Hi, we are looking for a solution',
      plainTextBody: 'Hi, we are looking for a solution to our problem. Can we chat?',
      receivedAt: new Date(),
      readState: false,
      remoteMessageId: '<1234.acmecorp@mail.com>',
    });
    
    this.messages.push({
      providerId: `msg-${uuidv4()}`,
      mailboxProviderIds: ['INBOX'],
      from: 'investor@bigfund.com',
      to: this.email,
      subject: 'Re: Follow up',
      snippet: 'Thanks for the deck',
      plainTextBody: 'Thanks for the deck, let us schedule a call.',
      receivedAt: new Date(Date.now() - 86400000),
      readState: true,
      remoteMessageId: '<4567.bigfund@mail.com>',
      inReplyTo: '<deck.sent@internal.com>',
      referencesHeader: '<deck.sent@internal.com>',
    });
  }

  async syncDelta(sinceHistoryId: string | null): Promise<SyncDelta> {
    // A real implementation would filter by sinceHistoryId
    // For the mock, if since is null, return everything. Otherwise return nothing for now.
    if (!sinceHistoryId) {
      this.currentHistoryId++;
      return {
        lastHistoryId: this.currentHistoryId.toString(),
        addedMessages: this.messages,
        removedMessageIds: [],
        addedMailboxes: this.mailboxes
      };
    }

    return {
      lastHistoryId: this.currentHistoryId.toString(),
      addedMessages: [],
      removedMessageIds: [],
      addedMailboxes: []
    };
  }

  async sendDraft(params: { to: string; subject: string; body: string; inReplyTo?: string; references?: string }): Promise<{ success: boolean; error?: string; providerId?: string }> {
    const providerId = `msg-${uuidv4()}`;
    const remoteId = `<${uuidv4()}@internal.com>`;
    
    this.messages.push({
      providerId,
      mailboxProviderIds: ['SENT'],
      from: this.email,
      to: params.to,
      subject: params.subject,
      snippet: params.body.substring(0, 50),
      plainTextBody: params.body,
      receivedAt: new Date(),
      readState: true,
      remoteMessageId: remoteId,
      inReplyTo: params.inReplyTo,
      referencesHeader: params.references,
    });
    
    this.currentHistoryId++;
    return { success: true, providerId };
  }

  async modifyLabels(providerMessageId: string, addMailboxIds: string[], removeMailboxIds: string[]): Promise<void> {
    const msg = this.messages.find(m => m.providerId === providerMessageId);
    if (!msg) return;
    
    // Apply removals
    msg.mailboxProviderIds = msg.mailboxProviderIds.filter(id => !removeMailboxIds.includes(id));
    
    // Apply additions
    for (const id of addMailboxIds) {
      if (!msg.mailboxProviderIds.includes(id)) {
        msg.mailboxProviderIds.push(id);
      }
    }
    
    this.currentHistoryId++;
  }
}
