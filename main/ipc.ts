import { ipcMain, WebContents } from 'electron';
import { BrowserManager } from './browser-manager';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { SyncEngine } from '../packages/mail/sync-engine';
import { MockMailProvider } from '../packages/mail/mock-provider';

// Domain Services
import { CrmService } from '../packages/services/crm.service';
import { InboxService } from '../packages/services/inbox.service';
import { TaskService } from '../packages/services/task.service';
import { OutreachService } from '../packages/services/outreach.service';
import { EvidenceService } from '../packages/services/evidence.service';
import { LinkService } from '../packages/services/link.service';
import { LoggerService } from '../packages/services/logger.service';
import { BrowserRunService } from '../packages/services/browser-run.service';
import { TrainingService } from '../packages/services/training.service';
import { CommandResult } from '../packages/shared/command';
import { BrowserOrchestrator } from './browser-orchestrator';

// Repositories
import { CrmRepository } from '../packages/repositories/crm.repository';
import { InboxRepository } from '../packages/repositories/inbox.repository';
import { TaskRepository } from '../packages/repositories/task.repository';
import { OutreachRepository } from '../packages/repositories/outreach.repository';
import { EvidenceRepository } from '../packages/repositories/evidence.repository';
import { NotebookRepository } from '../packages/repositories/notebook.repository';
import { GraphRepository } from '../packages/repositories/graph.repository';
import { SiteProfileRepository } from '../packages/repositories/site-profile.repository';

interface LogConfig {
  entityType?: string;
  entityId?: string | ((data: any) => string);
  entryType: string;
  message: string | ((data: any) => string);
  parentEntityType?: string;
  parentEntityId?: string | ((data: any) => string);
}

// Every IPC handler returns a CommandResult envelope so the renderer and agents
// can distinguish success from failure without catching exceptions.
async function handle<T>(
  fn: () => Promise<T>,
  log?: LogConfig
): Promise<CommandResult<T>> {
  try {
    const result = await fn();
    let commandResult: CommandResult<T>;

    // If the service already returned a CommandResult, forward it
    if (result !== null && typeof result === 'object' && 'ok' in (result as any)) {
      commandResult = result as any;
    } else {
      commandResult = { ok: true, data: result } as any;
    }

    // Systemic Forensic Logging
    if (commandResult.ok && log) {
      const entityId = typeof log.entityId === 'function' ? log.entityId(commandResult.data) : log.entityId;
      const message = typeof log.message === 'function' ? log.message(commandResult.data) : log.message;
      const parentEntityId = typeof log.parentEntityId === 'function' ? log.parentEntityId(commandResult.data) : log.parentEntityId;

      if (entityId) {
        await LoggerService.logNotebookEntry(
          log.entityType || 'system',
          entityId,
          log.entryType,
          message,
          {
            parentEntityType: log.parentEntityType,
            parentEntityId: parentEntityId,
            actorType: 'human'
          }
        );
      }
    }

    return commandResult;
  } catch (e: any) {
    console.error('[IPC Error]', e);
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'Unknown error' } };
  }
}

