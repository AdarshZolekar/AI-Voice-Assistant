/**
 * AI Voice Assistant with Internet Access
 * Node.js / Express backend — OpenAI Assistants API + SerpAPI
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const { getJson } = require("serpapi");

// ── Startup validation ────────────────────────────────────────────────────────

const REQUIRED_ENV = ["OPENAI_API_KEY", "ASSISTANT_ID", "SERPAPI_KEY"];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`❌  Missing required env vars: ${missing.join(", ")}`);
  console.error("    Copy .env.example to .env and fill in the values.");
  process.exit(1);
}

const { OPENAI_API_KEY, ASSISTANT_ID, SERPAPI_KEY } = process.env;
const PORT = process.env.PORT || 3000;

// ── Setup ─────────────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ── Routes ────────────────────────────────────────────────────────────────────

/** Create a new conversation thread */
app.get("/thread", async (req, res) => {
  try {
    const thread = await openai.beta.threads.create();
    res.json({ threadId: thread.id });
  } catch (err) {
    console.error("Thread creation failed:", err.message);
    res.status(500).json({ error: "Could not create thread." });
  }
});

/** Send a message and stream back the assistant's reply */
app.post("/message", async (req, res) => {
  const { threadId, message } = req.body;

  if (!threadId || !message) {
    return res.status(400).json({ error: "threadId and message are required." });
  }

  try {
    // Add user message to thread
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message,
    });

    // Start a run
    let run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID,
    });

    // Poll until the run is resolved
    run = await pollRunToCompletion(threadId, run.id);

    // Fetch the latest assistant message
    const messageList = await openai.beta.threads.messages.list(threadId);
    const lastMessage = messageList.data[0];
    const reply = lastMessage?.content?.[0]?.text?.value ?? "(No response)";

    res.json({ message: reply });
  } catch (err) {
    console.error("Message handling error:", err.message);
    res.status(500).json({ error: err.message ?? "Unexpected server error." });
  }
});

// ── Run polling + tool dispatch ───────────────────────────────────────────────

/**
 * Polls a run until it reaches a terminal state, handling tool calls along the way.
 * @param {string} threadId
 * @param {string} runId
 * @returns {Promise<object>} Completed run object
 */
async function pollRunToCompletion(threadId, runId) {
  const POLL_INTERVAL_MS = 1500;
  const MAX_ATTEMPTS = 40; // 40 × 1.5s = 60s timeout

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    const run = await openai.beta.threads.runs.retrieve(threadId, runId);
    console.log(`[Run ${runId}] status: ${run.status} (attempt ${attempt + 1})`);

    switch (run.status) {
      case "completed":
        return run;

      case "requires_action":
        await handleRequiredAction(threadId, runId, run);
        break; // re-poll after submitting tool outputs

      case "failed":
      case "cancelled":
      case "expired":
        throw new Error(`Run ended with status: ${run.status}`);

      // "queued" | "in_progress" — keep polling
    }
  }

  throw new Error("Run timed out after 60 seconds.");
}

/**
 * Executes all requested tool calls and submits their outputs back to the run.
 */
async function handleRequiredAction(threadId, runId, run) {
  const toolCalls = run.required_action?.submit_tool_outputs?.tool_calls ?? [];

  const toolOutputs = await Promise.all(
    toolCalls.map(async (tc) => {
      const args = JSON.parse(tc.function.arguments);
      console.log(`[Tool] ${tc.function.name}(${JSON.stringify(args)})`);
      const output = await executeTool(tc.function.name, args);
      return { tool_call_id: tc.id, output: JSON.stringify(output) };
    })
  );

  await openai.beta.threads.runs.submitToolOutputs(threadId, runId, {
    tool_outputs: toolOutputs,
  });
}

/**
 * Dispatches a tool call to the correct implementation.
 */
async function executeTool(name, args) {
  switch (name) {
    case "getSearchResult":
      return await getSearchResult(args.query);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

/**
 * Queries SerpAPI and returns the most relevant snippet.
 */
async function getSearchResult(query) {
  try {
    const data = await getJson({
      engine: "google",
      q: query,
      api_key: SERPAPI_KEY,
    });

    // Prefer answer box, then knowledge graph, then first organic result
    const answer =
      data?.answer_box?.answer ||
      data?.answer_box?.snippet ||
      data?.knowledge_graph?.description ||
      data?.organic_results?.[0]?.snippet ||
      "No results found.";

    return { query, answer };
  } catch (err) {
    console.error("SerpAPI error:", err.message);
    return { query, error: "Search failed. Please try again." };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✅  Server running at http://localhost:${PORT}`);
});
