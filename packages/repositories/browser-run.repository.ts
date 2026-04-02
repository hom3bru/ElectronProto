import { eq, desc, inArray } from 'drizzle-orm';
import { db } from '../../db';
import {
  browserContexts, browserRuns, browserRunEvents, browserSyncLinks,
} from '../../db/schema';
import type {
  BrowserContext, BrowserRun, BrowserRunEvent, BrowserSyncLink,
} from '../shared/types';

// ─── BrowserContext ───────────────────────────────────────────────────────────

export class BrowserRunRepository {
  static async createContext(data: Omit<BrowserContext, 'lastActivityAt'> & { lastActivityAt?: Date | null }): Promise<BrowserContext> {
    const rows = await db.insert(browserContexts).values({
      id: data.id,
      browserType: data.browserType,
      contextKey: data.contextKey,
      visibility: data.visibility,
      sessionPartition: data.sessionPartition ?? null,
      status: data.status,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      lastActivityAt: data.lastActivityAt ?? null,
    }).returning();
    return rows[0] as unknown as BrowserContext;
  }

  static async updateContext(id: string, patch: Partial<Pick<BrowserContext, 'status' | 'lastActivityAt' | 'updatedAt'>>): Promise<void> {
    await db.update(browserContexts).set(patch as any).where(eq(browserContexts.id, id));
  }

  static async getContext(id: string): Promise<BrowserContext | null> {
    const rows = await db.select().from(browserContexts).where(eq(browserContexts.id, id));
    return (rows[0] as unknown as BrowserContext) ?? null;
  }

  // ─── BrowserRun ─────────────────────────────────────────────────────────────

  static async createRun(data: BrowserRun): Promise<BrowserRun> {
    const rows = await db.insert(browserRuns).values({
      id: data.id,
      runType: data.runType,
      mode: data.mode,
      leaderBrowserType: data.leaderBrowserType,
      leaderContextId: data.leaderContextId ?? null,
      followerBrowserType: data.followerBrowserType ?? null,
      followerContextId: data.followerContextId ?? null,
      watchEnabled: data.watchEnabled ?? false,
      watchSurfaceType: data.watchSurfaceType ?? null,
      status: data.status,
      linkedCompanyId: data.linkedCompanyId ?? null,
      linkedTaskId: data.linkedTaskId ?? null,
      linkedThreadId: data.linkedThreadId ?? null,
      linkedMessageId: data.linkedMessageId ?? null,
      targetUrl: data.targetUrl ?? null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      startedAt: data.startedAt ?? null,
      completedAt: data.completedAt ?? null,
      error: data.error ?? null,
    }).returning();
    return rows[0] as unknown as BrowserRun;
  }

  static async updateRun(id: string, patch: Partial<BrowserRun>): Promise<void> {
    await db.update(browserRuns).set(patch as any).where(eq(browserRuns.id, id));
  }

  static async getRun(id: string): Promise<BrowserRun | null> {
    const rows = await db.select().from(browserRuns).where(eq(browserRuns.id, id));
    return (rows[0] as unknown as BrowserRun) ?? null;
  }

  static async listRuns(filters?: { status?: string[] }): Promise<BrowserRun[]> {
    if (filters?.status?.length) {
      return db.select().from(browserRuns)
        .where(inArray(browserRuns.status, filters.status))
        .orderBy(desc(browserRuns.createdAt)) as unknown as BrowserRun[];
    }
    return db.select().from(browserRuns).orderBy(desc(browserRuns.createdAt)) as unknown as BrowserRun[];
  }

  static async listActiveRuns(): Promise<BrowserRun[]> {
    return BrowserRunRepository.listRuns({ status: ['pending', 'running', 'paused'] });
  }

  // ─── BrowserRunEvent ─────────────────────────────────────────────────────────

  static async addRunEvent(data: BrowserRunEvent): Promise<BrowserRunEvent> {
    const rows = await db.insert(browserRunEvents).values({
      id: data.id,
      browserRunId: data.browserRunId,
      eventType: data.eventType,
      contextId: data.contextId ?? null,
      actorType: data.actorType,
      payloadJson: data.payloadJson ?? null,
      createdAt: data.createdAt,
    }).returning();
    return rows[0] as unknown as BrowserRunEvent;
  }

  static async getRunEvents(runId: string): Promise<BrowserRunEvent[]> {
    return db.select().from(browserRunEvents)
      .where(eq(browserRunEvents.browserRunId, runId))
      .orderBy(desc(browserRunEvents.createdAt)) as unknown as BrowserRunEvent[];
  }

  // ─── BrowserSyncLink ─────────────────────────────────────────────────────────

  static async createSyncLink(data: BrowserSyncLink): Promise<BrowserSyncLink> {
    const rows = await db.insert(browserSyncLinks).values({
      id: data.id,
      browserRunId: data.browserRunId,
      sourceContextId: data.sourceContextId,
      targetContextId: data.targetContextId,
      syncDirection: data.syncDirection,
      syncGranularity: data.syncGranularity,
      syncStatus: data.syncStatus,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }).returning();
    return rows[0] as unknown as BrowserSyncLink;
  }

  static async updateSyncLink(id: string, patch: Partial<Pick<BrowserSyncLink, 'syncStatus' | 'updatedAt'>>): Promise<void> {
    await db.update(browserSyncLinks).set(patch as any).where(eq(browserSyncLinks.id, id));
  }

  static async listSyncLinks(runId: string): Promise<BrowserSyncLink[]> {
    return db.select().from(browserSyncLinks)
      .where(eq(browserSyncLinks.browserRunId, runId)) as unknown as BrowserSyncLink[];
  }
}
