import { eq, desc } from 'drizzle-orm';
import { db } from '../../db';
import {
  siteProfiles, fieldProfiles, automationRecipes, browserAnnotations, browserActionButtons,
} from '../../db/schema';
import type {
  SiteProfile, FieldProfile, AutomationRecipe, BrowserAnnotation, BrowserActionButton,
} from '../shared/types';

export class SiteProfileRepository {
  // ─── SiteProfile ─────────────────────────────────────────────────────────────

  static async createSiteProfile(data: SiteProfile): Promise<SiteProfile> {
    const rows = await db.insert(siteProfiles).values({
      id: data.id,
      domain: data.domain,
      siteType: data.siteType ?? null,
      trustStatus: data.trustStatus,
      approvedByUser: data.approvedByUser ?? false,
      notes: data.notes ?? null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }).returning();
    return rows[0] as unknown as SiteProfile;
  }

  static async updateSiteProfile(id: string, patch: Partial<SiteProfile>): Promise<void> {
    await db.update(siteProfiles).set(patch as any).where(eq(siteProfiles.id, id));
  }

  static async getSiteProfile(id: string): Promise<SiteProfile | null> {
    const rows = await db.select().from(siteProfiles).where(eq(siteProfiles.id, id));
    return (rows[0] as unknown as SiteProfile) ?? null;
  }

  static async getSiteProfileByDomain(domain: string): Promise<SiteProfile | null> {
    const rows = await db.select().from(siteProfiles).where(eq(siteProfiles.domain, domain));
    return (rows[0] as unknown as SiteProfile) ?? null;
  }

  static async upsertSiteProfile(domain: string, patch: Partial<SiteProfile> & { id: string; createdAt: Date; updatedAt: Date }): Promise<SiteProfile> {
    const existing = await SiteProfileRepository.getSiteProfileByDomain(domain);
    if (existing) {
      await SiteProfileRepository.updateSiteProfile(existing.id, { ...patch, updatedAt: patch.updatedAt });
      return { ...existing, ...patch };
    }
    return SiteProfileRepository.createSiteProfile({ domain, trustStatus: 'unreviewed', ...patch } as SiteProfile);
  }

  static async listSiteProfiles(): Promise<SiteProfile[]> {
    return db.select().from(siteProfiles).orderBy(desc(siteProfiles.updatedAt)) as unknown as SiteProfile[];
  }

  // ─── FieldProfile ─────────────────────────────────────────────────────────────

  static async createFieldProfile(data: FieldProfile): Promise<FieldProfile> {
    const rows = await db.insert(fieldProfiles).values({
      id: data.id,
      siteProfileId: data.siteProfileId ?? null,
      fieldName: data.fieldName,
      description: data.description ?? null,
      detectionType: data.detectionType,
      keywordRulesJson: data.keywordRulesJson ?? null,
      selectorRulesJson: data.selectorRulesJson ?? null,
      extractionHintsJson: data.extractionHintsJson ?? null,
      confidenceRulesJson: data.confidenceRulesJson ?? null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }).returning();
    return rows[0] as unknown as FieldProfile;
  }

  static async updateFieldProfile(id: string, patch: Partial<FieldProfile>): Promise<void> {
    await db.update(fieldProfiles).set(patch as any).where(eq(fieldProfiles.id, id));
  }

  static async listFieldProfiles(siteProfileId?: string): Promise<FieldProfile[]> {
    if (siteProfileId) {
      return db.select().from(fieldProfiles)
        .where(eq(fieldProfiles.siteProfileId, siteProfileId)) as unknown as FieldProfile[];
    }
    return db.select().from(fieldProfiles) as unknown as FieldProfile[];
  }

  // ─── AutomationRecipe ────────────────────────────────────────────────────────

  static async createAutomationRecipe(data: AutomationRecipe): Promise<AutomationRecipe> {
    const rows = await db.insert(automationRecipes).values({
      id: data.id,
      siteProfileId: data.siteProfileId ?? null,
      name: data.name,
      description: data.description ?? null,
      triggerType: data.triggerType,
      stepsJson: data.stepsJson,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }).returning();
    return rows[0] as unknown as AutomationRecipe;
  }

  static async updateAutomationRecipe(id: string, patch: Partial<AutomationRecipe>): Promise<void> {
    await db.update(automationRecipes).set(patch as any).where(eq(automationRecipes.id, id));
  }

  static async listAutomationRecipes(siteProfileId?: string): Promise<AutomationRecipe[]> {
    if (siteProfileId) {
      return db.select().from(automationRecipes)
        .where(eq(automationRecipes.siteProfileId, siteProfileId)) as unknown as AutomationRecipe[];
    }
    return db.select().from(automationRecipes) as unknown as AutomationRecipe[];
  }

  // ─── BrowserAnnotation ───────────────────────────────────────────────────────

  static async createAnnotation(data: BrowserAnnotation): Promise<BrowserAnnotation> {
    const rows = await db.insert(browserAnnotations).values({
      id: data.id,
      siteProfileId: data.siteProfileId ?? null,
      browserRunId: data.browserRunId ?? null,
      pageUrl: data.pageUrl,
      annotationType: data.annotationType,
      selectionDataJson: data.selectionDataJson,
      note: data.note ?? null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }).returning();
    return rows[0] as unknown as BrowserAnnotation;
  }

  static async listAnnotations(filters?: { siteProfileId?: string; pageUrl?: string }): Promise<BrowserAnnotation[]> {
    if (filters?.siteProfileId) {
      return db.select().from(browserAnnotations)
        .where(eq(browserAnnotations.siteProfileId, filters.siteProfileId))
        .orderBy(desc(browserAnnotations.createdAt)) as unknown as BrowserAnnotation[];
    }
    return db.select().from(browserAnnotations)
      .orderBy(desc(browserAnnotations.createdAt)) as unknown as BrowserAnnotation[];
  }

  // ─── BrowserActionButton ─────────────────────────────────────────────────────

  static async createActionButton(data: BrowserActionButton): Promise<BrowserActionButton> {
    const rows = await db.insert(browserActionButtons).values({
      id: data.id,
      siteProfileId: data.siteProfileId ?? null,
      label: data.label,
      description: data.description ?? null,
      actionType: data.actionType,
      actionPayloadJson: data.actionPayloadJson,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }).returning();
    return rows[0] as unknown as BrowserActionButton;
  }

  static async listActionButtons(siteProfileId?: string): Promise<BrowserActionButton[]> {
    if (siteProfileId) {
      return db.select().from(browserActionButtons)
        .where(eq(browserActionButtons.siteProfileId, siteProfileId)) as unknown as BrowserActionButton[];
    }
    return db.select().from(browserActionButtons) as unknown as BrowserActionButton[];
  }
}
