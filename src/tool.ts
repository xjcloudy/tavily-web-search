/**
 * tavily_search tool 定义。从 index.ts 中抽离，render 兼容文本与图片。
 * @module tavily-web-search/tool
 */
import { Context } from '@deepseek-ai/cordis';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { tavily, type TavilySearchOptions, type TavilySearchResponse } from '@tavily/core';
import type { TavilySearchConfig } from './provider.js';

/**
 * 把工具执行结果（即 TavilySearchResponse）渲染为一条文本 ContentBlock：
 * - 如果 SDK 返回 answer，且请求了 includeAnswer，先展示；
 * - 再列出 results（标题 + URL + 摘要 + 发布日期）；
 * - 如果请求了 includeImages，列出 images（markdown 图片链接 + 可选描述）；
 * - 如果请求了 includeUsage，展示 usage 信息；
 * - 如果请求了 includeRawContent，展示 rawContent（截断）；
 * - 如果请求了 includeFavicon，展示 favicon。
 *
 * 说明：ImageBlock.attachment 要求的是 attachment 服务的 ImageAttachmentRef，
 * 而 Tavily 只返回外部 URL，无法直接构造 ImageBlock，因此图片以 markdown
 * 链接随文本块一并输出，由 UI 自行决定是否渲染为图片。
 */
function renderToolResult(
  args: Record<string, unknown>,
  value: TavilySearchResponse,
): { type: 'text'; text: string }[] {
  const includeAnswer = args.includeAnswer !== false; // 默认 true
  const includeImages = args.includeImages === true;
  const includeUsage = args.includeUsage === true;
  const includeRawContent = args.includeRawContent !== false && args.includeRawContent !== undefined;
  const includeFavicon = args.includeFavicon === true;

  const parts: string[] = [];

  // Answer (only if requested and present)
  if (includeAnswer && value.answer) parts.push(value.answer);

  // Results
  if (value.results.length) {
    parts.push(
      'Results:\n' +
        value.results
          .map((r) => {
            const metaParts: string[] = [];
            if (r.content) metaParts.push(r.content);
            if (r.publishedDate) metaParts.push(`(${r.publishedDate})`);
            if (includeFavicon && r.favicon) metaParts.push(`[favicon](${r.favicon})`);
            const meta = metaParts.filter(Boolean).join(' ');
            let line = `- [${r.title}](${r.url})`;
            if (meta) line += ` — ${meta}`;
            // Raw content (if requested and present)
            if (includeRawContent && r.rawContent) {
              const truncated = r.rawContent.length > 500 ? r.rawContent.slice(0, 500) + '...' : r.rawContent;
              line += `\n  Raw: ${truncated}`;
            }
            return line;
          })
          .join('\n'),
    );
  } else {
    parts.push('No results found.');
  }

  // Images (only if requested)
  if (includeImages && value.images.length) {
    parts.push(
      'Images:\n' +
        value.images
          .map((img) => {
            const label = img.description ? ` - ${img.description}` : '';
            return `- ![image](${img.url})${label}`;
          })
          .join('\n'),
    );
  }

  // Usage (only if requested)
  if (includeUsage && value.usage) {
    parts.push(`Usage: ${value.usage.credits} credits`);
  }

  parts.push('Cite the relevant URLs above as markdown links in your answer.');

  return [{ type: 'text', text: parts.filter(Boolean).join('\n\n') }];
}

/**
 * 构建 tavily_search tool 的工厂函数。
 * 返回一个完整的 tool definition，供 ctx.tools.register() 使用。
 */
