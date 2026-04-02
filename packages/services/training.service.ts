import { v4 as uuid } from 'uuid';
import { ok, fail, okVoid, validateId, validateNonEmpty, validateEnum, TRUST_STATUS, DETECTION_TYPE } from '../shared/command';
import type { CommandResult } from '../shared/command';
import type { SiteProfile, FieldProfile, AutomationRecipe, BrowserAnnotation, BrowserActionButton } from '../shared/types';
import type { IpcSiteProfileDetail } from '../shared/ipc-types';
import { SiteProfileRepository } from '../repositories/site-profile.repository';
import { LoggerService } from './logger.service';

function extractDomain(url: string): string {
  try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, ''); }
  catch { return url.replace(/^www\./, ''); }
}

export class TrainingService {
  static async approveSite(domain: string, notes?: string): Promise<CommandResult<SiteProfile>> {
    const domainV = validateNonEmpty(domain, 'domain', 500);
    if (!domainV.ok) return domainV;
    const cleanDomain = extractDomain(domainV.data);
    const now = new Date();
    const profile = await SiteProfileRepository.upsertSiteProfile(cleanDomain, {
      id: uuid(), trustStatus: 'trusted', approvedByUser: true,
      notes: notes ?? null, createdAt: now, updatedAt: now,
    });
    await LoggerService.logNotebookEntry('site_profile', profile.id, 'site-approved', `Site approved: ${cleanDomain}`, {
      actorType: 'human', actorName: 'User', metadataJson: { domain: cleanDomain, notes },
    });
    return ok(profile);
  }

  static async createSiteProfile(input: { domain: string; siteType?: string; trustStatus?: string; notes?: string }): Promise<CommandResult<SiteProfile>> {
    const domainV = validateNonEmpty(input.domain, 'domain', 500);
    if (!domainV.ok) return domainV;
    const now = new Date();
    const profile = await SiteProfileRepository.createSiteProfile({
      id: uuid(), domain: extractDomain(domainV.data),
      siteType: input.siteType ?? null, trustStatus: input.trustStatus ?? 'unreviewed',
      approvedByUser: false, notes: input.notes ?? null, createdAt: now, updatedAt: now,
    });
    await LoggerService.logNotebookEntry('site_profile', profile.id, 'site-profile-created', `Site profile created: ${profile.domain}`, {
      actorType: 'human', actorName: 'User', metadataJson: { domain: profile.domain, siteType: input.siteType },
    });
    return ok(profile);
  }

  static async updateSiteProfile(id: string, patch: Partial<Pick<SiteProfile, 'siteType' | 'trustStatus' | 'approvedByUser' | 'notes'>>): Promise<CommandResult<void>> {
    const idV = validateId(id, 'id');
    if (!idV.ok) return idV;
    const existing = await SiteProfileRepository.getSiteProfile(id);
    if (!existing) return fail('NOT_FOUND', `Site profile not found: ${id}`);
    await SiteProfileRepository.updateSiteProfile(id, { ...patch, updatedAt: new Date() });
    return okVoid();
  }

  static async createFieldProfile(input: {
    siteProfileId?: string; fieldName: string; description?: string; detectionType: string;
    keywordRules?: any; selectorRules?: any; extractionHints?: any;
  }): Promise<CommandResult<FieldProfile>> {
    const nameV = validateNonEmpty(input.fieldName, 'fieldName');
    if (!nameV.ok) return nameV;
    const detV = validateEnum(input.detectionType, DETECTION_TYPE, 'detectionType');
    if (!detV.ok) return detV;
    const now = new Date();
    const profile = await SiteProfileRepository.createFieldProfile({
      id: uuid(), siteProfileId: input.siteProfileId ?? null, fieldName: nameV.data,
      description: input.description ?? null, detectionType: detV.data,
      keywordRulesJson: input.keywordRules ?? null, selectorRulesJson: input.selectorRules ?? null,
      extractionHintsJson: input.extractionHints ?? null, confidenceRulesJson: null,
      createdAt: now, updatedAt: now,
    });
    await LoggerService.logNotebookEntry('field_profile', profile.id, 'field-profile-created', `Field profile created: ${profile.fieldName}`, {
      actorType: 'human', actorName: 'User',
      metadataJson: { fieldName: profile.fieldName, detectionType: profile.detectionType, siteProfileId: input.siteProfileId },
    });
    return ok(profile);
  }

  static async updateFieldKeywordRules(id: string, keywordRulesJson: any): Promise<CommandResult<void>> {
    const idV = validateId(id, 'id');
    if (!idV.ok) return idV;
    await SiteProfileRepository.updateFieldProfile(id, { keywordRulesJson, updatedAt: new Date() });
    return okVoid();
  }

  static async updateFieldSelectorRules(id: string, selectorRulesJson: any): Promise<CommandResult<void>> {
    const idV = validateId(id, 'id');
    if (!idV.ok) return idV;
    await SiteProfileRepository.updateFieldProfile(id, { selectorRulesJson, updatedAt: new Date() });
    return okVoid();
  }

