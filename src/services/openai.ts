/**
 * openai.ts
 *
 * AI inference client for the Cognizant AI Assistant.
 * Uses the Groq API — a free, OpenAI-compatible inference endpoint —
 * running the `llama-3.3-70b-versatile` model.
 *
 * Key responsibilities:
 *  1. Build and send chat completion requests (with full conversation history)
 *  2. Implement the tool-calling agentic loop for live web search:
 *       a. First request includes `web_search` tool definition
 *       b. If model returns `finish_reason: "tool_calls"`, execute Tavily search
 *       c. Second request includes search results as a `tool` role message
 *       d. Final response text is returned with Markdown source citations appended
 *  3. Handle all HTTP and network errors with user-friendly messages
 *  4. Gracefully recover from Groq's "Failed to call a function" 400 error
 *     by retrying without tools, ensuring the user always receives a response
 *
 * The `sendChatMessage` function signature stays `Promise<string>` — the
 * entire multi-turn tool loop is an implementation detail hidden from callers.
 */

import type { OpenAIMessage, ToolCall } from '../types/chat';

// Groq Inference API — free tier, OpenAI-compatible, CORS-enabled
const MODEL = 'llama-3.3-70b-versatile';
const API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_TOKENS = 1024;
const TEMPERATURE = 0.7;

function buildSystemPrompt(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return `You are a helpful, knowledgeable, and thoughtful AI assistant built by Cognizant.
You provide clear, accurate, and well-structured responses.
When writing code, always specify the programming language in code blocks.
Be concise but thorough. Use markdown formatting where appropriate.
Today's date is ${dateStr}. Your training data has a knowledge cutoff, so for very recent events you should use the web_search tool to get current information.`;
}

const WEB_SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'web_search',
    description:
      'Search the internet for current information about news, weather, stock prices, sports scores, recent events, or any topic where up-to-date data is needed. Use this when the user asks about something that may have changed after your training cutoff.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'A focused search query (max ~10 words)',
        },
      },
      required: ['query'],
    },
  },
};

export type ChatStatusCallback = (status: 'thinking' | 'searching') => void;

export class OpenAIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'OpenAIError';
  }
}

async function doFetch(messages: OpenAIMessage[], apiKey: string, includeTools: boolean): Promise<Response> {
  const body: Record<string, unknown> = {
    model: MODEL,
    messages,
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
    stream: false,
  };
  if (includeTools) {
    body.tools = [WEB_SEARCH_TOOL];
    body.tool_choice = 'auto';
  }

  return fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
}

async function handleHttpError(response: Response): Promise<never> {
  let errorMessage = `Request failed with status ${response.status}`;
  let code: string | undefined;

  try {
    const errorData = await response.json();
    console.error('[Groq] API error response:', errorData);
    errorMessage = errorData?.error?.message || errorData?.error || errorMessage;
    code = errorData?.error?.code;
  } catch {
    // Could not parse error body
  }

  if (response.status === 401) throw new OpenAIError('Invalid API key. Please check your VITE_GROQ_API_KEY in the .env file.', 401, code);
  if (response.status === 429) throw new OpenAIError('Rate limit exceeded. Please wait a moment before sending another message.', 429, code);
  if (response.status === 503) throw new OpenAIError('Service unavailable. Please try again shortly.', 503, code);
  if (response.status === 500) throw new OpenAIError('Groq is experiencing issues. Please try again shortly.', 500, code);

  throw new OpenAIError(errorMessage, response.status, code);
}

