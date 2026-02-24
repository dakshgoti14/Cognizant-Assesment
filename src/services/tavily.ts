/**
 * tavily.ts
 *
 * Client for the Tavily Search API — an AI-optimised web search service
 * that is natively CORS-enabled, making it suitable for direct browser calls.
 *
 * This module is responsible for:
 *  - Executing a keyword query against Tavily's `/search` endpoint
 *  - Returning structured search results (title, URL, content snippet)
 *  - Formatting results into a Markdown "Sources" block that the AI response
 *    appends to the user-visible message so cited links are clickable
 *
 * Usage:
 *  This module is dynamically imported by `services/openai.ts` inside the
 *  tool-calling branch. If `VITE_TAVILY_API_KEY` is absent, `searchWeb`
 *  throws and the caller falls back to answering from training data.
 *
 * API docs: https://docs.tavily.com
 */

const TAVILY_API_URL = 'https://api.tavily.com/search';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** A single result entry returned by the Tavily search API */
export interface TavilyResult {
  /** The page title */
  title: string;
  /** The canonical URL of the source page */
  url: string;
  /** A relevant content snippet extracted from the page (up to ~500 chars used) */
  content: string;
  /** Tavily's relevance score — higher is more relevant (0–1 range) */
  score: number;
}

/** The top-level response shape returned by the Tavily `/search` endpoint */
export interface TavilyResponse {
  /** Ordered list of search results (most relevant first) */
  results: TavilyResult[];
}

// ─────────────────────────────────────────────────────────────────────────────
// API Client
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Executes a web search query via the Tavily API.
 *
 * The Tavily API accepts a `POST` request with JSON body containing the
 * query string, search depth, and max results. It returns a ranked list
 * of results with title, URL, and content snippets.
 *
 * @param query - The search string to look up (ideally ≤ 10 focused words)
 * @returns A promise resolving to a `TavilyResponse` with up to 5 results
 * @throws Error if the API key is missing or the HTTP request fails
 */
export async function searchWeb(query: string): Promise<TavilyResponse> {
  const apiKey = import.meta.env.VITE_TAVILY_API_KEY;

  // Guard: Ensure the Tavily key is configured before making a network request
  if (!apiKey || apiKey === 'your_tavily_api_key_here') {
    throw new Error('Tavily API key is not configured.');
  }

  const response = await fetch(TAVILY_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic', // "basic" is faster; "advanced" re-ranks results
      max_results: 5,
      include_answer: false, // We want raw results, not Tavily's AI-generated answer
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status}`);
  }

  return response.json() as Promise<TavilyResponse>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts an array of Tavily search results into a Markdown "Sources" block.
 *
 * The output is appended to the AI's final response string before it is
 * stored and displayed. The `ChatMessage` markdown renderer then converts
 * the `[title](url)` links into clickable `<a>` elements.
 *
 * Example output:
 * ```
 * ---
 * **Sources:**
 * 1. [BBC News — AI Regulations 2025](https://bbc.com/...)
 * 2. [Reuters — Policy Update](https://reuters.com/...)
 * ```
 *
 * @param results - The array of `TavilyResult` objects to format
 * @returns A Markdown string starting with `\n\n---\n`, or `""` if no results
 */
export function formatSourcesMarkdown(results: TavilyResult[]): string {
  if (results.length === 0) return '';

  const lines = results
    .slice(0, 5) // Cap at 5 sources to keep the response readable
    .map((r, i) => `${i + 1}. [${r.title}](${r.url})`);

  return `\n\n---\n**Sources:**\n${lines.join('\n')}`;
}