export function setupIpcHandlers(
  uiWebContents: WebContents,
  browserManager: BrowserManager,
  orchestrator?: BrowserOrchestrator
) {

  // ─── Sync Engine Init ────────────────────────────────────────────────────────
  let syncEngine: SyncEngine | null = null;
  db.select().from(schema.mailAccounts).limit(1).then(([acc]) => {
    if (acc) {
      const provider = new MockMailProvider(acc.email);
      syncEngine = new SyncEngine(provider, acc.id);
    }
  }).catch(console.error);

  // ─── Browser IPC ─────────────────────────────────────────────────────────────
  ipcMain.handle('browser:createTab', async (e, partition, url) => handle(async () => {
    // 1. Sanitize partition string and enforce user- prefix
    const safePartition = `user-${String(partition).replace(/[^a-z0-9-]/gi, '') || 'default'}`;

    // 2. Validate URL scheme
    try {
      const parsed = new URL(url);
      if (!['https:', 'http:'].includes(parsed.protocol)) {
        throw new Error('Disallowed URL scheme');
      }
    } catch {
      throw new Error('URL must be http:// or https://');
    }

    return browserManager.createTab(safePartition, url);
  }));

  ipcMain.handle('browser:switchTab', async (e, id) => handle(() => browserManager.switchTab(id)));
  ipcMain.handle('browser:closeTab', async (e, id) => handle(() => browserManager.closeTab(id)));
  ipcMain.handle('browser:hide', () => browserManager.hideActiveTab());
  ipcMain.handle('browser:setBounds', (e, bounds) => browserManager.setBounds(bounds));
  ipcMain.handle('browser:navigate', async (e, id, url) => handle(async () => {
    try {
      const parsed = new URL(url);
      if (!['https:', 'http:'].includes(parsed.protocol)) {
        throw new Error('Disallowed URL scheme');
      }
    } catch {
      throw new Error('URL must be http:// or https://');
    }
    return browserManager.navigate(id, url);
  }));
  ipcMain.handle('browser:goBack', (e, id) => browserManager.goBack(id));
  ipcMain.handle('browser:goForward', (e, id) => browserManager.goForward(id));
  ipcMain.handle('browser:reload', (e, id) => browserManager.reload(id));
  ipcMain.handle('browser:getState', async () => browserManager.getState());
  ipcMain.handle('browser:getTabContext', async (e, tabId: string) => handle(async () => {
    const [tab] = await db.select().from(schema.browserTabs).where(eq(schema.browserTabs.id, tabId));
    if (!tab) return null;
    let linkedCompany = null, recentEvidence: any[] = [], recentTasks: any[] = [];
    // Resolve linked company via the forensic graph
    const [link] = await db.select()
      .from(schema.entityLinks)
      .where(and(
        eq(schema.entityLinks.sourceType, 'browser_tab'),
        eq(schema.entityLinks.sourceId, tabId),
        eq(schema.entityLinks.targetType, 'company')
      )).limit(1);

    if (link) {
      linkedCompany = (await db.select().from(schema.companies).where(eq(schema.companies.id, link.targetId)))[0] ?? null;
      if (linkedCompany) {
        recentEvidence = await EvidenceRepository.getFragmentsByCompany(linkedCompany.id);
        recentTasks = await TaskRepository.getTasksByEntity('company', linkedCompany.id);
      }
    }
    return { tab, linkedCompany, recentEvidence, recentTasks };
  }));

  // ─── Inbox: Queries ──────────────────────────────────────────────────────────
  ipcMain.handle('inbox:sync', async () => handle(async () => {
    if (!syncEngine) return { ok: false, error: { code: 'NOT_READY', message: 'No mail account configured' } };
    await syncEngine.runSync();
    return { ok: true, data: null };
  }));

  ipcMain.handle('inbox:getSyncStatus', async () => handle(() => InboxService.getSyncStatus()));
  ipcMain.handle('inbox:getAccounts', async () => handle(async () =>
    db.select({ id: schema.mailAccounts.id, email: schema.mailAccounts.email, provider: schema.mailAccounts.provider, displayName: schema.mailAccounts.displayName, isActive: schema.mailAccounts.isActive }).from(schema.mailAccounts)
  ));
  ipcMain.handle('inbox:getThreads', async (e, archived) => handle(() => InboxRepository.getThreads(archived)));
  ipcMain.handle('inbox:search', async (e, query) => handle(() => InboxRepository.search(query)));
  ipcMain.handle('inbox:getThreadContext', async (e, threadId) => handle(() => InboxRepository.getThreadContext(threadId)));
  ipcMain.handle('inbox:getMessage', async (e, messageId) => handle(() => InboxService.getMessage(messageId)));
  ipcMain.handle('inbox:getMessageLabels', async () => handle(() => InboxRepository.getMessageLabels()));
  ipcMain.handle('inbox:getLabels', async () => handle(() => InboxRepository.getLabels()));

  // ─── Inbox: Commands ─────────────────────────────────────────────────────────
  ipcMain.handle('inbox:createEvidenceFromMessage', async (e, messageId, claimSummary, quote) =>
    handle(() => InboxService.createEvidenceFromMessage(messageId, claimSummary, quote)));
  ipcMain.handle('inbox:createEvidenceFromBrowserTab', async (e, tabId, url, title) =>
    handle(() => InboxService.createEvidenceFromBrowserTab(tabId, url, title)));
  ipcMain.handle('inbox:escalateMessage', async (e, messageId, reason) =>
    handle(() => InboxService.escalateMessage(messageId, reason)));
  ipcMain.handle('inbox:quarantineMessage', async (e, messageId, reason) =>
    handle(() => InboxService.quarantineMessage(messageId, reason)));
  ipcMain.handle('inbox:markThreadRead', async (e, threadId) =>
    handle(() => InboxService.markThreadRead(threadId)));
  ipcMain.handle('inbox:archiveThread', async (e, threadId) =>
    handle(() => InboxService.archiveThread(threadId)));
  ipcMain.handle('inbox:markMessageRead', async (e, messageId) =>
    handle(() => InboxService.markMessageRead(messageId)));
  ipcMain.handle('inbox:archiveMessage', async (e, messageId) =>
    handle(() => InboxService.archiveMessage(messageId)));
  ipcMain.handle('inbox:markMessageIgnored', async (e, messageId) =>
    handle(() => InboxService.markMessageIgnored(messageId)));
  ipcMain.handle('inbox:createLabel', async (e, name, color) =>
    handle(() => InboxService.createLabel(name, color)));
  ipcMain.handle('inbox:addLabelToMessage', async (e, messageId, labelId) =>
    handle(() => InboxService.addLabelToMessage(messageId, labelId)));
  ipcMain.handle('inbox:removeLabelFromMessage', async (e, messageId, labelId) =>
    handle(() => InboxService.removeLabelFromMessage(messageId, labelId)));

  // ─── CRM: Queries ────────────────────────────────────────────────────────────
  ipcMain.handle('crm:getCompanies', async () => handle(() => CrmRepository.getCompanies()));
  ipcMain.handle('crm:getCompanyDetail', async (e, companyId) => handle(() => CrmRepository.getCompanyDetail(companyId)));
  ipcMain.handle('crm:getCompanyLinks', async (e, companyId) => handle(() => CrmRepository.getCompanyLinks(companyId)));
  ipcMain.handle('crm:getContacts', async (e, companyId) => handle(async () =>
    db.select().from(schema.contacts).where(eq(schema.contacts.companyId, companyId))
  ));

  // ─── CRM: Commands ───────────────────────────────────────────────────────────
  ipcMain.handle('crm:createCompanyFromMessage', async (e, messageId) =>
    handle(() => CrmService.createCompanyFromMessage(messageId), {
      entityType: 'company',
      entityId: (id) => id,
      entryType: 'created',
      message: (id) => `Company created from message ${messageId}`
    }));
  ipcMain.handle('crm:createContact', async (e, companyId, name, email, role) =>
    handle(() => CrmService.createContact(companyId, name, email, role), {
      entityType: 'contact',
      entityId: (id) => id,
      entryType: 'created',
      message: `Contact "${name}" created`,
      parentEntityType: 'company',
      parentEntityId: companyId
    }));
  ipcMain.handle('crm:updateCompany', async (e, companyId, patch) =>
    handle(() => CrmService.updateCompany(companyId, patch), {
      entityType: 'company',
      entityId: companyId,
      entryType: 'updated',
      message: `Company manual update: ${Object.keys(patch).join(', ')}`
    }));
  ipcMain.handle('crm:linkMessageToCompany', async (e, messageId, companyId) =>
    handle(() => CrmService.linkMessageToCompany(messageId, companyId)));
  ipcMain.handle('crm:linkBrowserTabToCompany', async (e, tabId, companyId, url) =>
    handle(() => CrmService.linkBrowserTabToCompany(tabId, companyId, url), {
      entityType: 'browser_tab',
      entityId: tabId,
      entryType: 'linked',
      message: (res) => `Tab linked to company ${res.companyId}`,
      parentEntityType: 'company',
      parentEntityId: (res) => res.companyId
    }));

  // ─── Graph (360-View) ────────────────────────────────────────────────────────
  ipcMain.handle('graph:getGraphContext', async (e, { entityType, entityId }) =>
    handle(() => GraphRepository.getGraphContext(entityType, entityId)));

  // ─── Links (Unified Graph) ──────────────────────────────────────────────────
  ipcMain.handle('link:create', async (e, sourceType, sourceId, targetType, targetId, linkType, metadata) =>
    handle(() => LinkService.createLink(sourceType, sourceId, targetType, targetId, linkType, metadata)));
  ipcMain.handle('link:remove', async (e, linkId) =>
    handle(() => LinkService.removeLink(linkId)));
  ipcMain.handle('link:getForEntity', async (e, type, id) =>
    handle(() => LinkService.getLinksForEntity(type, id)));

  // ─── Tasks: Queries ──────────────────────────────────────────────────────────
  ipcMain.handle('tasks:getTasks', async () => handle(() => TaskRepository.getTasks()));
  ipcMain.handle('tasks:getTask', async (e, taskId) => handle(() => TaskRepository.getTask(taskId)));

  // ─── Tasks: Commands ─────────────────────────────────────────────────────────
  ipcMain.handle('tasks:createTask', async (e, opt) =>
    handle(() => TaskService.createTask(opt.title, opt.type, opt.priority, opt)));
  ipcMain.handle('tasks:updateTaskStatus', async (e, taskId, status) =>
    handle(() => TaskService.updateTaskStatus(taskId, status), {
      entityType: 'task',
      entityId: taskId,
      entryType: 'status_updated',
      message: `Task status set to: ${status}`
    }));
  ipcMain.handle('tasks:updateTaskWorkflow', async (e, taskId, update) =>
    handle(() => TaskService.updateTaskWorkflow(taskId, update)));
  ipcMain.handle('tasks:appendNotebookEntryFromBrowserTab', async (e, tabId, message) =>
    handle(() => TaskService.appendNotebookEntryFromBrowserTab(tabId, message)));

  // ─── Outreach: Queries ───────────────────────────────────────────────────────
  ipcMain.handle('outreach:getDrafts', async () => handle(() => OutreachRepository.getDrafts()));
  ipcMain.handle('outreach:getDraft', async (e, draftId) => handle(() => OutreachRepository.getDraft(draftId)));

  // ─── Outreach: Commands ──────────────────────────────────────────────────────
  ipcMain.handle('outreach:createDraftFromThread', async (e, threadId, subject, body) =>
    handle(() => OutreachService.createDraftFromThread(threadId, subject, body)));
  ipcMain.handle('outreach:createDraftFromCompany', async (e, companyId, subject, body) =>
    handle(() => OutreachService.createDraftFromCompany(companyId, subject, body)));
  ipcMain.handle('outreach:updateDraft', async (e, draftId, subject, body) =>
    handle(() => OutreachService.updateDraft(draftId, subject, body)));
  ipcMain.handle('outreach:approveDraft', async (e, draftId) =>
    handle(() => OutreachService.approveDraft(draftId)));
  ipcMain.handle('outreach:blockDraft', async (e, draftId, reason) =>
    handle(() => OutreachService.blockDraft(draftId, reason)));
  ipcMain.handle('outreach:retractDraft', async (e, draftId) =>
    handle(() => OutreachService.retractDraft(draftId)));
  ipcMain.handle('outreach:submitDraftForReview', async (e, draftId) =>
    handle(() => OutreachService.submitDraftForReview(draftId)));
  ipcMain.handle('outreach:resolveDraftBlocker', async (e, draftId, resolution) =>
    handle(() => OutreachService.resolveDraftBlocker(draftId, resolution)));
  ipcMain.handle('outreach:sendDraft', async (e, draftId: string) => handle(async () => {
    if (!syncEngine) return { ok: false, error: { code: 'NOT_READY', message: 'Sync engine not initialized' } };
    await syncEngine.sendDraft(draftId);
    return { ok: true, data: null };
  }));

  // ─── Evidence ────────────────────────────────────────────────────────────────
  ipcMain.handle('evidence:getFragments', async (e, filters) =>
    handle(() => EvidenceRepository.getFragments(filters ?? {})));
  ipcMain.handle('evidence:getFragment', async (e, fragmentId) =>
    handle(() => EvidenceRepository.getFragment(fragmentId)));
  ipcMain.handle('evidence:getPendingReview', async () =>
    handle(() => EvidenceRepository.getPendingReview()));
  ipcMain.handle('evidence:getContradicted', async () =>
    handle(() => EvidenceRepository.getContradicted()));

  ipcMain.handle('evidence:createFragment', async (e, claimSummary, sourceType, sourceId, opts) =>
    handle(() => EvidenceService.createFragment(claimSummary, sourceType, sourceId, opts)));
  ipcMain.handle('evidence:review', async (e, fragmentId, status) =>
    handle(() => EvidenceService.review(fragmentId, status)));
  ipcMain.handle('evidence:setContradiction', async (e, fragmentId, contradicts, reason) =>
    handle(() => EvidenceService.setContradiction(fragmentId, contradicts, reason)));
  ipcMain.handle('evidence:updateConfidence', async (e, fragmentId, confidence) =>
    handle(() => EvidenceService.updateConfidence(fragmentId, confidence)));
  ipcMain.handle('evidence:updateClaim', async (e, fragmentId, claimSummary) =>
    handle(() => EvidenceService.updateClaim(fragmentId, claimSummary)));
  ipcMain.handle('evidence:delete', async (e, fragmentId: string) =>
    handle(() => EvidenceService.deleteFragment(fragmentId)));
  ipcMain.handle('evidence:linkToCompany', async (e, evidenceId, companyId) =>
    handle(() => LinkService.createLink('evidence', evidenceId, 'company', companyId, 'evidence_for')));
  ipcMain.handle('evidence:unlinkFromCompany', async (e, evidenceId, companyId) =>
    handle(async () => {
      const links = await LinkService.getLinksForEntity('evidence', evidenceId);
      if (!links.ok) return links;
      const targetLink = links.data.find(l => l.targetType === 'company' && l.targetId === companyId);
      if (targetLink) return LinkService.removeLink(targetLink.id);
      return { ok: true, data: null };
    }));

  // ─── Notebook / Audit ────────────────────────────────────────────────────────
  ipcMain.handle('notebook:getEntries', async (e, filters) => handle(() => NotebookRepository.getEntries(filters)));
  ipcMain.handle('audit:getCommandLog', async (e, entityId) => handle(() => NotebookRepository.getCommandLog(entityId)));

  // ─── Browser Run ─────────────────────────────────────────────────────────────
  ipcMain.handle('browserRun:create', async (e, input) =>
    handle(() => BrowserRunService.createRun(input)));
  ipcMain.handle('browserRun:start', async (e, input) =>
    handle(() => orchestrator ? orchestrator.createAndStartRun(input) : BrowserRunService.createRun(input)));
  ipcMain.handle('browserRun:stop', async (e, runId) =>
    handle(() => orchestrator ? orchestrator.stopRun(runId) : BrowserRunService.stopRun(runId)));
  ipcMain.handle('browserRun:list', async () =>
    handle(() => BrowserRunService.listActiveRuns()));
  ipcMain.handle('browserRun:get', async (e, runId) =>
    handle(() => BrowserRunService.getRunWithEvents(runId)));
  ipcMain.handle('browserRun:enableWatch', async (e, runId) =>
    handle(() => orchestrator ? orchestrator.enableWatch(runId) : BrowserRunService.enableWatch(runId)));
  ipcMain.handle('browserRun:disableWatch', async (e, runId) =>
    handle(() => orchestrator ? orchestrator.disableWatch(runId) : BrowserRunService.disableWatch(runId)));
  ipcMain.handle('browserRun:watchSnapshot', async (e, runId) =>
    handle(() => orchestrator ? orchestrator.getWatchSnapshot(runId) : BrowserRunService.getRunWithEvents(runId)));
  ipcMain.handle('browserRun:setMode', async (e, runId, mode) =>
    handle(() => BrowserRunService.setRunMode(runId, mode)));
  ipcMain.handle('browserRun:navigate', async (e, runId, url) =>
    handle(() => orchestrator ? orchestrator.executeNavigation(runId, url) : Promise.resolve({ ok: false, error: { code: 'NO_ORCHESTRATOR', message: 'Orchestrator not available' } })));

  // ─── Training ────────────────────────────────────────────────────────────────
  ipcMain.handle('training:approveSite', async (e, domain, notes) =>
    handle(() => TrainingService.approveSite(domain, notes)));
  ipcMain.handle('training:createSiteProfile', async (e, input) =>
    handle(() => TrainingService.createSiteProfile(input)));
  ipcMain.handle('training:updateSiteProfile', async (e, id, patch) =>
    handle(() => TrainingService.updateSiteProfile(id, patch)));
  ipcMain.handle('training:createFieldProfile', async (e, input) =>
    handle(() => TrainingService.createFieldProfile(input)));
  ipcMain.handle('training:updateFieldKeywordRules', async (e, id, rules) =>
    handle(() => TrainingService.updateFieldKeywordRules(id, rules)));
  ipcMain.handle('training:updateFieldSelectorRules', async (e, id, rules) =>
    handle(() => TrainingService.updateFieldSelectorRules(id, rules)));
  ipcMain.handle('training:createAutomationRecipe', async (e, input) =>
    handle(() => TrainingService.createAutomationRecipe(input)));
  ipcMain.handle('training:updateAutomationRecipe', async (e, id, patch) =>
    handle(() => TrainingService.updateAutomationRecipe(id, patch)));
  ipcMain.handle('training:createAnnotation', async (e, input) =>
    handle(() => TrainingService.createAnnotation(input)));
  ipcMain.handle('training:createActionButton', async (e, input) =>
    handle(() => TrainingService.createActionButton(input)));
  ipcMain.handle('training:getSiteProfileForUrl', async (e, url) =>
    handle(() => TrainingService.getSiteProfileForUrl(url)));

  // ─── Site Profiles ───────────────────────────────────────────────────────────
  ipcMain.handle('siteProfile:list', async () =>
    handle(() => TrainingService.listSiteProfiles()));
  ipcMain.handle('siteProfile:get', async (e, id) =>
    handle(() => TrainingService.getSiteProfile(id)));
  ipcMain.handle('siteProfile:getByDomain', async (e, domain) =>
    handle(() => TrainingService.getSiteProfileForUrl(domain)));

}
