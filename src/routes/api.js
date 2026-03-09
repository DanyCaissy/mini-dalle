import express from "express";
import {
  ALLOWED_OUTPUT_FORMATS,
  ALLOWED_QUALITIES,
  ALLOWED_SIZES,
  REQUEST_LIMIT_PER_IP
} from "../config/constants.js";
import { editImage, generateImage } from "../services/imageService.js";
import {
  countContactMessagesByIpLastDay,
  countServerDefaultRequestsByIp,
  insertContactMessage,
  insertRequestLog,
  insertSubscriptionInterestEvent,
  insertSubscriptionInterestSubmission,
  upsertApiKey
} from "../services/requestLogStore.js";
import { formatOpenAIError } from "../utils/formatOpenAIError.js";

const router = express.Router();

function validateRenderSettings({ size, quality, output_format, output_compression }) {
  if (!ALLOWED_SIZES.has(size)) {
    throw new Error("Unsupported size. Use 1024x1024, 1024x1536, or 1536x1024.");
  }
  if (!ALLOWED_QUALITIES.has(quality)) {
    throw new Error("Unsupported quality. Use low, medium, or high.");
  }
  if (!ALLOWED_OUTPUT_FORMATS.has(output_format)) {
    throw new Error("Unsupported format. Use jpeg or png.");
  }
  if (
    output_format === "jpeg" &&
    (!Number.isInteger(output_compression) || output_compression < 0 || output_compression > 100)
  ) {
    throw new Error("Compression must be an integer from 0 to 100.");
  }
}

function getClientIp(req) {
  const raw = req.ip || req.socket?.remoteAddress || "unknown";
  if (typeof raw !== "string") return "unknown";
  return raw.startsWith("::ffff:") ? raw.slice(7) : raw;
}

function getClientUserAgent(req) {
  return req.get("user-agent") || null;
}

function buildLogPayload(req, requestType, body, extra = {}) {
  return {
    ipAddress: getClientIp(req),
    requestType,
    promptText: typeof body?.prompt === "string" ? body.prompt : null,
    size: body?.size,
    quality: body?.quality,
    outputFormat: body?.output_format,
    outputCompression: body?.output_compression,
    keySource: extra.keySource || "server_default",
    apiKeyFingerprint: extra.apiKeyFingerprint || null,
    apiKeyId: Number.isInteger(extra.apiKeyId) ? extra.apiKeyId : null,
    blocked: Boolean(extra.blocked),
    errorMessage: extra.errorMessage || null,
    userAgent: req.get("user-agent") || null
  };
}

function getUserSuppliedApiKey(body) {
  if (typeof body?.user_api_key !== "string") {
    return null;
  }
  const trimmed = body.user_api_key.trim();
  return trimmed ? trimmed : null;
}

async function resolveKeyContext(req, requestType, body) {
  const userApiKey = getUserSuppliedApiKey(body);
  const ipAddress = getClientIp(req);
  if (userApiKey) {
    const upsertedKey = await upsertApiKey(userApiKey, ipAddress);
    return {
      apiKey: userApiKey,
      keySource: "user_supplied",
      apiKeyFingerprint: upsertedKey.fingerprint,
      apiKeyId: upsertedKey.id
    };
  }

  const usageCount = await countServerDefaultRequestsByIp(ipAddress);
  if (usageCount >= REQUEST_LIMIT_PER_IP) {
    await insertRequestLog(buildLogPayload(req, requestType, body, {
      keySource: "server_default",
      blocked: true,
      errorMessage: "Free usage limit exceeded; user API key required"
    }));
    const error = new Error("Free usage is over. Add your own API key to continue.");
    error.statusCode = 429;
    error.code = "TRIAL_EXPIRED_NEEDS_API_KEY";
    throw error;
  }

  const defaultApiKey = process.env.OPENAI_API_KEY || "";
  const defaultKeyRecord = await upsertApiKey(defaultApiKey, null);
  return {
    apiKey: null,
    keySource: "server_default",
    apiKeyFingerprint: defaultKeyRecord.fingerprint,
    apiKeyId: defaultKeyRecord.id
  };
}

function isUserKeyAuthFailure(error, keyContext) {
  if (!keyContext || keyContext.keySource !== "user_supplied") {
    return false;
  }
  const status = error?.status || error?.statusCode;
  const message = String(error?.error?.message || error?.message || "").toLowerCase();
  return status === 401 || message.includes("api key") || message.includes("invalid_api_key");
}

async function logErrorRequest(req, requestType, body, keyContext, errorMessage) {
  try {
    await insertRequestLog(buildLogPayload(req, requestType, body, {
      keySource: keyContext?.keySource || "server_default",
      apiKeyFingerprint: keyContext?.apiKeyFingerprint || null,
      apiKeyId: keyContext?.apiKeyId ?? null,
      blocked: false,
      errorMessage
    }));
  } catch (logError) {
    console.error("Request log write failed (" + requestType + "):", logError);
  }
}

