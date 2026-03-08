export const PORT = Number(process.env.PORT || 3000);
export const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5";
export const MAX_REFERENCE_IMAGES = 4;
export const MAX_HISTORY_ITEMS = Number(process.env.MAX_HISTORY_ITEMS || 50);
export const ALLOWED_SIZES = new Set(["1024x1024", "1024x1536", "1536x1024"]);
export const ALLOWED_QUALITIES = new Set(["low", "medium", "high"]);
export const ALLOWED_OUTPUT_FORMATS = new Set(["jpeg", "png"]);
export const ALLOWED_SOURCE_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
