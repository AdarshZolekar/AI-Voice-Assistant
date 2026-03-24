# AI Voice Assistant with Internet Access

A web-based voice assistant using the **OpenAI Assistants API** and **SerpAPI** to answer questions with real-time internet data.

---

## Features

- Voice input via Web Speech API (no extra library needed)
- Voice output via Web Speech Synthesis API
- Live internet search via SerpAPI (Google)
- Typing fallback if microphone is unavailable
- Proper async run polling (no recursive stack issues)
- Handles multiple tool calls in a single turn

---

## Setup

### 1. Prerequisites

- Node.js 18+
- An [OpenAI account](https://platform.openai.com) with API access
- A [SerpAPI account](https://serpapi.com) (free tier available)

### 2. Create your OpenAI Assistant

Go to [platform.openai.com/assistants](https://platform.openai.com/assistants) and create an assistant with this system prompt:

```
You're a general AI assistant that can help with anything. You're a voice
assistant, so keep your answers clear and concise. When the user asks about
current events or real-time data, use the getSearchResult function.
```

Add the following function tool:

```json
{
  "name": "getSearchResult",
  "description": "Returns search results from Google for a given query.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "The search query"
      }
    },
    "required": ["query"]
  }
}
```

> **Note:** Pick a model that supports function calling (e.g. `gpt-4o` or `gpt-4-turbo`).

### 3. Install and run

```bash
git clone https://github.com/YOUR_USERNAME/simple-ai-voice-assistant-openai-with-internet
cd simple-ai-voice-assistant-openai-with-internet

npm install

cp .env.example .env
# Edit .env and fill in OPENAI_API_KEY, ASSISTANT_ID, SERPAPI_KEY

npm start
```

Open `http://localhost:3000` in your browser.

---

## Project Structure

```
├── index.js          # Express server — thread management, run polling, tool dispatch
├── public/
│   └── index.html    # Frontend — voice UI, chat bubbles, Web Speech API
├── package.json
├── .env.example
└── README.md
```

---

## How It Works

```
User speaks / types
      ↓
POST /message → create thread message → start run
      ↓
Poll run status every 1.5s
      ↓
  requires_action? → call getSearchResult(query) via SerpAPI → submit outputs
      ↓
  completed? → fetch latest message → return to frontend
      ↓
Display text + speak aloud
```

---

## Known Limitations

- The Assistants API is in beta — occasional errors from OpenAI are expected.
- Web Speech API varies by browser; Chrome/Edge have the best support.
- SerpAPI free tier has a request limit per month.

---

## License

This project is open-source under the MIT License.

---

## Contributions

Contributions are welcome!

- Open an issue for bugs or feature requests

- Submit a pull request for improvements.


<p align="center">
  <a href="#top">
    <img src="https://img.shields.io/badge/%E2%AC%86-Back%20to%20Top-blue?style=for-the-badge" alt="Back to Top"/>
  </a>
</p>