export async function sendChatMessage(
  conversationHistory: OpenAIMessage[],
  onStatusChange?: ChatStatusCallback
): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    throw new OpenAIError(
      'Groq API key is not configured. Please add your VITE_GROQ_API_KEY to the .env file.',
      401,
      'missing_api_key'
    );
  }

  const messages: OpenAIMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    ...conversationHistory,
  ];

  // ── First call ────────────────────────────────────────────
  onStatusChange?.('thinking');

  let firstResponse: Response;
  try {
    firstResponse = await doFetch(messages, apiKey, true);
  } catch (err) {
    if (err instanceof OpenAIError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Groq] fetch error:', err);
    if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('load failed') || msg.toLowerCase().includes('networkerror')) {
      throw new OpenAIError('Network error. Please check your internet connection and try again.', 0, 'network_error');
    }
    throw new OpenAIError(`Request failed: ${msg}`);
  }

  // Handle errors on the first response — must read body before calling handleHttpError
  // because the stream can only be consumed once.
  if (!firstResponse.ok) {
    // Groq returns 400 when the model fails to generate a valid tool call.
    // In that case, transparently retry without tools so the user still gets an answer.
    if (firstResponse.status === 400) {
      let errMsg = '';
      try {
        const errBody = await firstResponse.json();
        errMsg = String(errBody?.error?.message || errBody?.error || '');
        console.error('[Groq] tool call generation error:', errBody);
      } catch { /* ignore */ }

      if (errMsg.includes('Failed to call a function') || errMsg.includes('failed_generation')) {
        onStatusChange?.('thinking');
        const retryResp = await doFetch(messages, apiKey, false);
        if (!retryResp.ok) await handleHttpError(retryResp);
        const retryData = await retryResp.json();
        const retryContent: string | null = retryData?.choices?.[0]?.message?.content;
        if (typeof retryContent !== 'string' || retryContent.trim() === '') {
          throw new OpenAIError('Received an empty response from the AI. Please try again.');
        }
        return retryContent;
      }

      throw new OpenAIError(errMsg || `Request failed with status 400`, 400);
    }

    await handleHttpError(firstResponse);
  }

  const firstData = await firstResponse.json();
  const firstChoice = firstData?.choices?.[0];
  const finishReason: string = firstChoice?.finish_reason ?? 'stop';

  // ── Normal path: no tool call ─────────────────────────────
  if (finishReason !== 'tool_calls') {
    const content: string | null = firstChoice?.message?.content;
    if (typeof content !== 'string' || content.trim() === '') {
      throw new OpenAIError('Received an empty response from the AI. Please try again.');
    }
    return content;
  }

  // ── Tool-call path ────────────────────────────────────────
  const toolCall: ToolCall | undefined = firstChoice?.message?.tool_calls?.[0];
  if (!toolCall) {
    throw new OpenAIError('Model indicated tool use but provided no tool call.');
  }

  let searchQuery: string;
  try {
    searchQuery = (JSON.parse(toolCall.function.arguments) as { query: string }).query;
  } catch {
    throw new OpenAIError('Model returned an invalid search query.');
  }

  onStatusChange?.('searching');

  let searchResultContent: string;
  let sourcesMarkdown = '';
  try {
    const { searchWeb, formatSourcesMarkdown } = await import('./tavily');
    const tavilyData = await searchWeb(searchQuery);
    sourcesMarkdown = formatSourcesMarkdown(tavilyData.results);
    searchResultContent = JSON.stringify(
      tavilyData.results.slice(0, 5).map(r => ({
        title: r.title,
        url: r.url,
        content: r.content.slice(0, 500),
      }))
    );
  } catch (err) {
    console.error('[Tavily] search error:', err);
    searchResultContent = JSON.stringify({ error: 'Web search unavailable. Answer from your training knowledge.' });
  }

  onStatusChange?.('thinking');

  // Build second request: append assistant tool-call message + tool result
  const messagesWithToolResult: OpenAIMessage[] = [
    ...messages,
    {
      role: 'assistant',
      content: null,
      tool_calls: firstChoice.message.tool_calls as ToolCall[],
    },
    {
      role: 'tool',
      content: searchResultContent,
      tool_call_id: toolCall.id,
    },
  ];

  let secondResponse: Response;
  try {
    secondResponse = await doFetch(messagesWithToolResult, apiKey, false);
  } catch (err) {
    if (err instanceof OpenAIError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new OpenAIError(`Request failed: ${msg}`);
  }

  if (!secondResponse.ok) await handleHttpError(secondResponse);

  const secondData = await secondResponse.json();
  const finalContent: string | null = secondData?.choices?.[0]?.message?.content;

  if (typeof finalContent !== 'string' || finalContent.trim() === '') {
    throw new OpenAIError('Received an empty response from the AI. Please try again.');
  }

  return finalContent + sourcesMarkdown;
}
