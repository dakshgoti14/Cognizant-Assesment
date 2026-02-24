# Cognizant AI Assistant

> A production-quality, full-featured AI chat application built as a **Frontend Engineer Technical Assessment** for Cognizant. Delivers a ChatGPT-like experience with real-time AI responses, live web search, multi-session history, and a polished dark UI — all client-side with no backend required.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build Tool | Vite 5 |
| Styling | Tailwind CSS 3 |
| AI Model | Llama 3.3 70B via **Groq** (OpenAI-compatible API) |
| Web Search | **Tavily** Search API (AI-optimized, CORS-enabled) |
| Persistence | `localStorage` |
| Fonts | Google Fonts — Inter (UI) + JetBrains Mono (code) |

---

## Features

### AI & Search
- **Real-time AI responses** powered by Llama 3.3 70B (via Groq's free inference API)
- **Automatic web search** — the model invokes Groq's function-calling API to decide when to search; live results are fetched from Tavily and cited as clickable sources in the response
- **Visual search indicator** — "Searching the web…" replaces the typing dots with a globe icon during live searches
- **Full conversation context** sent with every request for coherent multi-turn dialogue
- **Current date injection** in the system prompt so the model always knows today's date

### Chat Interface
- **Markdown rendering** — fenced code blocks with language label + one-click copy, inline `code`, **bold**, *italic*, lists, headings, blockquotes, horizontal rules, and **clickable hyperlinks**
- **Typing indicator** with animated bouncing dots while the AI is thinking
- **Smooth fade-in-up** animation for every new message
- **Scroll-to-bottom** floating button when the user scrolls up
- **Copy response** — hover any AI bubble to copy its content
- **Error messages** displayed inline (not as alerts) with user-friendly language

### Input
- Auto-resizing textarea (52 px → 200 px)
- **Enter** to send · **Shift+Enter** for a new line
- Character limit (4 000 chars) with live counter
- Input is disabled while the AI is responding

### Multi-Session Sidebar
- **ChatGPT-style sidebar** listing all previous conversations
- Sessions grouped by date — *Starred*, *Today*, *Yesterday*, *Previous 7 Days*, *Previous 30 Days*
- **New Chat** button — skips creation if current session is already empty
- Per-session actions (appear on hover):
  - **Star / Unstar** — pins the session to the *Starred* group at the top of the sidebar
  - **Rename** — inline editable title field (Enter to save · Escape to cancel)
  - **Delete** — removes the session and switches to the next available one
- Auto-titles new sessions from the first user message (truncated to 40 characters)
- Mobile-responsive: sidebar slides in as a full-screen overlay with a backdrop
- All sessions **persist in `localStorage`** and survive page refresh

### UX & Accessibility
- Suggested prompt cards on the empty-state screen
- Relative timestamps ("Just now", "5m ago") with full date on hover
- Keyboard navigation and `aria-*` attributes throughout
- Responsive layout — mobile, tablet, and desktop

### Design
- Dark theme (Zinc palette) with Violet → Blue accent gradient
- Glass-morphism header and input panel
- Gradient user bubbles, subtle AI bubbles
- Cognizant-branded logo and favicon (SVG)

---

## Project Structure

```
src/
├── components/
│   ├── Header.tsx          # Top bar — model badge, message count, clear-chat button, mobile hamburger
│   ├── Sidebar.tsx         # Multi-session sidebar — session list, star/rename/delete, date grouping
│   ├── ChatContainer.tsx   # Scrollable message list, empty state, typing/searching indicator
│   ├── ChatMessage.tsx     # Individual message bubble — user & AI, inline markdown renderer, copy button
│   └── ChatInput.tsx       # Auto-resize textarea, send button, keyboard shortcuts, char counter
├── hooks/
│   └── useChat.ts          # Central state — sessions, current session, loading status, all session actions
├── services/
│   ├── openai.ts           # Groq API client — chat completions, tool-calling loop, error handling
│   └── tavily.ts           # Tavily Search API client — web search, result formatting, source markdown
├── types/
│   └── chat.ts             # TypeScript interfaces: Message, Session, OpenAIMessage, ToolCall, etc.
├── utils/
│   └── storage.ts          # localStorage helpers — save/load sessions, date labels, ID & timestamp utils
├── App.tsx                 # Root layout — sidebar + header + chat area wired to useChat hook
├── main.tsx                # React DOM entry point (StrictMode)
├── vite-env.d.ts           # Vite env variable type declarations
└── index.css               # Global styles, Tailwind layers, custom animations & CSS variables
```

---

## Getting Started

### Prerequisites

- **Node.js** 18 or later ([download](https://nodejs.org))
- **npm** 9 or later (bundled with Node.js)
- A free **Groq API key** — [console.groq.com](https://console.groq.com) (no credit card required)
- *(Optional)* A free **Tavily API key** for live web search — [app.tavily.com](https://app.tavily.com) (no credit card required)

### 1. Clone the repository

```bash
git clone https://github.com/dakshgoti14/Cognizant-Assesment.git
cd Cognizant-Assesment
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your keys:

```env
# Required — AI inference (free at console.groq.com)
VITE_GROQ_API_KEY=gsk_...your-key-here...

# Optional — enables live web search (free at app.tavily.com)
# Without this key the assistant answers from training data only
VITE_TAVILY_API_KEY=tvly-...your-key-here...
```

> **Security note:** Never commit `.env` to version control. It is already listed in `.gitignore`.
> Variables prefixed with `VITE_` are inlined into the browser bundle. For a production deployment, proxy API calls through a backend so keys are never exposed client-side.

### 4. Start the development server

```bash
npm run dev
```

The app opens at **http://localhost:3000**.

### 5. Build for production

```bash
npm run build     # TypeScript type-check + Vite bundle
npm run preview   # Serve the production build locally
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_GROQ_API_KEY` | **Yes** | Groq API key for Llama 3.3 70B inference |
| `VITE_TAVILY_API_KEY` | No | Tavily API key for live web search. If omitted, web search is gracefully skipped. |

---

## Architecture

### AI Request Flow

```
User sends message
       │
       ▼
useChat.sendMessage()
       │  builds OpenAIMessage[] history
       ▼
sendChatMessage()  [services/openai.ts]
       │
       ├─► POST /v1/chat/completions  (with tools: [web_search])
       │         │
       │   finish_reason = "stop"          finish_reason = "tool_calls"
       │         │                                │
       │         ▼                                ▼
       │   return content              searchWeb(query)  [services/tavily.ts]
       │                                        │
       │                               POST /search  →  results
       │                                        │
       │                               POST /v1/chat/completions  (with tool result)
       │                                        │
       │                               return content + sources markdown
       │
       ▼
useChat adds AI message to session → UI re-renders
```

### State Management

All chat state lives in the `useChat` hook (`src/hooks/useChat.ts`). React's built-in `useState` + `useCallback` + `useEffect` is sufficient — no external store (Redux / Zustand) is needed. Session data is persisted to `localStorage` on every state change via a `useEffect` that skips the initial mount.

### Tool Calling

When the model needs current information it returns `finish_reason: "tool_calls"`. The service layer executes the Tavily search, appends the results as a `tool` role message, and makes a second completion request to get the final answer. If Groq returns a 400 "Failed to call a function" error (occasional model generation issue), the service transparently retries without tools so the user always receives a response.

### Session Persistence

`src/utils/storage.ts` encapsulates all `localStorage` access. The full `Session[]` array (including `starred`, custom titles, and all messages) is serialised on every state change. A `hasLoaded` ref in `useChat` prevents overwriting stored data before the initial load completes.

### Markdown Rendering

`ChatMessage.tsx` contains a lightweight custom markdown renderer (no external library). It handles fenced code blocks, inline code, bold, italic, links, headings (H1–H3), unordered and ordered lists, blockquotes, and horizontal rules — keeping the bundle small and rendering fully controlled.

---

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with Hot Module Replacement |
| `npm run build` | TypeScript type-check + production Vite bundle |
| `npm run preview` | Serve the production build locally for verification |
| `npm run lint` | Run ESLint across all TypeScript/TSX files |


