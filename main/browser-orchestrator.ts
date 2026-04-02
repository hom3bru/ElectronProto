import { v4 as uuid } from 'uuid';
import { ok, fail, okVoid } from '../packages/shared/command';
import type { CommandResult } from '../packages/shared/command';
import type { MachineBrowserProvider, NavigateResult, ExtractionSpec, ExtractionResult } from '../packages/machine-browser/provider';
import type { IpcBrowserRun, IpcBrowserRunSummary, IpcWatchState } from '../packages/shared/ipc-types';
import { BrowserRunService, CreateRunInput } from '../packages/services/browser-run.service';
import { BrowserRunRepository } from '../packages/repositories/browser-run.repository';

/**
 * BrowserOrchestrator — main-process service that manages machine browser
 * lifecycle and emits watch updates to the renderer.
 *
 * Role assignment is PER RUN, not global:
 *   human-training      → visible browser leads, machine is passive
 *   visible-agent-control → visible browser leads initially; can transfer
 *   autonomous-automation → machine browser leads; visible can watch
 */
export class BrowserOrchestrator {
  private provider: MachineBrowserProvider;
  private notifyRenderer: (channel: string, ...args: any[]) => void;
  // runId → machineContextId
  private runContexts = new Map<string, string>();

  constructor(provider: MachineBrowserProvider, notifyRenderer: (channel: string, ...args: any[]) => void) {
    this.provider = provider;
    this.notifyRenderer = notifyRenderer;
  }

  // ─── Run lifecycle ─────────────────────────────────────────────────────────

  async createAndStartRun(input: CreateRunInput): Promise<CommandResult<IpcBrowserRun>> {
    const createResult = await BrowserRunService.createRun(input);
    if (!createResult.ok) return createResult;
    const run = createResult.data;

    // For autonomous/extraction runs, spin up a machine context immediately
    if (['autonomous-automation', 'extraction', 'verification', 'site-learning'].includes(run.runType)) {
      try {
        const contextId = await this.provider.createContext({ headless: true });
        const now = new Date();
        await BrowserRunRepository.createContext({
          id: contextId, browserType: this.provider.providerType,
          contextKey: `run-${run.id}`, visibility: 'hidden',
          sessionPartition: null, status: 'idle', createdAt: now, updatedAt: now,
        });
        await BrowserRunService.assignLeader(run.id, contextId, this.provider.providerType);
        this.runContexts.set(run.id, contextId);

        if (run.targetUrl) {
          // Kick off navigation async — don't await so the run starts immediately
          this.executeNavigationAsync(run.id, contextId, run.targetUrl);
        }
      } catch (e: any) {
        await BrowserRunService.completeRun(run.id, e.message);
        return fail('PROVIDER_ERROR', `Failed to start machine context: ${e.message}`);
      }
    }

    await BrowserRunService.startRun(run.id);
    const detail = await BrowserRunService.getRunWithEvents(run.id);
    return detail;
  }

  async stopRun(runId: string): Promise<CommandResult<void>> {
    const contextId = this.runContexts.get(runId);
    if (contextId) {
      await this.provider.disposeContext(contextId).catch(() => {});
      this.runContexts.delete(runId);
    }
    const result = await BrowserRunService.stopRun(runId, 'User requested stop');
    this.notifyRenderer('browserRun:watchUpdate', {
      runId, status: 'cancelled', currentUrl: '', title: '', currentAction: 'Stopped by user',
      screenshotDataUrl: null, events: [],
    } satisfies IpcWatchState);
    return result;
  }

  // ─── Navigation ────────────────────────────────────────────────────────────

  async executeNavigation(runId: string, url: string): Promise<CommandResult<NavigateResult>> {
    const contextId = this.runContexts.get(runId);
    if (!contextId) return fail('NO_CONTEXT', 'No machine context for this run');
    try {
      await BrowserRunService.addRunEvent(runId, 'navigate', 'machine', { url });
      const result = await this.provider.navigate(contextId, url);
      await BrowserRunService.addRunEvent(runId, 'navigate-complete', 'machine', { url: result.url, title: result.title });
      this.notifyRenderer('browserRun:watchUpdate', {
        runId, status: 'running', currentUrl: result.url, title: result.title,
        currentAction: `Navigated to ${result.url}`, screenshotDataUrl: null, events: [],
      } satisfies IpcWatchState);
      return ok(result);
    } catch (e: any) {
      await BrowserRunService.addRunEvent(runId, 'error', 'machine', { error: e.message });
      return fail('NAVIGATION_ERROR', e.message);
    }
  }

