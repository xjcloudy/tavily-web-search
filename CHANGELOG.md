# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-08-24

### Added
- Initial release of `@deepseek-ai/tavily-web-search`
- Tavily search provider (`tavily`) for `ctx.web.search()` seam
- Model-facing `tavily_search` tool with full Tavily parameter support:
  - `queries`, `searchDepth`, `topic`, `days`, `maxResults`
  - `includeImages`, `includeImageDescriptions`, `includeAnswer`
  - `includeRawContent` (markdown/text), `includeFavicon`, `includeUsage`
  - `includeDomains`, `excludeDomains`, `country`
  - `startDate`, `endDate`
- API key resolution with DSH standard precedence:
  1. Literal `apiKey` in config
  2. Credentials service via `apiKeyEnv` reference
  3. Launch environment variable
- `cordis.patch.yml` bundle configuration for easy DSH profile integration

### Changed
- N/A (initial release)

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- API key is redacted in type definitions and never logged