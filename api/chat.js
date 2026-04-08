/**
 * Vercel serverless: streaming Claude advisor with lookup_course tool (catalog from src/data).
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "../src/llm/systemPrompt.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * `vercel dev` does not always inject `.env.local` into the serverless handler process.
 * Load `.env.local` then `.env` from the repo root so local dev matches Vite behavior.
 * Production uses Vercel env vars; these files are not deployed.
 */
function loadEnvFromProjectRoot() {
  const root = join(__dirname, "..");
  for (const name of [".env.local", ".env"]) {
    const fp = join(root, name);
    if (!existsSync(fp)) continue;
    try {
      const text = readFileSync(fp, "utf8");
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (key && process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    } catch {
      /* ignore malformed env files */
    }
  }
}

loadEnvFromProjectRoot();

const CHAT_MODEL = process.env.ANTHROPIC_CHAT_MODEL || "claude-sonnet-4-20250514";

/** Map Anthropic / network errors to a short client-visible message (no secrets). */
function userSafeAdvisorError(err) {
  const status = err?.status ?? err?.statusCode;
  let apiMsg = err?.error?.error?.message || err?.error?.message || "";
  if (!apiMsg && typeof err?.message === "string") {
    const m = err.message;
    if (m.trim().startsWith("{")) {
      try {
        const j = JSON.parse(m);
        apiMsg = j?.error?.message || j?.message || "";
      } catch {
        apiMsg = m;
      }
    } else {
      apiMsg = m;
    }
  }
  const lower = String(apiMsg).toLowerCase();
  if (
    lower.includes("credit balance") ||
    lower.includes("too low to access") ||
    lower.includes("purchase credits") ||
    lower.includes("plans & billing")
  ) {
    return "Anthropic reports insufficient credits or billing is not set up. Add a plan or credits at https://console.anthropic.com/settings/plans .";
  }
  if (status === 401) {
    return "Invalid Anthropic API key (401). Check ANTHROPIC_API_KEY in .env.local.";
  }
  if (status === 429) {
    return "Anthropic rate limit reached. Wait a moment and try again.";
  }
  if (status === 400 && lower.includes("model")) {
    return `Model request rejected (400). Try setting ANTHROPIC_CHAT_MODEL in .env.local to a model your account supports (e.g. claude-sonnet-4-20250514 or claude-3-5-sonnet-20241022).`;
  }
  if (apiMsg && apiMsg.length < 220 && !/sk-ant-/i.test(apiMsg)) {
    return apiMsg;
  }
  return "Could not complete the request. Try again.";
}
const MAX_TOOL_ITERATIONS = 5;
const MAX_MESSAGES = 20;

let coursesCache = null;

function loadCourses() {
  if (!coursesCache) {
    const p = join(__dirname, "../src/data/courses.json");
    coursesCache = JSON.parse(readFileSync(p, "utf8"));
  }
  return coursesCache;
}

function normalizeCourseId(raw) {
  return String(raw || "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function lookupCourse(course_id) {
  const id = normalizeCourseId(course_id);
  const catalog = loadCourses();
  const course = catalog[id];
  if (!course) {
    return { found: false, course_id: id, message: "Not found in catalog snapshot." };
  }
  return {
    found: true,
    course: {
      id: course.id,
      title: course.title,
      cu: course.cu,
      level: course.level,
      prerequisites: course.prerequisites || [],
      mutuallyExclusive: course.mutuallyExclusive || [],
      attributes: course.attributes || [],
      tech_elective_status: course.tech_elective_status ?? null,
      tags: course.tags || [],
    },
  };
}

const LOOKUP_COURSE_TOOL = {
  name: "lookup_course",
  description:
    "Look up one course in the Penn catalog snapshot by id (e.g. CIS1210, MATH1410). Use for title, CU, prerequisites, mutual exclusions, attributes, and tech elective status.",
  input_schema: {
    type: "object",
    properties: {
      course_id: {
        type: "string",
        description: "Course id without spaces, e.g. CIS1210",
      },
    },
    required: ["course_id"],
  },
};

function toAnthropicMessages(clientMessages) {
  return clientMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Advisor is not configured (missing API key)." }));
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  const { messages: rawMessages, advisorContext } = body || {};
  if (!advisorContext || typeof advisorContext !== "object") {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Missing advisorContext" }));
    return;
  }
  if (!Array.isArray(rawMessages)) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Missing messages array" }));
    return;
  }

  const messages = rawMessages
    .slice(-MAX_MESSAGES)
    .filter(
      (m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
    )
    .map((m) => ({ role: m.role, content: m.content }));

  const system = buildSystemPrompt(JSON.stringify(advisorContext));

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  const writeSse = (obj) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  const anthropic = new Anthropic({ apiKey });
  let anthropicMessages = toAnthropicMessages(messages);

  try {
    let iterations = 0;
    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations += 1;
      const stream = anthropic.messages.stream({
        model: CHAT_MODEL,
        max_tokens: 4096,
        system,
        messages: anthropicMessages,
        tools: [LOOKUP_COURSE_TOOL],
      });

      stream.on("text", (delta) => {
        if (delta) writeSse({ type: "text", text: delta });
      });

      const finalMessage = await stream.finalMessage();

      if (finalMessage.stop_reason !== "tool_use") {
        break;
      }

      const toolUseBlocks = finalMessage.content.filter((b) => b.type === "tool_use");
      if (toolUseBlocks.length === 0) {
        break;
      }

      anthropicMessages = [...anthropicMessages, { role: "assistant", content: finalMessage.content }];

      const toolResults = [];
      for (const block of toolUseBlocks) {
        if (block.type !== "tool_use") continue;
        let result;
        if (block.name === "lookup_course") {
          const input = block.input || {};
          result = lookupCourse(input.course_id);
        } else {
          result = { error: "Unknown tool" };
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      anthropicMessages.push({ role: "user", content: toolResults });
    }

    writeSse({ type: "done" });
    res.end();
  } catch (e) {
    console.error(e);
    writeSse({
      type: "error",
      message: userSafeAdvisorError(e),
    });
    writeSse({ type: "done" });
    res.end();
  }
}