export function createTavilySearchTool(
  ctx: Context,
  resolveConfig: () => TavilySearchConfig,
) {
  return defineTool({
    name: 'tavily_search',
    description:
      'Search the web using Tavily API with fine-grained control over search parameters. ' +
      'Use searchDepth for basic (faster) or advanced (comprehensive) search. ' +
      'Use topic to filter by "general", "news", or "finance". ' +
      'Use days to limit results to a specific number of days. ' +
      'Use maxResults to set the maximum number of results (1–50). ' +
      'Use includeImages to get image results, includeImageDescriptions for image captions. ' +
      'Use includeAnswer to include a generated answer. ' +
      'Use includeRawContent for raw content from sources ("markdown" or "text"). ' +
      'Use includeFavicon for result favicons. ' +
      'Use includeDomains/excludeDomains to filter domains. ' +
      'Use country for geographic filtering. ' +
      'Use startDate/endDate for temporal filtering. ' +
      'Use includeUsage to get usage information. ' +
      'Returns the Tavily response: optional answer, query, responseTime, results (title/url/content/score/publishedDate/favicon), ' +
      'and images if enabled.',
    parameters: {
      queries: {
        type: 'array',
        required: true,
        items: { type: 'string' },
        description: 'Required search queries; accepts 1–5 items.',
      },
      searchDepth: {
        type: 'string',
        enum: ['basic', 'advanced'],
        description: 'Search depth: "basic" (faster) or "advanced" (comprehensive).',
      },
      topic: {
        type: 'string',
        enum: ['general', 'news', 'finance'],
        description: 'Search topic: "general", "news", or "finance".',
      },
      days: {
        type: 'number',
        description: 'Number of days to look back for search results.',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results (1–50).',
      },
      includeImages: {
        type: 'boolean',
        description: 'Whether to include image results.',
      },
      includeImageDescriptions: {
        type: 'boolean',
        description: 'Whether to include image descriptions (requires includeImages=true).',
      },
      includeAnswer: {
        oneOf: [
          { type: 'boolean', description: 'Include/exclude Tavily generated answer.' },
          {
            type: 'string',
            enum: ['basic', 'advanced'],
            description: 'Request a generated answer with a specific depth.',
          },
        ],
        description: 'Whether to include a generated answer: true/false or "basic"/"advanced".',
      },
      includeRawContent: {
        oneOf: [
          { type: 'boolean', description: 'Include/exclude raw content from sources.' },
          {
            type: 'string',
            enum: ['markdown', 'text'],
            description: 'Request raw content with a specific format.',
          },
        ],
        description: 'Whether to include raw content from sources: false, "markdown", or "text".',
      },
      includeFavicon: {
        type: 'boolean',
        description: 'Whether to include favicon URLs for each result.',
      },
      includeDomains: {
        type: 'array',
        items: { type: 'string' },
        description: 'Domains to include in search results.',
      },
      excludeDomains: {
        type: 'array',
        items: { type: 'string' },
        description: 'Domains to exclude from search results.',
      },
      country: {
        type: 'string',
        description: 'Country/region filter (e.g. "united states", "china").',
      },
      startDate: {
        type: 'string',
        description: 'Start date filter (ISO 8601, e.g. "2024-01-01").',
      },
      endDate: {
        type: 'string',
        description: 'End date filter (ISO 8601, e.g. "2024-12-31").',
      },
      includeUsage: {
        type: 'boolean',
        description: 'Whether to include usage information.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          answer: { oneOf: [{ type: 'string' }, { type: 'null' }] },
          query: { type: 'string' },
          responseTime: { type: 'number' },
          images: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                url: { type: 'string' },
                description: { oneOf: [{ type: 'string' }, { type: 'null' }] },
              },
            },
          },
          results: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                title: { type: 'string' },
                url: { type: 'string' },
                content: { type: 'string' },
                rawContent: { oneOf: [{ type: 'string' }, { type: 'null' }] },
                score: { type: 'number' },
                publishedDate: { oneOf: [{ type: 'string' }, { type: 'null' }] },
                favicon: { oneOf: [{ type: 'string' }, { type: 'null' }] },
                id: { type: 'string' },
              },
            },
          },
          favicon: { oneOf: [{ type: 'string' }, { type: 'null' }] },
          usage: { oneOf: [{ type: 'object', additionalProperties: false, properties: { credits: { type: 'number' } } }, { type: 'null' }] },
          requestId: { type: 'string' },
        },
      },
      render: renderToolResult,
    },
    async execute(args: Record<string, unknown>, exec): Promise<TavilySearchResponse> {
      const config = resolveConfig();
      const apiKey = config.apiKey?.length ? config.apiKey : await config.resolveApiKey?.();
      if (!apiKey?.length) {
        throw new Error(
          `Tavily search has no API key for "${config.apiKeyEnv}"; store it through the credentials service, export it in the launching environment, or set a literal "apiKey" in the web-search-tavily config`,
        );
      }

      // 传递参数；SDK 自行决定默认值，省略未传字段。queries 用第一个。
      const client = tavily({ apiKey });
      const queries = args.queries as string[];

      const data = await client.search(queries[0], {
        searchDepth: args.searchDepth as 'basic' | 'advanced' | undefined,
        topic: args.topic as 'general' | 'news' | 'finance' | undefined,
        days: args.days as number | undefined,
        maxResults: args.maxResults as number | undefined,
        includeImages: args.includeImages as boolean | undefined,
        includeImageDescriptions: args.includeImageDescriptions as boolean | undefined,
        includeAnswer: args.includeAnswer as boolean | 'basic' | 'advanced' | undefined,
        includeRawContent: args.includeRawContent as false | 'markdown' | 'text' | undefined,
        includeFavicon: args.includeFavicon as boolean | undefined,
        includeDomains: (args.includeDomains as string[])?.length
          ? (args.includeDomains as string[])
          : undefined,
        excludeDomains: (args.excludeDomains as string[])?.length
          ? (args.excludeDomains as string[])
          : undefined,
        country: args.country as string | undefined,
        startDate: args.startDate as string | undefined,
        endDate: args.endDate as string | undefined,
        includeUsage: args.includeUsage as boolean | undefined,
      });

      // SDK 用 axios，不接受/转发 AbortSignal，也不支持中途取消。
      // 因此不实现任何信号相关的取消逻辑；调用方若已中止，由上层抛 DOMException。

      // SDK 返回的可选字段可能是 undefined，需归一化为 null 以匹配 output schema 的 oneOf({string}, {null})。
      function normalizeNullish<T extends object>(obj: T): T {
        const out = { ...obj } as Record<string, unknown>;
        for (const k of Object.keys(out)) {
          if (out[k] === undefined) out[k] = null;
        }
        // 递归归一化数组里的对象
        for (const k of Object.keys(out)) {
          const v = out[k];
          if (Array.isArray(v)) {
            out[k] = v.map((item) =>
              item && typeof item === 'object' ? normalizeNullish(item as object) : item,
            );
          }
        }
        return out as T;
      }

      // SDK 已按 maxResults 截断 results 并返回 TavilySearchResponse 形状，归一化后透传。
      return normalizeNullish(data) as TavilySearchResponse;
    },
  });
}