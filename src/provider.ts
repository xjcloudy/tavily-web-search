/**
 * Tavily 搜索 provider，基于官方 JS SDK（@tavily/core）。
 * @module tavily-web-search/provider
 */
import { WebError } from '@deepseek-ai/dsh-web';
import type { WebSearchProvider, WebSearchRequest, WebSearchResult, WebSearchSource } from '@deepseek-ai/dsh-web';
import type { TavilySearchRequest } from './types.js';
import { tavily } from '@tavily/core';
import type { TavilySearchOptions as TavilySdkOptions, TavilySearchResponse } from '@tavily/core';

const TAVILY_PROVIDER_ID = 'tavily';

export interface TavilySearchConfig {
  /** Whether the Tavily search provider is enabled. */
  readonly enabled: boolean;
  /** Whether the tavily_search tool is registered. */
  readonly toolEnabled: boolean;
  /** 可选：已解析好的 API key（若有则无需 lazy resolve）。 */
  readonly apiKey?: string | undefined;
  /** 可选：lazy API key 解析器，search 时才调用（避开 apply 时 credentials service 未就绪的时序问题）。 */
  readonly resolveApiKey?: (() => Promise<string | undefined>) | undefined;
  /** 默认最大返回结果数。 */
  readonly maxResults: number;
  /** 对应的 credential ref 名称（诊断用）。 */
  readonly apiKeyEnv: string;
}

/**
 * 通过 @tavily/core SDK 查询 Tavily 并映射为标准化 WebSearchResult。
 *
 * 注意：provider 不持有 credential 解析逻辑，只负责把“已解析好的 apiKey”传给 SDK；
 * 具体的解析/缓存在 apply() 里做。
 *
 * 截断由 DSH seam（dsh-web 的 capSources）在 provider 返回后统一处理：
 * provider 不自行截断 sources，也不自行置 truncated —— 按契约填 false。
 */
export class TavilySearchProvider implements WebSearchProvider {
  readonly id = TAVILY_PROVIDER_ID;
  private readonly resolveConfig: () => TavilySearchConfig;

  constructor(resolveConfig: () => TavilySearchConfig) {
    this.resolveConfig = resolveConfig;
  }

  available(): boolean {
    const config = this.resolveConfig();
    // 与官方 provider 一致：只要存在 lazy 解析器即可用，不在此处实际解析 key。
    return (config.apiKey?.length ?? 0) > 0 || config.resolveApiKey !== void 0;
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    const config = this.resolveConfig();
    const apiKey = config.apiKey?.length ? config.apiKey : await config.resolveApiKey?.();
    if (!apiKey?.length) {
      throw new WebError(
        `Tavily search has no API key for "${config.apiKeyEnv}"; store it through the credentials service, export it in the launching environment, or set a literal "apiKey" in the web-search-tavily config`,
        'WEB_PROVIDER_ERROR',
      );
    }

    // 把请求扩展成 SDK 接受的选项
    const sdkReq = request as TavilySearchRequest;
    const options: TavilySdkOptions = {
      searchDepth: sdkReq.searchDepth ?? 'basic',
      topic: sdkReq.topic,
      timeRange: sdkReq.timeRange ?? undefined,
      includeImages: sdkReq.includeImages,
      includeImageDescriptions: sdkReq.includeImageDescriptions,
      includeAnswer: sdkReq.includeAnswer ?? true,
      includeRawContent: sdkReq.includeRawContent ?? false,
      includeFavicon: sdkReq.includeFavicon,
      maxResults: sdkReq.maxResults ?? config.maxResults,
      includeDomains: sdkReq.includeDomains?.length ? sdkReq.includeDomains : undefined,
      excludeDomains: sdkReq.excludeDomains?.length ? sdkReq.excludeDomains : undefined,
      country: sdkReq.country,
      startDate: sdkReq.startDate,
      endDate: sdkReq.endDate,
    } as TavilySdkOptions;

    // 传递参数；SDK 自持默认值。
    // SDK 用 axios，不接受/转发 AbortSignal，也不支持中途取消。
    // 因此不实现任何信号相关的取消逻辑；调用方若已中止，由上层抛 DOMException。
    const client = tavily({ apiKey });
    const result = await client.search(request.query, options);

    const data = result as TavilySearchResponse;

    // 映射到 WebSearchResult。URL 去重仅作防护（SDK 已按 maxResults 截断，此处不重复截断）。
    const sources: WebSearchSource[] = [];
    const seen = new Set<string>();
    for (const item of data.results) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      sources.push({
        url: item.url,
        ...(item.title ? { title: item.title } : {}),
        ...(item.content ? { snippet: item.content } : {}),
        ...(item.publishedDate ? { publishedAt: item.publishedDate } : {}),
      });
    }

    return {
      content: typeof data.answer === 'string' && data.answer.length > 0 ? data.answer : undefined,
      sources,
      truncated: false,
    };
  }
}