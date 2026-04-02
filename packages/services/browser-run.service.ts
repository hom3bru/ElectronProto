import { v4 as uuid } from 'uuid';
import { ok, fail, okVoid, validateId, validateEnum, validateNonEmpty,
  BROWSER_RUN_TYPE, BROWSER_RUN_MODE, BROWSER_RUN_STATUS } from '../shared/command';
import type { CommandResult } from '../shared/command';
import type { BrowserRun, BrowserRunEvent, BrowserContext } from '../shared/types';
import type { IpcBrowserRun, IpcBrowserRunSummary, IpcWatchState } from '../shared/ipc-types';
import { BrowserRunRepository } from '../repositories/browser-run.repository';
import { LoggerService } from './logger.service';

export interface CreateRunInput {
  runType: string;
  mode: string;
  leaderBrowserType: string;
  targetUrl?: string;
  linkedCompanyId?: string;
  linkedTaskId?: string;
  linkedThreadId?: string;
  linkedMessageId?: string;
  watchEnabled?: boolean;
}

export class BrowserRunService {
  static async createRun(input: CreateRunInput): Promise<CommandResult<BrowserRun>> {
    const runTypeV = validateEnum(input.runType, BROWSER_RUN_TYPE, 'runType');
    if (!runTypeV.ok) return runTypeV;
    const modeV = validateEnum(input.mode, BROWSER_RUN_MODE, 'mode');
    if (!modeV.ok) return modeV;

    const now = new Date();
    const run: BrowserRun = {
      id: uuid(),
      runType: runTypeV.data,
      mode: modeV.data,
      leaderBrowserType: input.leaderBrowserType,
      leaderContextId: null,
      followerBrowserType: null,
      followerContextId: null,
      watchEnabled: input.watchEnabled ?? false,
      watchSurfaceType: null,
      status: 'pending',
      linkedCompanyId: input.linkedCompanyId ?? null,
      linkedTaskId: input.linkedTaskId ?? null,
      linkedThreadId: input.linkedThreadId ?? null,
      linkedMessageId: input.linkedMessageId ?? null,
      targetUrl: input.targetUrl ?? null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      error: null,
    };

    const created = await BrowserRunRepository.createRun(run);
    await LoggerService.logNotebookEntry('browser_run', created.id, 'browser-run-created', `Browser run created: ${created.runType} (${created.mode})`, {
      actorType: 'system', actorName: 'BrowserRunService',
      metadataJson: { runType: created.runType, mode: created.mode, leaderBrowserType: created.leaderBrowserType, targetUrl: created.targetUrl },
    });
    return ok(created);
  }

  static async startRun(runId: string): Promise<CommandResult<void>> {
    const idV = validateId(runId, 'runId');
    if (!idV.ok) return idV;
    const run = await BrowserRunRepository.getRun(runId);
    if (!run) return fail('NOT_FOUND', `Run not found: ${runId}`);
    if (run.status !== 'pending') return fail('INVALID_STATE', `Run is not pending (current: ${run.status})`);
    const now = new Date();
    await BrowserRunRepository.updateRun(runId, { status: 'running', startedAt: now, updatedAt: now });
    await BrowserRunRepository.addRunEvent({
      id: uuid(), browserRunId: runId, eventType: 'start', contextId: null,
      actorType: 'system', payloadJson: null, createdAt: now,
    });
    return okVoid();
  }

  static async stopRun(runId: string, reason?: string): Promise<CommandResult<void>> {
    const idV = validateId(runId, 'runId');
    if (!idV.ok) return idV;
    const run = await BrowserRunRepository.getRun(runId);
    if (!run) return fail('NOT_FOUND', `Run not found: ${runId}`);
    const now = new Date();
    await BrowserRunRepository.updateRun(runId, {
      status: 'cancelled', completedAt: now, updatedAt: now, error: reason ?? null,
    });
    await BrowserRunRepository.addRunEvent({
      id: uuid(), browserRunId: runId, eventType: 'stop', contextId: null,
      actorType: 'human', payloadJson: { reason: reason ?? null }, createdAt: now,
    });
    await LoggerService.logNotebookEntry('browser_run', runId, 'browser-run-stopped', `Run stopped${reason ? `: ${reason}` : ''}`, {
      actorType: 'human', actorName: 'User',
      metadataJson: { reason, runType: run.runType },
    });
    return okVoid();
  }

  static async completeRun(runId: string, error?: string): Promise<CommandResult<void>> {
    const now = new Date();
    const status = error ? 'failed' : 'completed';
    await BrowserRunRepository.updateRun(runId, { status, completedAt: now, updatedAt: now, error: error ?? null });
    const run = await BrowserRunRepository.getRun(runId);
    await LoggerService.logNotebookEntry('browser_run', runId, `browser-run-${status}`, `Run ${status}${error ? `: ${error}` : ''}`, {
      actorType: 'system', actorName: 'BrowserRunService',
      metadataJson: { runType: run?.runType, error },
    });
    return okVoid();
  }

