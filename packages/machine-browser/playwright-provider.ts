import { v4 as uuid } from 'uuid';
import type {
  MachineBrowserProvider, CreateContextOptions, NavigateResult,
  ContextMetadata, ExtractionSpec, ExtractionResult, VerificationSpec,
  VerificationResult, ActionSequence, ActionResult, WatchSnapshot, ContextStatus,
} from './provider';

// Loaded lazily to avoid bundling issues in renderer process
let playwrightCore: typeof import('playwright-core') | null = null;
function getPlaywright() {
  if (!playwrightCore) {
    playwrightCore = require('playwright-core');
  }
  return playwrightCore!;
}

interface ContextEntry {
  context: import('playwright-core').BrowserContext;
  page: import('playwright-core').Page;
  status: ContextStatus;
}

export class PlaywrightProvider implements MachineBrowserProvider {
  readonly providerType = 'machine-playwright' as const;
  private browser: import('playwright-core').Browser | null = null;
  private contexts = new Map<string, ContextEntry>();

  async initialize(): Promise<void> {
    const pw = getPlaywright();
    this.browser = await pw.chromium.launch({
      headless: true,
      // Prevent Electron env vars from bleeding into the Chromium subprocess
      env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined } as Record<string, string>,
    });
    console.log('[PlaywrightProvider] Chromium launched');
  }

  async shutdown(): Promise<void> {
    for (const [id] of this.contexts) {
      await this.disposeContext(id).catch(() => {});
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
    console.log('[PlaywrightProvider] Shutdown complete');
  }

  async createContext(options: CreateContextOptions = {}): Promise<string> {
    if (!this.browser) throw new Error('PlaywrightProvider not initialized');
    const context = await this.browser.newContext({
      userAgent: options.userAgent,
      viewport: options.viewport ?? { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    const id = uuid();
    this.contexts.set(id, { context, page, status: 'idle' });
    return id;
  }

  async disposeContext(contextId: string): Promise<void> {
    const entry = this.contexts.get(contextId);
    if (!entry) return;
    entry.status = 'disposed';
    await entry.page.close().catch(() => {});
    await entry.context.close().catch(() => {});
    this.contexts.delete(contextId);
  }

  async navigate(
    contextId: string,
    url: string,
    options: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number } = {}
  ): Promise<NavigateResult> {
    const entry = this.requireContext(contextId);
    entry.status = 'navigating';
    try {
      const response = await entry.page.goto(url, {
        waitUntil: options.waitUntil ?? 'domcontentloaded',
        timeout: options.timeout ?? 30000,
      });
      entry.status = 'idle';
      return {
        url: entry.page.url(),
        title: await entry.page.title(),
        statusCode: response?.status(),
      };
    } catch (err) {
      entry.status = 'error';
      throw err;
    }
  }

  async getMetadata(contextId: string): Promise<ContextMetadata> {
    const entry = this.requireContext(contextId);
    return {
      contextId,
      currentUrl: entry.page.url(),
      title: await entry.page.title().catch(() => ''),
      status: entry.status,
    };
  }

  async runExtraction(contextId: string, spec: ExtractionSpec): Promise<ExtractionResult> {
    const entry = this.requireContext(contextId);
    entry.status = 'extracting';
    try {
      const fields: Record<string, unknown> = {};
      if (spec.selectors) {
        for (const [key, selector] of Object.entries(spec.selectors)) {
          try {
            fields[key] = await entry.page.$eval(selector, (el) => (el as HTMLElement).innerText?.trim() ?? null);
          } catch {
            fields[key] = null;
          }
        }
      }
      entry.status = 'idle';
      return { fields, confidence: Object.values(fields).filter(Boolean).length / Math.max(1, Object.keys(fields).length) };
    } catch (err) {
      entry.status = 'error';
      throw err;
    }
  }

  async runVerification(contextId: string, spec: VerificationSpec): Promise<VerificationResult> {
    const entry = this.requireContext(contextId);
    const findings: string[] = [];
    let passed = true;
    for (const check of spec.checks) {
      try {
        if (check.type === 'selector-exists') {
          const el = await entry.page.$(check.value);
          if (!el) { passed = false; findings.push(`selector not found: ${check.value}`); }
        } else if (check.type === 'url-match') {
          const matches = entry.page.url().includes(check.value);
          if (!matches) { passed = false; findings.push(`url does not contain: ${check.value}`); }
        } else if (check.type === 'text-match') {
          const content = await entry.page.content();
          if (!content.includes(check.value)) { passed = false; findings.push(`text not found: ${check.value}`); }
        }
      } catch (e: any) {
        passed = false;
        findings.push(`check error: ${e.message}`);
      }
    }
    return { passed, findings };
  }

  async runActionSequence(contextId: string, sequence: ActionSequence): Promise<ActionResult> {
    const entry = this.requireContext(contextId);
    entry.status = 'acting';
    const results: ActionResult['steps'] = [];
    let success = true;
    for (const step of sequence.steps) {
      try {
        if (step.type === 'click' && step.selector) {
          await entry.page.click(step.selector, { timeout: step.timeout ?? 10000 });
          results.push({ action: `click ${step.selector}`, result: 'ok' });
        } else if (step.type === 'fill' && step.selector && step.value !== undefined) {
          await entry.page.fill(step.selector, step.value, { timeout: step.timeout ?? 10000 });
          results.push({ action: `fill ${step.selector}`, result: 'ok' });
        } else if (step.type === 'navigate' && step.url) {
          await entry.page.goto(step.url, { timeout: step.timeout ?? 30000 });
          results.push({ action: `navigate ${step.url}`, result: 'ok' });
        } else if (step.type === 'wait') {
          await entry.page.waitForTimeout(step.timeout ?? 1000);
          results.push({ action: 'wait', result: 'ok' });
        } else if (step.type === 'select' && step.selector && step.value !== undefined) {
          await entry.page.selectOption(step.selector, step.value);
          results.push({ action: `select ${step.selector}`, result: 'ok' });
        }
      } catch (e: any) {
        success = false;
        results.push({ action: step.type, result: 'error', error: e.message });
        if (sequence.stopOnError !== false) break;
      }
    }
    entry.status = success ? 'idle' : 'error';
    return { success, steps: results };
  }

  getStatus(contextId: string): ContextStatus {
    return this.contexts.get(contextId)?.status ?? 'disposed';
  }

  async attachWatch(contextId: string): Promise<WatchSnapshot> {
    const entry = this.requireContext(contextId);
    const screenshotBuffer = await entry.page.screenshot({ type: 'jpeg', quality: 60 }).catch(() => null);
    return {
      screenshotDataUrl: screenshotBuffer ? `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}` : null,
      currentUrl: entry.page.url(),
      title: await entry.page.title().catch(() => ''),
    };
  }

  async detachWatch(_contextId: string): Promise<void> {
    // No persistent watch subscription — snapshots are on-demand
  }

  private requireContext(contextId: string): ContextEntry {
    const entry = this.contexts.get(contextId);
    if (!entry) throw new Error(`Context not found: ${contextId}`);
    if (entry.status === 'disposed') throw new Error(`Context disposed: ${contextId}`);
    return entry;
  }
}
