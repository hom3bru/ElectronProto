export type { MachineBrowserProvider, NavigateResult, ContextMetadata, ExtractionSpec, ExtractionResult,
  VerificationSpec, VerificationResult, ActionSequence, ActionResult, WatchSnapshot, ContextStatus,
  CreateContextOptions } from './provider';
export { PlaywrightProvider } from './playwright-provider';
export { LightpandaProvider } from './lightpanda-provider';

export function createMachineBrowserProvider(
  type: 'playwright' | 'lightpanda' = 'playwright',
  options: { lightpandaEndpoint?: string } = {}
) {
  if (type === 'lightpanda') {
    const { LightpandaProvider } = require('./lightpanda-provider');
    return new LightpandaProvider(options.lightpandaEndpoint ?? 'http://localhost:9222');
  }
  const { PlaywrightProvider } = require('./playwright-provider');
  return new PlaywrightProvider();
}
