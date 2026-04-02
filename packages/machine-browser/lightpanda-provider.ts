import { v4 as uuid } from 'uuid';
import type {
  MachineBrowserProvider, CreateContextOptions, NavigateResult,
  ContextMetadata, ExtractionSpec, ExtractionResult, VerificationSpec,
  VerificationResult, ActionSequence, ActionResult, WatchSnapshot, ContextStatus,
} from './provider';

/**
 * LightpandaProvider — connects to a running Lightpanda browser via CDP.
 *
 * Lightpanda is an open-source headless browser (https://github.com/lightpanda-io/browser)
 * written in Zig, exposing a CDP server on port 9222 by default.
 *
 * No Windows binary exists. Use WSL2 or Docker on Windows:
 *   docker run --rm -p 9222:9222 lightpanda/lightpanda
 *
 * Once running, this provider connects via playwright.chromium.connectOverCDP().
 */

let playwrightCore: typeof import('playwright-core') | null = null;
function getPlaywright() {
  if (!playwrightCore) playwrightCore = require('playwright-core');
  return playwrightCore!;
}

interface ContextEntry {
  browser: import('playwright-core').Browser;
  context: import('playwright-core').BrowserContext;
  page: import('playwright-core').Page;
  status: ContextStatus;
}

export class LightpandaProvider implements MachineBrowserProvider {
  readonly providerType = 'machine-lightpanda' as const;
  private cdpEndpoint: string;
  private contexts = new Map<string, ContextEntry>();
  private sharedBrowser: import('playwright-core').Browser | null = null;

  constructor(cdpEndpoint = 'http://localhost:9222') {
    this.cdpEndpoint = cdpEndpoint;
  }

  async initialize(): Promise<void> {
    const pw = getPlaywright();
    try {
      this.sharedBrowser = await pw.chromium.connectOverCDP(this.cdpEndpoint, { timeout: 5000 });
      console.log(`[LightpandaProvider] Connected to ${this.cdpEndpoint}`);
    } catch (e: any) {
      throw new Error(
        `[LightpandaProvider] Cannot connect to Lightpanda at ${this.cdpEndpoint}. ` +
        `On Windows, run: docker run --rm -p 9222:9222 lightpanda/lightpanda\n${e.message}`
      );
    }
  }

  async shutdown(): Promise<void> {
    for (const [id] of this.contexts) await this.disposeContext(id).catch(() => {});
    // Do not close the shared browser — we don't own the Lightpanda process
    this.sharedBrowser = null;
  }

  async createContext(options: CreateContextOptions = {}): Promise<string> {
    if (!this.sharedBrowser) throw new Error('LightpandaProvider not initialized');
    const context = await this.sharedBrowser.newContext({
      viewport: options.viewport ?? { width: 1280, height: 800 },
      userAgent: options.userAgent,
    });
    const page = await context.newPage();
    const id = uuid();
    this.contexts.set(id, { browser: this.sharedBrowser, context, page, status: 'idle' });
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

  async navigate(contextId: string, url: string, options: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number } = {}): Promise<NavigateResult> {
    const entry = this.requireContext(contextId);
    entry.status = 'navigating';
    try {
      const response = await entry.page.goto(url, {
        waitUntil: options.waitUntil ?? 'domcontentloaded',
        timeout: options.timeout ?? 30000,
      });
      entry.status = 'idle';
      return { url: entry.page.url(), title: await entry.page.title(), statusCode: response?.status() };
    } catch (err) {
      entry.status = 'error';
      throw err;
    }
  }

  async getMetadata(contextId: string): Promise<ContextMetadata> {
    const entry = this.requireContext(contextId);
    return { contextId, currentUrl: entry.page.url(), title: await entry.page.title().catch(() => ''), status: entry.status };
  }

  async runExtraction(contextId: string, spec: ExtractionSpec): Promise<ExtractionResult> {
    const entry = this.requireContext(contextId);
    entry.status = 'extracting';
    const fields: Record<string, unknown> = {};
    if (spec.selectors) {
      for (const [key, selector] of Object.entries(spec.selectors)) {
        try { fields[key] = await entry.page.$eval(selector, (el) => (el as HTMLElement).innerText?.trim() ?? null); }
        catch { fields[key] = null; }
      }
    }
    entry.status = 'idle';
    return { fields, confidence: Object.values(fields).filter(Boolean).length / Math.max(1, Object.keys(fields).length) };
  }

  async runVerification(contextId: string, spec: VerificationSpec): Promise<VerificationResult> {
    const entry = this.requireContext(contextId);
    const findings: string[] = [];
    let passed = true;
    for (const check of spec.checks) {
      try {
        if (check.type === 'selector-exists') {
          if (!(await entry.page.$(check.value))) { passed = false; findings.push(`selector not found: ${check.value}`); }
        } else if (check.type === 'url-match') {
          if (!entry.page.url().includes(check.value)) { passed = false; findings.push(`url mismatch: ${check.value}`); }
        }
      } catch (e: any) { passed = false; findings.push(e.message); }
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
        if (step.type === 'click' && step.selector) { await entry.page.click(step.selector); results.push({ action: `click ${step.selector}`, result: 'ok' }); }
        else if (step.type === 'fill' && step.selector) { await entry.page.fill(step.selector, step.value ?? ''); results.push({ action: `fill ${step.selector}`, result: 'ok' }); }
        else if (step.type === 'navigate' && step.url) { await entry.page.goto(step.url); results.push({ action: `navigate ${step.url}`, result: 'ok' }); }
      } catch (e: any) {
        success = false; results.push({ action: step.type, result: 'error', error: e.message });
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
    const buf = await entry.page.screenshot({ type: 'jpeg', quality: 60 }).catch(() => null);
    return {
      screenshotDataUrl: buf ? `data:image/jpeg;base64,${buf.toString('base64')}` : null,
      currentUrl: entry.page.url(),
      title: await entry.page.title().catch(() => ''),
    };
  }

  async detachWatch(_contextId: string): Promise<void> {}

  private requireContext(contextId: string): ContextEntry {
    const entry = this.contexts.get(contextId);
    if (!entry) throw new Error(`Context not found: ${contextId}`);
    if (entry.status === 'disposed') throw new Error(`Context disposed: ${contextId}`);
    return entry;
  }
}
