# Tavily Web Search Plugin for DeepSeek Harness

Provides web search capability to DSH via [Tavily API](https://tavily.com) — both as a **WebSearchProvider** (for `ctx.web`) and a **model-facing tool** (`tavily_search`).

## What You Get

### 1. `tavily_search` tool
Full control over every Tavily search parameter. Call it like any other tool:

```typescript
await ctx.tools.call('tavily_search', {
  queries: ['your search query'],           // required (uses first)
  searchDepth: 'advanced',                  // 'basic' | 'advanced'
  topic: 'news',                            // 'general' | 'news' | 'finance'
  days: 7,                                  // lookback
  maxResults: 10,                           // 1–50
  includeImages: true,                      // image results as markdown
  includeAnswer: true,                      // generated answer
  includeRawContent: 'markdown',            // raw page content
  includeFavicon: true,                     // favicon URLs in results
  includeDomains: ['example.com'],          // domain filter
  excludeDomains: ['spam.com'],             // domain exclusion
  country: 'united states',                 // geo filter
  startDate: '2024-01-01',                  // ISO 8601
  endDate: '2024-12-31',
  includeUsage: true,                       // credits used
});
```

Returns the raw Tavily response with answer, results, images, and usage info.

### 2. WebSearchProvider (`tavily`)
Standard `WebSearchProvider` for `ctx.web.search()`. Auto-selects when it's the only configured provider. Used by the `web_search` tool from `dsh-tool-web`.

> Note: `web_fetch` uses a separate `WebFetchProvider` interface (not implemented here).

## Setup

### 1. Install in your DSH profile (local development)

```bash
# Clone & build
git clone <repo-url>
cd tavily-web-search && pnpm install && pnpm run build

# Link into your profile
cd ~/.dsh/profiles/your-profile
pnpm add file:/path/to/tavily-web-search
```

### 2. Add to `cordis.patch.yml`

```yaml
- id: tool-web
  disabled: false

- id: tavily-web-search
  name: '@deepseek-ai/tavily-web-search'
  config:
    apiKeyEnv: TAVILY_API_KEY
    maxResults: 10

# Make tavily the active search provider
- id: web
  config:
    searchProvider: tavily
```

### 3. Provide the API key (one of)

**A. DSH Credentials (recommended — encrypted, multi-tenant)**
```bash
# Edit the credentials file directly:
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

> **Resolution order:** literal `apiKey` → Credentials (`apiKeyEnv` ref) → `process.env[apiKeyEnv]`.
> Only the first match wins. Credentials file is preferred for production.

### 4. Restart DSH

```bash
pnpm run dev  # or whatever starts your DSH profile
```

## That's it.

Search queries go through `tavily_search` tool calls with full Tavily parameter support. `ctx.web.search()` works automatically when registered.
