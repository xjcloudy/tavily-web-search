/**
 * Tavily search provider for DeepSeek Harness web capability seam (ctx.web).
 * @module tavily-web-search
 */
import { Context } from '@deepseek-ai/cordis';
import { credentialRef } from '@deepseek-ai/dsh-credentials';
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment';
import z from '@deepseek-ai/schemastery';
import { TavilySearchProvider, TavilySearchConfig } from './provider.js';
import { createTavilySearchTool } from './tool.js';

/** Cordis plugin name used by loader diagnostics. */
export const name = 'tavily-web-search';

/** The web and tools seams this provider registers into. */
export const inject = ['web', 'tools'] as const;

const DEFAULT_API_KEY_ENV = 'TAVILY_API_KEY';
const DEFAULT_MAX_RESULTS = 10;

/** Reactive config cells a `.volatile()` field surfaces to `apply`. Each field's
 * `.get()` reads the live value; changing it in the settings page re-reads on the
 * next call, so edits apply immediately. Mirrors the official providers. */
interface ConfigCells {
  enabled: { get(): boolean };
  toolEnabled: { get(): boolean };
  apiKey: { get(): string | undefined };
  apiKeyEnv: { get(): string };
  maxResults: { get(): number };
}

/**
 * Settings namespace identifying this provider's config form. In 0.2.x the form
 * is auto-derived by the SettingsForms service from the exported `Config` schema
 * (`describe()` keeps only `.volatile()` fields) and keyed by the profile entry
 * id — `tavily-web-search` in cordis.patch.yml — so no manual registration call
 * is needed. The constant is kept for symmetry with the official providers.
 */
export const TAVILY_SETTINGS_NAMESPACE = 'web-search-tavily';

/** Plugin configuration schema (validated by Cordis loader before apply). Every
 * editable field is `.volatile()`: SettingsForms lists volatile fields only, and
 * volatile fields are what the settings page can read/write as reactive cells. */
export const Config = z.object({
  /** Whether the Tavily search provider is enabled. */
  enabled: z.boolean().default(true).volatile(),
  /** Whether the tavily_search tool is registered. */
  toolEnabled: z.boolean().default(true).volatile(),
  apiKey: z.string().role('secret').volatile(),
  apiKeyEnv: z.string().role('credential-ref').default(DEFAULT_API_KEY_ENV).volatile(),
  maxResults: z.number().step(1).min(1).max(50).default(DEFAULT_MAX_RESULTS).volatile(),
});

/** Resolved configuration handed to the provider and tool. The API key is NOT
 * resolved at startup: like the official `dsh-web-search-deepseek` provider, the
 * credentials service may not be ready when this plugin applies (an eager resolve
 * at apply time fails the whole fiber with "no API key" even though the key exists).
 * Instead we expose a lazy `resolveApiKey` thunk invoked per search / tool call. */
interface ResolvedTavilyConfig extends TavilySearchConfig {
  readonly apiKey: string | undefined;
  readonly enabled: boolean;
  readonly toolEnabled: boolean;
  readonly resolveApiKey: () => Promise<string | undefined>;
}

/**
 * Resolve the API key lazily using the standard DSH precedence:
 * 1. Literal `apiKey` in config (role: secret)
 * 2. Credentials service via `apiKeyEnv` reference
 * 3. Launch environment variable `apiKeyEnv`
 * Returns `undefined` (never throws) when none is available; callers decide how
 * to report the absence (provider search / tool execute throw a descriptive error).
 */
async function resolveApiKey(ctx: Context, config: ConfigCells): Promise<string | undefined> {
  // 1. Literal apiKey in config
  const literal = config.apiKey.get();
  if (literal?.length) return literal;

  const apiKeyEnv = credentialRef(config.apiKeyEnv.get() || DEFAULT_API_KEY_ENV);

  // 2. Credentials service (optional; fetched via ctx.get since 'credentials' is not in inject)
  const credentials = ctx.get('credentials');
  if (credentials !== void 0) {
    const resolved = await credentials.resolve(apiKeyEnv);
    if (resolved?.value?.length) return resolved.value;
  }

  // 3. Launch environment (process.env fallback)
  const ambient = launchEnvironmentOf(ctx).get(apiKeyEnv);
  if (ambient !== void 0 && ambient.value.length > 0) return ambient.value;

  return undefined;
}

export function apply(ctx: Context, config: ConfigCells) {
  // Re-read reactive cells on every call so settings-page edits apply live.
  const options = (): ResolvedTavilyConfig => ({
    apiKey: undefined,
    apiKeyEnv: config.apiKeyEnv.get() || DEFAULT_API_KEY_ENV,
    maxResults: config.maxResults.get() ?? DEFAULT_MAX_RESULTS,
    enabled: config.enabled.get() ?? true,
    toolEnabled: config.toolEnabled.get() ?? true,
    resolveApiKey: () => resolveApiKey(ctx, config),
  });

  // Register as the "tavily" provider in the WebRuntime seam (if enabled).
  if (options().enabled) {
    ctx.web.registerSearchProvider(new TavilySearchProvider(options));
  }

  // Register a model-facing `tavily_search` tool that exposes Tavily-specific parameters (if enabled).
  if (options().toolEnabled) {
    ctx.tools.register(createTavilySearchTool(ctx, options));
  }
}

export default { name, inject, apply, Config };