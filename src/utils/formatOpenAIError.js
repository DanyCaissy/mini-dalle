export function formatOpenAIError(error, fallbackMessage) {
  const status = error?.status;
  const requestId =
    error?.request_id ||
    error?.headers?.["x-request-id"] ||
    error?.response?.headers?.["x-request-id"] ||
    null;
  const apiMessage = error?.error?.message || error?.message || fallbackMessage;
  const combined = [];

  if (status) {
    combined.push("HTTP " + status + ".");
  }
  combined.push(apiMessage);

  if (requestId) {
    combined.push("Request ID: " + requestId + ".");
  }

  const text = combined.join(" ");
  const lower = text.toLowerCase();
  const looksLikeSafetyBlock =
    lower.includes("rejected by the safety system") ||
    lower.includes("safety") ||
    lower.includes("policy violation");

  if (looksLikeSafetyBlock) {
    return text + " If this prompt is benign, retry once with simpler wording. If it repeats, share the Request ID with OpenAI support.";
  }

  return text;
}
