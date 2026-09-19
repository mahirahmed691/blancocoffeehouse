/* Server-side look at a today check-in before it goes public.
   Env (one is enough): OPENAI_API_KEY or GEMINI_API_KEY.
   No key, a timeout, or a fuzzy read → hold for the desk. Never a secret here. */

var OPENAI_URL = "https://api.openai.com/v1/chat/completions";
var GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

var PROMPT =
  "You judge one photograph for Blanco Coffee House. The public board is only the house: a cup, matcha, coffee, tea, pastry, cookie, cake, ice cream, the case, the counter, the room, the machine, a table with a drink, a hand on a cup. People may be in frame if the house is the subject.\n" +
  "Reject as unsafe: sexual, nude, porn, violence, gore, hate, weapons used as a threat.\n" +
  "Reject as off_topic: a selfie or portrait with no cafe, memes, screenshots, text posts, bedrooms, cars, random street, anything that is clearly not the house.\n" +
  "Hold if you cannot tell. A real cup, even a bit soft or dark, should go live. Do not hold a clear cafe shot.\n" +
  'Reply with JSON only: {"verdict":"live"|"reject"|"hold","reason":"house"|"unsafe"|"off_topic"|"uncertain"}';

function message(gate) {
  if (gate && gate.reason === "unsafe") return "the house won't put that up.";
  return "that doesn't look like the house.";
}

function configured() {
  return !!(
    process.env.OPENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY
  );
}

function parseVerdict(raw) {
  var data = raw;
  if (typeof raw === "string") {
    var trimmed = raw.trim();
    var start = trimmed.indexOf("{");
    var end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) trimmed = trimmed.slice(start, end + 1);
    try {
      data = JSON.parse(trimmed);
    } catch (err) {
      return { verdict: "hold", reason: "uncertain" };
    }
  }
  if (!data || typeof data !== "object") return { verdict: "hold", reason: "uncertain" };
  var verdict = String(data.verdict || "").toLowerCase();
  var reason = String(data.reason || "").toLowerCase();
  if (verdict === "reject" && reason === "unsafe") return { verdict: "reject", reason: "unsafe" };
  if (verdict === "reject") return { verdict: "reject", reason: "off_topic" };
  if (verdict === "live") return { verdict: "live", reason: "house" };
  return { verdict: "hold", reason: "uncertain" };
}

function looksRefused(text) {
  return /refus|i('m| am) unable|cannot (help|assist)|not able to/i.test(String(text || ""));
}

async function withTimeout(ms, work) {
  var ctrl = new AbortController();
  var timer = setTimeout(function () {
    ctrl.abort();
  }, ms);
  try {
    return await work(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function openaiJudge(image, signal) {
  var res = await fetch(OPENAI_URL, {
    method: "POST",
    signal: signal,
    headers: {
      Authorization: "Bearer " + process.env.OPENAI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 80,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "judge this check-in." },
            {
              type: "image_url",
              image_url: {
                url: "data:" + image.mime + ";base64," + image.buf.toString("base64"),
                detail: "low"
              }
            }
          ]
        }
      ]
    })
  });
  var data = await res.json().catch(function () {
    return {};
  });
  if (!res.ok) {
    var err = new Error((data && data.error && data.error.message) || "look gate failed");
    err.status = 502;
    throw err;
  }
  var choice = data.choices && data.choices[0] && data.choices[0].message;
  if (choice && choice.refusal) return { verdict: "reject", reason: "unsafe" };
  var text = choice && choice.content;
  if (looksRefused(text)) return { verdict: "reject", reason: "unsafe" };
  return parseVerdict(text);
}

async function geminiJudge(image, signal) {
  var key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  var res = await fetch(GEMINI_URL + "?key=" + encodeURIComponent(key), {
    method: "POST",
    signal: signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: PROMPT + "\njudge this check-in." },
            { inline_data: { mime_type: image.mime, data: image.buf.toString("base64") } }
          ]
        }
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 80,
        responseMimeType: "application/json"
      }
    })
  });
  var data = await res.json().catch(function () {
    return {};
  });
  if (!res.ok) {
    var err = new Error((data && data.error && data.error.message) || "look gate failed");
    err.status = 502;
    throw err;
  }
  var parts =
    data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts;
  var text = Array.isArray(parts)
    ? parts
        .map(function (part) {
          return part && part.text;
        })
        .filter(Boolean)
        .join("")
    : "";
  if (looksRefused(text) || (data.promptFeedback && data.promptFeedback.blockReason)) {
    return { verdict: "reject", reason: "unsafe" };
  }
  return parseVerdict(text);
}

async function judge(image) {
  if (!image || !image.buf) return { verdict: "hold", reason: "uncertain" };
  if (!configured()) return { verdict: "hold", reason: "no_key" };
  try {
    return await withTimeout(6000, function (signal) {
      if (process.env.OPENAI_API_KEY) return openaiJudge(image, signal);
      return geminiJudge(image, signal);
    });
  } catch (err) {
    return { verdict: "hold", reason: "uncertain" };
  }
}

module.exports = {
  configured: configured,
  judge: judge,
  message: message
};