router.post("/generate", async (req, res) => {
  let keyContext = null;
  try {
    const { prompt, size, quality, output_format, output_compression, reference_images } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt" });
    }
    validateRenderSettings({ size, quality, output_format, output_compression });
    keyContext = await resolveKeyContext(req, "generate", req.body);

    const { b64, mimeType } = await generateImage({
      apiKey: keyContext.apiKey,
      prompt,
      size,
      quality,
      output_format,
      output_compression,
      reference_images
    });
    await insertRequestLog(buildLogPayload(req, "generate", req.body, {
      keySource: keyContext.keySource,
      apiKeyFingerprint: keyContext.apiKeyFingerprint,
      apiKeyId: keyContext.apiKeyId
    }));
    res.json({ b64, mime_type: mimeType });
  } catch (error) {
    if (error?.code === "TRIAL_EXPIRED_NEEDS_API_KEY") {
      return res.status(429).json({ error: error.message, code: error.code });
    }
    if (isUserKeyAuthFailure(error, keyContext)) {
      await logErrorRequest(req, "generate", req.body, keyContext, "Invalid user API key");
      return res.status(401).json({
        error: "Your API key appears invalid. Please update it and try again.",
        code: "INVALID_USER_API_KEY"
      });
    }
    await logErrorRequest(req, "generate", req.body, keyContext, error?.message || "Generation failed");
    const message = formatOpenAIError(error, "Image generation failed");
    console.error("Generate error:", message);
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    res.status(statusCode).json({ error: message });
  }
});

router.post("/edit", async (req, res) => {
  let keyContext = null;
  try {
    const {
      prompt,
      size,
      quality,
      output_format,
      output_compression,
      image_b64,
      image_mime_type,
      reference_images
    } = req.body || {};

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt" });
    }
    if (!image_b64 || typeof image_b64 !== "string") {
      return res.status(400).json({ error: "Missing source image" });
    }
    validateRenderSettings({ size, quality, output_format, output_compression });
    keyContext = await resolveKeyContext(req, "edit", req.body);

    const { b64, mimeType } = await editImage({
      apiKey: keyContext.apiKey,
      prompt,
      size,
      quality,
      output_format,
      output_compression,
      image_b64,
      image_mime_type,
      reference_images
    });
    await insertRequestLog(buildLogPayload(req, "edit", req.body, {
      keySource: keyContext.keySource,
      apiKeyFingerprint: keyContext.apiKeyFingerprint,
      apiKeyId: keyContext.apiKeyId
    }));
    res.json({ b64, mime_type: mimeType });
  } catch (error) {
    if (error?.code === "TRIAL_EXPIRED_NEEDS_API_KEY") {
      return res.status(429).json({ error: error.message, code: error.code });
    }
    if (isUserKeyAuthFailure(error, keyContext)) {
      await logErrorRequest(req, "edit", req.body, keyContext, "Invalid user API key");
      return res.status(401).json({
        error: "Your API key appears invalid. Please update it and try again.",
        code: "INVALID_USER_API_KEY"
      });
    }
    await logErrorRequest(req, "edit", req.body, keyContext, error?.message || "Edit failed");
    const message = formatOpenAIError(error, "Image edit failed");
    console.error("Edit error:", message);
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    res.status(statusCode).json({ error: message });
  }
});

router.post("/interest/event", async (req, res) => {
  try {
    const eventType = typeof req.body?.event_type === "string" ? req.body.event_type.trim() : "";
    if (!eventType) {
      return res.status(400).json({ error: "Missing event_type" });
    }
    await insertSubscriptionInterestEvent({
      eventType,
      ipAddress: getClientIp(req),
      userAgent: getClientUserAgent(req)
    });
    res.json({ ok: true });
  } catch (error) {
    console.error("Interest event log failed:", error);
    res.status(500).json({ error: "Failed to log event" });
  }
});

router.post("/interest/submit", async (req, res) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const comments = typeof req.body?.comments === "string" ? req.body.comments.trim() : "";
    const rawWillingness = typeof req.body?.willingness === "string"
      ? req.body.willingness.trim()
      : String(req.body?.willingness ?? "").trim();
    const willingnessAmount = rawWillingness ? Number(rawWillingness) : null;

    if (!email || !email.includes("@") || email.length > 255) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }
    if (willingnessAmount !== null && (!Number.isFinite(willingnessAmount) || willingnessAmount < 0)) {
      return res.status(400).json({ error: "Willingness value must be a valid non-negative number." });
    }

    await insertSubscriptionInterestSubmission({
      email,
      willingnessAmount,
      comments,
      ipAddress: getClientIp(req),
      userAgent: getClientUserAgent(req)
    });
    res.json({ ok: true });
  } catch (error) {
    console.error("Interest submit failed:", error);
    res.status(500).json({ error: "Failed to save subscription interest" });
  }
});

router.post("/contact", async (req, res) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const honeypot = typeof req.body?.contact_website === "string" ? req.body.contact_website.trim() : "";
    const ipAddress = getClientIp(req);
    const userAgent = getClientUserAgent(req);

    // Honeypot trap: silently succeed but ignore.
    if (honeypot) {
      return res.json({ ok: true });
    }

    if (!email || !email.includes("@") || email.length > 255) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }
    if (!message || message.length < 5 || message.length > 5000) {
      return res.status(400).json({ error: "Please enter a message between 5 and 5000 characters." });
    }

    const recentCount = await countContactMessagesByIpLastDay(ipAddress);
    if (recentCount >= 3) {
      return res.status(429).json({
        error: "Contact limit reached. Please try again later.",
        code: "CONTACT_RATE_LIMIT_EXCEEDED"
      });
    }

    await insertContactMessage({
      email,
      message,
      ipAddress,
      userAgent
    });
    res.json({ ok: true });
  } catch (error) {
    console.error("Contact submit failed:", error);
    res.status(500).json({ error: "Failed to submit contact message" });
  }
});

export default router;
