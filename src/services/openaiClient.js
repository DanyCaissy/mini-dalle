import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("Missing OPENAI_API_KEY. Copy .env.example to .env and set your key.");
}

const clientCache = new Map();

function getCacheKey(key) {
  return String(key || "");
}

export function getOpenAIClient(requestApiKey) {
  const effectiveApiKey =
    typeof requestApiKey === "string" && requestApiKey.trim() ? requestApiKey.trim() : apiKey;
  const cacheKey = getCacheKey(effectiveApiKey);
  if (!clientCache.has(cacheKey)) {
    clientCache.set(cacheKey, new OpenAI({ apiKey: effectiveApiKey }));
  }
  return clientCache.get(cacheKey);
}
