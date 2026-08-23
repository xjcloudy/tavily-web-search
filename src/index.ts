/**
 * Tavily search provider for DeepSeek Harness web capability seam (ctx.web).
 * @module tavily-web-search
 */
import { Context } from '@deepseek-ai/cordis';
import { credentialRef } from '@deepseek-ai/dsh-credentials';
import { settingsNamespace } from '@deepseek-ai/dsh-settings';
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment';
import z from '@deepseek-ai/schemastery';
import { TavilySearchProvider, TavilySearchConfig } from './provider.js';
import { createTavilySearchTool } from './tool.js';

/** Cordis plugin name used by loader diagnostics. */
export const name = 'tavily-web-search';

/** The web and tools seams this provider registers into. */
export const inject = ['web', 'tools', 'settings', 'credentials'] as const;

const DEFAULT_API_KEY_ENV = 'TAVILY_API_KEY';
const DEFAULT_MAX_RESULTS = 10;

/** Settings namespace carrying this provider's configuration. */
export const TAVILY_SETTINGS_NAMESPACE: ReturnType<typeof settingsNamespace> = settingsNamespace('web-search-tavily');

/** Plugin configuration schema (validated by Cordis loader before apply). */
export const Config = z.object({
  apiKey: z.string().role('secret'),
  apiKeyEnv: z.string().role('credential-ref').default(DEFAULT_API_KEY_ENV),
  maxResults: z.number().step(1).min(1).max(50).default(DEFAULT_MAX_RESULTS),
});

/** Resolved configuration with pre-fetched API key for synchronous available() and searches. */
interface ResolvedTavilyConfig extends TavilySearchConfig {
  readonly apiKey: string;
}

/**
 * Resolve the API key once at startup using the standard DSH precedence:
 * 1. Literal `apiKey` in config (role: secret)
 * 2. Credentials service via `apiKeyEnv` reference
 * 3. Launch environment variable `apiKeyEnv`
 */
async function resolveApiKeyOnce(ctx: Context, config: TavilySearchConfig): Promise<string> {
  // 1. Literal apiKey in config
  if (config.apiKey?.length) return config.apiKey;

  const apiKeyEnv = credentialRef(config.apiKeyEnv ?? DEFAULT_API_KEY_ENV);

  // 2. Credentials service (guaranteed available because 'credentials' is in inject)
  const credentials = ctx.get('credentials');
  if (credentials !== void 0) {
    const resolved = await credentials.resolve(apiKeyEnv);
    if (resolved?.value?.length) return resolved.value;
  }

  // 3. Launch environment (process.env fallback)
  const ambient = launchEnvironmentOf(ctx).get(apiKeyEnv);
  if (ambient !== void 0 && ambient.value.length > 0) return ambient.value;

  throw new Error(
    `Tavily search has no API key for "${apiKeyEnv}"; store it through the credentials service, export it in the launching environment, or set a literal "apiKey" in the web-search-tavily config`,
  );
}

export async function apply(ctx: Context, config: TavilySearchConfig) {
  // Pre-resolve API key at startup so `available()` and searches can be synchronous.
  const resolvedApiKey = await resolveApiKeyOnce(ctx, config);

  const resolvedConfig: ResolvedTavilyConfig = {
    apiKey: resolvedApiKey,
    apiKeyEnv: config.apiKeyEnv ?? DEFAULT_API_KEY_ENV,
    maxResults: config.maxResults ?? DEFAULT_MAX_RESULTS,
  };

  const curconfig = () => resolvedConfig;

  // Register as the "tavily" provider in the WebRuntime seam.
  ctx.web.registerSearchProvider(new TavilySearchProvider(curconfig));

  // Register a model-facing `tavily_search` tool that exposes Tavily-specific parameters.
  ctx.tools.register(createTavilySearchTool(ctx, curconfig));
}

export default { name, inject, apply, Config };