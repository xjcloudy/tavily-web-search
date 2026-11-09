# Tavily Web Search Plugin for DeepSeek Harness

Provides web search capability to DSH via the [Tavily API](https://tavily.com) — both as a **WebSearchProvider** (for `ctx.web`, used by the `web_search` tool) and a **model-facing tool** (`tavily_search`) that exposes every Tavily parameter.

Current release: **0.2.0** (targets DSH `0.2.2-rc.1` / Electron desktop).

## What You Get

### 1. `tavily_search` tool
Full control over every Tavily search parameter:

```typescript
await ctx.tools.call('tavily_search', {
  queries: ['your search query'],           // required (1–5; uses the first)
  searchDepth: 'advanced',                  // 'basic' | 'advanced'
  topic: 'news',                            // 'general' | 'news' | 'finance'
  days: 7,                                  // lookback (days)
  maxResults: 10,                           // 1–50
  includeImages: true,                       // image results
  includeImageDescriptions: true,           // image captions
  includeAnswer: 'advanced',                 // false | true | 'basic' | 'advanced'
  includeRawContent: 'markdown',            // false | 'markdown' | 'text'
  includeFavicon: true,                     // favicon URLs
  includeDomains: ['example.com'],          // domain allow-list
  excludeDomains: ['spam.com'],             // domain block-list
  country: 'united states',                 // geo filter
  startDate: '2024-01-01',                  // ISO 8601
  endDate: '2024-12-31',
  includeUsage: true,                       // credits used
});
```

Returns the raw Tavily response (answer, results, images, usage).

### 2. WebSearchProvider (`tavily`)
Standard `WebSearchProvider` for `ctx.web.search()`. Auto-selects when it is the only configured provider. Used by the `web_search` tool from `dsh-tool-web`.

> Note: `web_fetch` uses a separate `WebFetchProvider` interface (not implemented here). In a desktop profile set `web.fetchProvider: http` so `web_fetch` keeps working alongside this provider.

## Configuration

The exported `Config` schema declares five `.volatile()` fields, so they are editable live from the settings page (see [Settings UI](#settings-ui)):

| Field | Type | Default | Notes |
|---|---|---|---|
| `enabled` | boolean | `true` | Registers the `tavily` WebSearchProvider |
| `toolEnabled` | boolean | `true` | Registers the `tavily_search` tool |
| `apiKey` | string (secret) | — | Literal key; takes precedence |
| `apiKeyEnv` | string (credential-ref) | `TAVILY_API_KEY` | Credentials ref / env var name |
| `maxResults` | number (1–50) | `10` | Default result count |

API key resolution order (first match wins): literal `apiKey` → Credentials service via `apiKeyEnv` ref → `process.env[apiKeyEnv]`. Resolution is **lazy** (per search / tool call) because the Credentials service may not be ready when the plugin applies.

## Settings UI

The host side (this package) exports a `Config` with `.volatile()` fields; DSH's `SettingsForms` service auto-derives a form keyed by the profile entry id (`tavily-web-search`).

The visible card lives in the companion package **`@deepseek-ai/dsh-client-ui-settings-tavily`** (a client bundle that injects into the `plugins.item` slot). It exposes:
- `apiKey` (secret field, backed by the Credentials service)
- `apiKeyEnv` (credential reference)
- `maxResults` (numeric, 1–50)

`enabled` / `toolEnabled` default to `true` and are not exposed in the card (no boolean field helper in the current primitives).

Save in the card writes back to the profile's `cordis.patch.yml` config block.

## Setup

### 1. Install in your DSH profile (local development)

```bash
cd tavily-web-search && pnpm install && pnpm run build

cd ~/.dsh/profiles/your-profile
pnpm add file:/path/to/tavily-web-search
```

### 2. Add to `cordis.patch.yml`

```yaml
# Enable the web tool (disabled by default in dsh-web-app)
- id: tool-web
  disabled: false

# Register tavily
- id: tavily-web-search
  name: '@deepseek-ai/tavily-web-search'
  config:
    apiKeyEnv: TAVILY_API_KEY
    maxResults: 10

# Make tavily the active search provider (and keep web_fetch working)
- id: web
  config:
    searchProvider: tavily
    fetchProvider: http
```

### 3. Install the settings card (desktop, optional but recommended)

```bash
cd ~/.dsh/profiles/your-profile
pnpm add file:/path/to/dsh-client-ui-settings-tavily
```

and add `@deepseek-ai/dsh-client-ui-settings-tavily` to `dsh.profile.bundles`.

### 4. Provide the API key (one of)

**A. DSH Credentials (recommended — encrypted, multi-tenant)**
```yaml
# ~/.dsh/.credentials.yaml
version: 1
refs:
  TAVILY_API_KEY: tvly-xxxxxxxx
```

**B. Environment variable (dev/CI only)**
```bash
export TAVILY_API_KEY=tvly-xxxxxxxx
```

**C. Literal in config (not recommended — visible in plaintext)**
```yaml
config:
  apiKey: "tvly-xxxxxxxx"
```

### 5. Restart DSH

## That's it.

`web_search` / `tavily_search` go through this provider with full Tavily parameter support. `ctx.web.search()` works automatically when registered.