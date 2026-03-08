import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("Missing OPENAI_API_KEY. Copy .env.example to .env and set your key.");
}

export const openai = new OpenAI({ apiKey });
