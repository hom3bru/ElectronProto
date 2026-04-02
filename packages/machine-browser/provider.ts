import type { BrowserContextType } from '../shared/command';

// ─── Result types ─────────────────────────────────────────────────────────────

export interface NavigateResult {
  url: string;
  title: string;
  statusCode?: number;
}

export interface ContextMetadata {
  contextId: string;
  currentUrl: string;
  title: string;
  status: ContextStatus;
}

export interface ExtractionSpec {
  selectors?: Record<string, string>;
  patterns?: Record<string, string>;
  fieldProfiles?: Array<{ fieldName: string; selectorRules?: any; keywordRules?: any }>;
}

export interface ExtractionResult {
  fields: Record<string, unknown>;
  confidence: number;
  rawHtml?: string;
}

export interface VerificationSpec {
  checks: Array<{ type: 'selector-exists' | 'text-match' | 'url-match'; value: string }>;
}

export interface VerificationResult {
  passed: boolean;
  findings: string[];
}

export interface ActionStep {
  type: 'click' | 'fill' | 'navigate' | 'wait' | 'screenshot' | 'select';
  selector?: string;
  value?: string;
  url?: string;
  timeout?: number;
}
export interface ActionSequence {
  steps: ActionStep[];
  stopOnError?: boolean;
}

export interface ActionResult {
  success: boolean;
  steps: Array<{ action: string; result: string; error?: string }>;
}

export interface WatchSnapshot {
  screenshotDataUrl: string | null;
  currentUrl: string;
  title: string;
}

export type ContextStatus = 'idle' | 'navigating' | 'extracting' | 'acting' | 'error' | 'disposed';

export interface CreateContextOptions {
  headless?: boolean;
  partition?: string;
  userAgent?: string;
  viewport?: { width: number; height: number };
}

// ─── Provider interface ───────────────────────────────────────────────────────

export interface MachineBrowserProvider {
  readonly providerType: BrowserContextType;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  createContext(options?: CreateContextOptions): Promise<string>;
  disposeContext(contextId: string): Promise<void>;
  navigate(
    contextId: string,
    url: string,
    options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number }
  ): Promise<NavigateResult>;
  getMetadata(contextId: string): Promise<ContextMetadata>;
  runExtraction(contextId: string, spec: ExtractionSpec): Promise<ExtractionResult>;
  runVerification(contextId: string, spec: VerificationSpec): Promise<VerificationResult>;
  runActionSequence(contextId: string, sequence: ActionSequence): Promise<ActionResult>;
  getStatus(contextId: string): ContextStatus;
  attachWatch?(contextId: string): Promise<WatchSnapshot>;
  detachWatch?(contextId: string): Promise<void>;
}
