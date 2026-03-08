import express from "express";
import {
  ALLOWED_OUTPUT_FORMATS,
  ALLOWED_QUALITIES,
  ALLOWED_SIZES
} from "../config/constants.js";
import { editImage, generateImage } from "../services/imageService.js";
import { getAllHistory, saveHistoryItem } from "../services/historyStore.js";
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

function createHistoryItem({ b64, mimeType, prompt, parentId }) {
  return {
    id: Date.now() + Math.floor(Math.random() * 100000),
    b64,
    mime_type: mimeType,
    origin_prompt: prompt,
    parent_id: parentId ?? null,
    created_at: new Date().toISOString()
  };
}

router.get("/history", async (_req, res) => {
  try {
    const items = await getAllHistory();
    res.json({ items });
  } catch (error) {
    console.error("History read error:", error);
    res.status(500).json({ error: "Failed to load history" });
  }
});

router.post("/generate", async (req, res) => {
  try {
    const { prompt, size, quality, output_format, output_compression, reference_images } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt" });
    }
    validateRenderSettings({ size, quality, output_format, output_compression });

    const { b64, mimeType } = await generateImage({
      prompt,
      size,
      quality,
      output_format,
      output_compression,
      reference_images
    });
    const historyItem = createHistoryItem({ b64, mimeType, prompt, parentId: null });
    await saveHistoryItem(historyItem);
    res.json({ b64, mime_type: mimeType, history_item: historyItem });
  } catch (error) {
    const message = formatOpenAIError(error, "Image generation failed");
    console.error("Generate error:", message);
    res.status(500).json({ error: message });
  }
});

router.post("/edit", async (req, res) => {
  try {
    const {
      prompt,
      size,
      quality,
      output_format,
      output_compression,
      image_b64,
      image_mime_type,
      reference_images,
      parent_id
    } = req.body || {};

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt" });
    }
    if (!image_b64 || typeof image_b64 !== "string") {
      return res.status(400).json({ error: "Missing source image" });
    }
    validateRenderSettings({ size, quality, output_format, output_compression });

    const { b64, mimeType } = await editImage({
      prompt,
      size,
      quality,
      output_format,
      output_compression,
      image_b64,
      image_mime_type,
      reference_images
    });
    const historyItem = createHistoryItem({ b64, mimeType, prompt, parentId: parent_id ?? null });
    await saveHistoryItem(historyItem);
    res.json({ b64, mime_type: mimeType, history_item: historyItem });
  } catch (error) {
    const message = formatOpenAIError(error, "Image edit failed");
    console.error("Edit error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