  async executeExtraction(runId: string, spec: ExtractionSpec): Promise<CommandResult<ExtractionResult>> {
    const contextId = this.runContexts.get(runId);
    if (!contextId) return fail('NO_CONTEXT', 'No machine context for this run');
    try {
      await BrowserRunService.addRunEvent(runId, 'extract-start', 'machine', { spec });
      const result = await this.provider.runExtraction(contextId, spec);
      await BrowserRunService.addRunEvent(runId, 'extract-complete', 'machine', { confidence: result.confidence, fieldCount: Object.keys(result.fields).length });
      return ok(result);
    } catch (e: any) {
      return fail('EXTRACTION_ERROR', e.message);
    }
  }

  // ─── Watch ─────────────────────────────────────────────────────────────────

  async enableWatch(runId: string): Promise<CommandResult<IpcWatchState>> {
    await BrowserRunService.enableWatch(runId, 'panel');
    const snapshot = await this.getWatchSnapshot(runId);
    return snapshot;
  }

  async disableWatch(runId: string): Promise<CommandResult<void>> {
    return BrowserRunService.disableWatch(runId);
  }

  async getWatchSnapshot(runId: string): Promise<CommandResult<IpcWatchState>> {
    const runResult = await BrowserRunService.getRunWithEvents(runId);
    if (!runResult.ok) return runResult;
    const run = runResult.data;

    const contextId = this.runContexts.get(runId);
    let screenshotDataUrl: string | null = null;
    let currentUrl = run.targetUrl ?? '';
    let title = '';

    if (contextId && this.provider.attachWatch) {
      try {
        const snap = await this.provider.attachWatch(contextId);
        screenshotDataUrl = snap.screenshotDataUrl;
        currentUrl = snap.currentUrl || currentUrl;
        title = snap.title;
      } catch {
        // non-fatal
      }
    }

    return ok({
      runId, status: run.status, currentUrl, title,
      currentAction: run.events[0]?.eventType ?? null,
      screenshotDataUrl, events: run.events.slice(0, 20),
    });
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  getActiveRunIds(): string[] {
    return [...this.runContexts.keys()];
  }

  async shutdown(): Promise<void> {
    for (const [runId, contextId] of this.runContexts) {
      await this.provider.disposeContext(contextId).catch(() => {});
      await BrowserRunService.completeRun(runId, 'App shutdown').catch(() => {});
    }
    this.runContexts.clear();
    await this.provider.shutdown().catch(() => {});
  }

  // Fires and forgets navigation; emits watch updates as it progresses
  private async executeNavigationAsync(runId: string, contextId: string, url: string): Promise<void> {
    try {
      await BrowserRunService.addRunEvent(runId, 'navigate', 'machine', { url });
      this.notifyRenderer('browserRun:watchUpdate', {
        runId, status: 'running', currentUrl: url, title: 'Loading…',
        currentAction: `Navigating to ${url}`, screenshotDataUrl: null, events: [],
      } satisfies IpcWatchState);
      const result = await this.provider.navigate(contextId, url);
      await BrowserRunService.addRunEvent(runId, 'navigate-complete', 'machine', { url: result.url, title: result.title });
      this.notifyRenderer('browserRun:watchUpdate', {
        runId, status: 'running', currentUrl: result.url, title: result.title,
        currentAction: `Loaded: ${result.title}`, screenshotDataUrl: null, events: [],
      } satisfies IpcWatchState);
    } catch (e: any) {
      await BrowserRunService.addRunEvent(runId, 'error', 'machine', { error: e.message });
      this.notifyRenderer('browserRun:watchUpdate', {
        runId, status: 'failed', currentUrl: url, title: '',
        currentAction: `Error: ${e.message}`, screenshotDataUrl: null, events: [],
      } satisfies IpcWatchState);
    }
  }
}
