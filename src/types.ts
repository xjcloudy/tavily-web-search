/**
 * Vocabulary for the Tavily web search provider.
 * @module tavily-web-search/types
 */
import type { WebSearchRequest } from '@deepseek-ai/dsh-web';

/** Tavily-specific search request extensions — 仅保留 provider 用的 `as TavilySearchRequest` 断言所需的字段。 */
export interface TavilySearchRequest extends WebSearchRequest {
  readonly searchDepth?: 'basic' | 'advanced';
  readonly topic?: 'general' | 'news' | 'finance';
  readonly timeRange?: 'day' | 'week' | 'month' | 'year';
  readonly includeImages?: boolean;
  readonly includeImageDescriptions?: boolean;
  readonly includeAnswer?: boolean | 'basic' | 'advanced';
  readonly includeRawContent?: false | 'markdown' | 'text';
  readonly includeFavicon?: boolean;
  readonly includeDomains?: string[];
  readonly excludeDomains?: string[];
  readonly country?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly includeUsage?: boolean;
}

/** Configuration for the Tavily search provider (resolved at startup, apiKey is guaranteed present). */
export interface TavilySearchConfig {
  readonly apiKey: string;
  readonly apiKeyEnv: string;
  readonly maxResults: number;
}