  static async createAutomationRecipe(input: {
    siteProfileId?: string; name: string; description?: string; triggerType: string; steps?: any[];
  }): Promise<CommandResult<AutomationRecipe>> {
    const nameV = validateNonEmpty(input.name, 'name');
    if (!nameV.ok) return nameV;
    const now = new Date();
    const recipe = await SiteProfileRepository.createAutomationRecipe({
      id: uuid(), siteProfileId: input.siteProfileId ?? null, name: nameV.data,
      description: input.description ?? null, triggerType: input.triggerType ?? 'manual',
      stepsJson: input.steps ?? [], createdAt: now, updatedAt: now,
    });
    await LoggerService.logNotebookEntry('automation_recipe', recipe.id, 'automation-recipe-created', `Automation recipe created: ${recipe.name}`, {
      actorType: 'human', actorName: 'User', metadataJson: { name: recipe.name, triggerType: recipe.triggerType },
    });
    return ok(recipe);
  }

  static async updateAutomationRecipe(id: string, patch: Partial<Pick<AutomationRecipe, 'name' | 'description' | 'triggerType' | 'stepsJson'>>): Promise<CommandResult<void>> {
    const idV = validateId(id, 'id');
    if (!idV.ok) return idV;
    await SiteProfileRepository.updateAutomationRecipe(id, { ...patch, updatedAt: new Date() });
    return okVoid();
  }

  static async createAnnotation(input: {
    siteProfileId?: string; browserRunId?: string; pageUrl: string;
    annotationType: string; selectionData: any; note?: string;
  }): Promise<CommandResult<BrowserAnnotation>> {
    const urlV = validateNonEmpty(input.pageUrl, 'pageUrl', 2000);
    if (!urlV.ok) return urlV;
    const now = new Date();
    const annotation = await SiteProfileRepository.createAnnotation({
      id: uuid(), siteProfileId: input.siteProfileId ?? null, browserRunId: input.browserRunId ?? null,
      pageUrl: urlV.data, annotationType: input.annotationType ?? 'element',
      selectionDataJson: input.selectionData, note: input.note ?? null,
      createdAt: now, updatedAt: now,
    });
    await LoggerService.logNotebookEntry('browser_annotation', annotation.id, 'annotation-created', `Annotation created on ${annotation.pageUrl}`, {
      actorType: 'human', actorName: 'User', metadataJson: { pageUrl: annotation.pageUrl, annotationType: annotation.annotationType },
    });
    return ok(annotation);
  }

  static async createActionButton(input: {
    siteProfileId?: string; label: string; description?: string; actionType: string; actionPayload?: any;
  }): Promise<CommandResult<BrowserActionButton>> {
    const labelV = validateNonEmpty(input.label, 'label');
    if (!labelV.ok) return labelV;
    const now = new Date();
    const button = await SiteProfileRepository.createActionButton({
      id: uuid(), siteProfileId: input.siteProfileId ?? null, label: labelV.data,
      description: input.description ?? null, actionType: input.actionType ?? 'navigate',
      actionPayloadJson: input.actionPayload ?? {}, createdAt: now, updatedAt: now,
    });
    await LoggerService.logNotebookEntry('browser_action_button', button.id, 'action-button-created', `Action button created: ${button.label}`, {
      actorType: 'human', actorName: 'User', metadataJson: { label: button.label, actionType: button.actionType },
    });
    return ok(button);
  }

  static async getSiteProfileForUrl(url: string): Promise<CommandResult<IpcSiteProfileDetail | null>> {
    const domain = extractDomain(url);
    const profile = await SiteProfileRepository.getSiteProfileByDomain(domain);
    if (!profile) return ok(null);
    const [fieldProfiles, automationRecipes, annotations, actionButtons] = await Promise.all([
      SiteProfileRepository.listFieldProfiles(profile.id),
      SiteProfileRepository.listAutomationRecipes(profile.id),
      SiteProfileRepository.listAnnotations({ siteProfileId: profile.id }),
      SiteProfileRepository.listActionButtons(profile.id),
    ]);
    return ok({ ...profile, fieldProfiles, automationRecipes, annotations, actionButtons });
  }

  static async listSiteProfiles(): Promise<CommandResult<SiteProfile[]>> {
    const profiles = await SiteProfileRepository.listSiteProfiles();
    return ok(profiles);
  }

  static async getSiteProfile(id: string): Promise<CommandResult<IpcSiteProfileDetail | null>> {
    const idV = validateId(id, 'id');
    if (!idV.ok) return idV;
    const profile = await SiteProfileRepository.getSiteProfile(id);
    if (!profile) return ok(null);
    const [fieldProfiles, automationRecipes, annotations, actionButtons] = await Promise.all([
      SiteProfileRepository.listFieldProfiles(profile.id),
      SiteProfileRepository.listAutomationRecipes(profile.id),
      SiteProfileRepository.listAnnotations({ siteProfileId: profile.id }),
      SiteProfileRepository.listActionButtons(profile.id),
    ]);
    return ok({ ...profile, fieldProfiles, automationRecipes, annotations, actionButtons });
  }
}