  static async setRunMode(runId: string, mode: string): Promise<CommandResult<void>> {
    const idV = validateId(runId, 'runId');
    if (!idV.ok) return idV;
    const modeV = validateEnum(mode, BROWSER_RUN_MODE, 'mode');
    if (!modeV.ok) return modeV;
    const now = new Date();
    await BrowserRunRepository.updateRun(runId, { mode: modeV.data, updatedAt: now });
    await BrowserRunRepository.addRunEvent({
      id: uuid(), browserRunId: runId, eventType: 'mode-change', contextId: null,
      actorType: 'human', payloadJson: { mode: modeV.data }, createdAt: now,
    });
    return okVoid();
  }

  static async assignLeader(runId: string, contextId: string, browserType: string): Promise<CommandResult<void>> {
    const now = new Date();
    await BrowserRunRepository.updateRun(runId, { leaderContextId: contextId, leaderBrowserType: browserType, updatedAt: now });
    await BrowserRunRepository.addRunEvent({
      id: uuid(), browserRunId: runId, eventType: 'leader-assign', contextId,
      actorType: 'system', payloadJson: { browserType }, createdAt: now,
    });
    await LoggerService.logNotebookEntry('browser_run', runId, 'leader-assigned', `Leader assigned: ${browserType} context ${contextId}`, {
      actorType: 'system', metadataJson: { contextId, browserType },
    });
    return okVoid();
  }

  static async enableWatch(runId: string, surfaceType = 'panel'): Promise<CommandResult<void>> {
    const now = new Date();
    await BrowserRunRepository.updateRun(runId, { watchEnabled: true, watchSurfaceType: surfaceType, updatedAt: now });
    await BrowserRunRepository.addRunEvent({
      id: uuid(), browserRunId: runId, eventType: 'watch-enable', contextId: null,
      actorType: 'human', payloadJson: { surfaceType }, createdAt: now,
    });
    await LoggerService.logNotebookEntry('browser_run', runId, 'watch-enabled', `Watch enabled (${surfaceType})`, {
      actorType: 'human', metadataJson: { surfaceType },
    });
    return okVoid();
  }

  static async disableWatch(runId: string): Promise<CommandResult<void>> {
    const now = new Date();
    await BrowserRunRepository.updateRun(runId, { watchEnabled: false, updatedAt: now });
    await BrowserRunRepository.addRunEvent({
      id: uuid(), browserRunId: runId, eventType: 'watch-disable', contextId: null,
      actorType: 'human', payloadJson: null, createdAt: now,
    });
    await LoggerService.logNotebookEntry('browser_run', runId, 'watch-disabled', 'Watch surface closed — run continues', {
      actorType: 'human',
    });
    return okVoid();
  }

  static async listActiveRuns(): Promise<CommandResult<IpcBrowserRunSummary[]>> {
    const runs = await BrowserRunRepository.listActiveRuns();
    const summaries: IpcBrowserRunSummary[] = runs.map((r) => ({
      id: r.id, runType: r.runType, mode: r.mode, status: r.status,
      leaderBrowserType: r.leaderBrowserType, followerBrowserType: r.followerBrowserType,
      watchEnabled: r.watchEnabled, linkedCompanyId: r.linkedCompanyId, linkedTaskId: r.linkedTaskId,
      targetUrl: r.targetUrl, startedAt: r.startedAt, createdAt: r.createdAt, error: r.error,
    }));
    return ok(summaries);
  }

  static async getRunWithEvents(runId: string): Promise<CommandResult<IpcBrowserRun>> {
    const idV = validateId(runId, 'runId');
    if (!idV.ok) return idV;
    const run = await BrowserRunRepository.getRun(runId);
    if (!run) return fail('NOT_FOUND', `Run not found: ${runId}`);
    const events = await BrowserRunRepository.getRunEvents(runId);
    const leaderContext = run.leaderContextId ? await BrowserRunRepository.getContext(run.leaderContextId) : null;
    const followerContext = run.followerContextId ? await BrowserRunRepository.getContext(run.followerContextId) : null;
    return ok({ ...run, leaderContext, followerContext, events });
  }

  static async addRunEvent(runId: string, eventType: string, actorType: string, payload?: any): Promise<void> {
    await BrowserRunRepository.addRunEvent({
      id: uuid(), browserRunId: runId, eventType, contextId: null,
      actorType, payloadJson: payload ?? null, createdAt: new Date(),
    });
  }
}
