import {
  ALLOWED_SOURCE_MIME_TYPES,
  MAX_REFERENCE_IMAGES,
  OPENAI_IMAGE_MODEL
} from "../config/constants.js";
import { openai } from "./openaiClient.js";

function createImageFileFromBase64(imageB64, mimeType, fileStem) {
  if (typeof imageB64 !== "string" || !imageB64.trim()) {
    throw new Error("Missing source image data.");
  }
  if (!ALLOWED_SOURCE_MIME_TYPES.has(mimeType)) {
    throw new Error("Unsupported source image type. Use PNG or JPEG.");
  }

  const imageBuffer = Buffer.from(imageB64, "base64");
  if (!imageBuffer.length) {
    throw new Error("Invalid source image data.");
  }

  const extension = mimeType === "image/jpeg" ? "jpg" : "png";
  return new File([imageBuffer], fileStem + "." + extension, { type: mimeType });
}

function parseReferenceImageFiles(referenceImages) {
  if (referenceImages === undefined || referenceImages === null) {
    return [];
  }
  if (!Array.isArray(referenceImages)) {
    throw new Error("reference_images must be an array.");
  }
  if (referenceImages.length > MAX_REFERENCE_IMAGES) {
    throw new Error("You can upload up to " + MAX_REFERENCE_IMAGES + " reference images.");
  }

  return referenceImages.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error("Each reference image must be an object.");
    }

    const mimeType = item.mime_type;
    const b64 = item.b64;
    const rawName = typeof item.name === "string" ? item.name.trim() : "";
    const safeStem = (rawName || "reference-" + (index + 1)).replace(/[^a-zA-Z0-9._-]/g, "_");
    return createImageFileFromBase64(b64, mimeType, safeStem);
  });
}

export async function generateImage({
  prompt,
  size,
  quality,
  output_format,
  output_compression,
  reference_images
}) {
  const referenceImageFiles = parseReferenceImageFiles(reference_images);

  let result;
  if (referenceImageFiles.length) {
    const editPayload = {
      model: OPENAI_IMAGE_MODEL,
      prompt,
      image: referenceImageFiles.length === 1 ? referenceImageFiles[0] : referenceImageFiles,
      size,
      quality,
      output_format
    };
    if (output_format === "jpeg") {
      editPayload.output_compression = output_compression;
    }
    result = await openai.images.edit(editPayload);
  } else {
    const generatePayload = {
      model: OPENAI_IMAGE_MODEL,
      prompt,
      size,
      quality,
      output_format
    };
    if (output_format === "jpeg") {
      generatePayload.output_compression = output_compression;
    }
    result = await openai.images.generate(generatePayload);
  }

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("No image returned by API");
  }

  const mimeType = output_format === "jpeg" ? "image/jpeg" : "image/png";
  return { b64, mimeType };
}

export async function editImage({
  prompt,
  size,
  quality,
  output_format,
  output_compression,
  image_b64,
  image_mime_type,
  reference_images
}) {
  const sourceMimeType = image_mime_type || "image/png";
  const imageFile = createImageFileFromBase64(image_b64, sourceMimeType, "source");
  const referenceImageFiles = parseReferenceImageFiles(reference_images);

  const editPayload = {
    model: OPENAI_IMAGE_MODEL,
    prompt,
    image: referenceImageFiles.length ? [imageFile, ...referenceImageFiles] : imageFile,
    size,
    quality,
    output_format
  };
  if (output_format === "jpeg") {
    editPayload.output_compression = output_compression;
  }

  const result = await openai.images.edit(editPayload);
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("No edited image returned by API");
  }

  const mimeType = output_format === "jpeg" ? "image/jpeg" : "image/png";
  return { b64, mimeType };
}
