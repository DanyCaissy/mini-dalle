import "dotenv/config";
import express from "express";
import OpenAI from "openai";

const app = express();
const port = Number(process.env.PORT || 3000);
const apiKey = process.env.OPENAI_API_KEY;
const ALLOWED_SIZES = new Set(["1024x1024", "1024x1536", "1536x1024"]);
const ALLOWED_QUALITIES = new Set(["low", "medium", "high"]);
const ALLOWED_OUTPUT_FORMATS = new Set(["jpeg", "png"]);

if (!apiKey) {
  console.error("Missing OPENAI_API_KEY. Copy .env.example to .env and set your key.");
  process.exit(1);
}

const openai = new OpenAI({ apiKey });

app.use(express.json({ limit: "10mb" }));

function formatOpenAIError(error, fallbackMessage) {
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

app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Story Image Generator + Edit</title>
  <style>
    :root {
      --bg: #f7f4ed;
      --ink: #19140f;
      --card: #fffdf9;
      --accent: #2f6f5f;
      --accent-ink: #ffffff;
      --muted: #6a6259;
      --border: #d9d0c4;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Tahoma, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 10% 0%, #ebe2d5 0, transparent 50%),
        radial-gradient(circle at 90% 100%, #efe7db 0, transparent 45%),
        var(--bg);
      min-height: 100vh;
      padding: 24px 16px;
    }
    .wrap {
      width: min(920px, 100%);
      margin: 0 auto;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 18px;
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.06);
    }
    h1 {
      margin: 0 0 8px;
      font-size: clamp(22px, 4vw, 32px);
      line-height: 1.1;
    }
    h2 {
      margin: 16px 0 8px;
      font-size: 17px;
    }
    p {
      margin: 0 0 14px;
      color: var(--muted);
    }
    textarea {
      width: 100%;
      min-height: 96px;
      resize: vertical;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px;
      font-size: 16px;
      font-family: inherit;
      color: var(--ink);
      background: #fff;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-top: 12px;
    }
    label {
      font-size: 14px;
      color: var(--muted);
    }
    select, input, button, .download {
      border-radius: 10px;
      border: 1px solid var(--border);
      padding: 10px 12px;
      font-size: 15px;
      font-family: inherit;
    }
    select, input { background: #fff; color: var(--ink); }
    input[type="number"] { width: 90px; }
    button {
      border-color: var(--accent);
      background: var(--accent);
      color: var(--accent-ink);
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .download {
      text-decoration: none;
      color: var(--ink);
      background: #fff;
      display: none;
    }
    .status {
      margin-top: 12px;
      min-height: 24px;
      color: var(--muted);
      font-size: 14px;
    }
    .canvas {
      margin-top: 14px;
      border: 1px dashed var(--border);
      border-radius: 12px;
      overflow: hidden;
      min-height: 120px;
      background: #fff;
      display: grid;
      place-items: center;
    }
    #preview {
      max-width: 100%;
      display: none;
    }
    .history {
      margin-top: 14px;
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    }
    .thumb {
      border: 2px solid transparent;
      border-radius: 10px;
      overflow: hidden;
      cursor: pointer;
      background: #fff;
      padding: 0;
    }
    .thumb.active {
      border-color: var(--accent);
    }
    .thumb img {
      display: block;
      width: 100%;
      height: 96px;
      object-fit: cover;
    }
    .hint {
      color: var(--muted);
      font-size: 13px;
      margin-top: 6px;
    }
  </style>
</head>
<body>
  <main class="wrap">
    <h1>Story Image Generator</h1>
    <p>Create a base image, then keep editing it with change prompts.</p>

    <h2>1) Generate New Image</h2>
    <textarea id="prompt" placeholder="Example: Children's storybook watercolor illustration of a small fox reading under a lantern in a snowy forest."></textarea>

    <div id="editSection" style="display:none">
      <h2>2) Edit Selected Image</h2>
      <textarea id="editPrompt" placeholder="Example: Make it sunset, add glowing fireflies, keep the same fox character."></textarea>
    </div>

    <div class="row">
      <label for="size">Size:</label>
      <select id="size">
        <option value="1024x1024">1024x1024</option>
        <option value="1024x1536">1024x1536 (portrait)</option>
        <option value="1536x1024">1536x1024 (landscape)</option>
      </select>
      <label for="quality">Quality:</label>
      <select id="quality">
        <option value="low">Low (faster)</option>
        <option value="medium">Medium</option>
        <option value="high">High (slower)</option>
      </select>
      <label for="format">Format:</label>
      <select id="format">
        <option value="jpeg">JPEG (smaller/faster)</option>
        <option value="png">PNG (larger)</option>
      </select>
      <label for="compression">Compression:</label>
      <input id="compression" type="number" min="0" max="100" step="1" value="80" />
      <button id="generate" type="button">Generate New</button>
      <button id="edit" type="button" style="display:none">Edit Selected</button>
      <a id="download" class="download" href="#" download="story-image.png">Download</a>
    </div>

    <div class="status" id="status"></div>
    <div class="hint">Supported sizes: 1024x1024, 1024x1536, 1536x1024.</div>
    <div class="hint">Compression applies to JPEG only. Your size/quality/format/compression selections are saved automatically.</div>
    <div class="canvas">
      <img id="preview" alt="Generated image preview" />
    </div>
    <div class="hint">Tip: click any thumbnail below to branch edits from an older version.</div>
    <div class="history" id="history"></div>
  </main>

    <script>
      const promptEl = document.getElementById("prompt");
      const editPromptEl = document.getElementById("editPrompt");
      const editSectionEl = document.getElementById("editSection");
      const sizeEl = document.getElementById("size");
      const qualityEl = document.getElementById("quality");
      const formatEl = document.getElementById("format");
      const compressionEl = document.getElementById("compression");
      const generateBtn = document.getElementById("generate");
      const editBtn = document.getElementById("edit");
      const statusEl = document.getElementById("status");
    const previewEl = document.getElementById("preview");
    const downloadEl = document.getElementById("download");
    const historyEl = document.getElementById("history");

    const imageHistory = [];
    let selectedId = null;
    const SETTINGS_STORAGE_KEY = "story-image-generator-settings-v1";

    function setButtons(disabled) {
      generateBtn.disabled = disabled;
      editBtn.disabled = disabled;
    }

    function setEditUIVisible(visible) {
      editSectionEl.style.display = visible ? "block" : "none";
      editBtn.style.display = visible ? "inline-block" : "none";
    }

    function getSelectedSize() {
      const size = sizeEl.value;
      const allowed = new Set(["1024x1024", "1024x1536", "1536x1024"]);
      if (!allowed.has(size)) {
        return { size: null, error: "Unsupported size. Use 1024x1024, 1024x1536, or 1536x1024." };
      }
      return { size, error: null };
    }

    function saveSettings() {
      const payload = {
        size: sizeEl.value,
        quality: qualityEl.value,
        output_format: formatEl.value,
        output_compression: compressionEl.value
      };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
    }

    function loadSettings() {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed.size === "string") sizeEl.value = parsed.size;
        if (typeof parsed.quality === "string") qualityEl.value = parsed.quality;
        if (typeof parsed.output_format === "string") formatEl.value = parsed.output_format;
        if (parsed.output_compression !== undefined && parsed.output_compression !== null) {
          compressionEl.value = String(parsed.output_compression);
        }
      } catch (_error) {
        localStorage.removeItem(SETTINGS_STORAGE_KEY);
      }
    }

    function getSelectedRenderSettings() {
      const { size, error: sizeError } = getSelectedSize();
      if (!size) {
        return { settings: null, error: sizeError };
      }
      const quality = qualityEl.value;
      const output_format = formatEl.value;
      const output_compression = Number.parseInt(compressionEl.value, 10);
      const allowedQualities = new Set(["low", "medium", "high"]);
      const allowedFormats = new Set(["jpeg", "png"]);

      if (!allowedQualities.has(quality)) {
        return { settings: null, error: "Unsupported quality. Use low, medium, or high." };
      }
      if (!allowedFormats.has(output_format)) {
        return { settings: null, error: "Unsupported format. Use jpeg or png." };
      }
      if (!Number.isInteger(output_compression) || output_compression < 0 || output_compression > 100) {
        return { settings: null, error: "Compression must be an integer from 0 to 100." };
      }

      return {
        settings: { size, quality, output_format, output_compression },
        error: null
      };
    }

    function getFileExtensionFromMimeType(mimeType) {
      if (mimeType === "image/jpeg") return "jpg";
      if (mimeType === "image/png") return "png";
      return "bin";
    }

    function selectImage(id) {
      selectedId = id;
      const item = imageHistory.find((entry) => entry.id === id);
      if (!item) return;

      setEditUIVisible(true);
      const mimeType = item.mimeType || "image/png";
      const imageDataUrl = "data:" + mimeType + ";base64," + item.b64;
      previewEl.src = imageDataUrl;
      previewEl.style.display = "block";
      downloadEl.href = imageDataUrl;
      downloadEl.download = "story-image." + getFileExtensionFromMimeType(mimeType);
      downloadEl.style.display = "inline-block";

      for (const thumb of historyEl.querySelectorAll(".thumb")) {
        thumb.classList.toggle("active", thumb.dataset.id === String(id));
      }
    }

    function addToHistory({ b64, mimeType, originPrompt, parentId }) {
      const id = Date.now() + Math.floor(Math.random() * 100000);
      imageHistory.unshift({ id, b64, mimeType, originPrompt, parentId });

      const button = document.createElement("button");
      button.type = "button";
      button.className = "thumb";
      button.dataset.id = String(id);
      button.title = originPrompt || "Generated image";

      const img = document.createElement("img");
      img.alt = "Generated thumbnail";
      img.src = "data:" + (mimeType || "image/png") + ";base64," + b64;
      button.appendChild(img);

      button.addEventListener("click", () => selectImage(id));
      historyEl.prepend(button);
      selectImage(id);
    }

    async function postJSON(path, payload) {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }
      return data;
    }

    async function generateImage() {
      const prompt = promptEl.value.trim();
      const { settings, error } = getSelectedRenderSettings();

      if (!prompt) {
        statusEl.textContent = "Please enter a base prompt.";
        return;
      }
      if (!settings) {
        statusEl.textContent = error;
        return;
      }

      saveSettings();
      setButtons(true);
      statusEl.textContent = "Generating image...";

      try {
        const data = await postJSON("/generate", { prompt, ...settings });
        addToHistory({ b64: data.b64, mimeType: data.mime_type, originPrompt: prompt, parentId: null });
        statusEl.textContent = "Done.";
      } catch (error) {
        statusEl.textContent = "Error: " + (error?.message || "Unknown error");
      } finally {
        setButtons(false);
      }
    }

    async function editImage() {
      const prompt = editPromptEl.value.trim();
      const { settings, error } = getSelectedRenderSettings();
      const base = imageHistory.find((entry) => entry.id === selectedId);

      if (!base) {
        statusEl.textContent = "Generate an image first, then select one to edit.";
        return;
      }
      if (!settings) {
        statusEl.textContent = error;
        return;
      }
      if (!prompt) {
        statusEl.textContent = "Please enter what you want to change.";
        return;
      }

      saveSettings();
      setButtons(true);
      statusEl.textContent = "Editing image...";

      try {
        const data = await postJSON("/edit", {
          prompt,
          ...settings,
          image_b64: base.b64,
          image_mime_type: base.mimeType || "image/png"
        });
        addToHistory({ b64: data.b64, mimeType: data.mime_type, originPrompt: prompt, parentId: base.id });
        statusEl.textContent = "Edit complete.";
      } catch (error) {
        statusEl.textContent = "Error: " + (error?.message || "Unknown error");
      } finally {
        setButtons(false);
      }
    }

    generateBtn.addEventListener("click", generateImage);
    editBtn.addEventListener("click", editImage);
    sizeEl.addEventListener("change", saveSettings);
    qualityEl.addEventListener("change", saveSettings);
    formatEl.addEventListener("change", saveSettings);
    compressionEl.addEventListener("change", saveSettings);
    loadSettings();
    setEditUIVisible(false);
  </script>
</body>
</html>`);
});

app.post("/generate", async (req, res) => {
  try {
    const { prompt, size, quality, output_format, output_compression } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt" });
    }

    if (!ALLOWED_SIZES.has(size)) {
      return res.status(400).json({ error: "Unsupported size. Use 1024x1024, 1024x1536, or 1536x1024." });
    }
    if (!ALLOWED_QUALITIES.has(quality)) {
      return res.status(400).json({ error: "Unsupported quality. Use low, medium, or high." });
    }
    if (!ALLOWED_OUTPUT_FORMATS.has(output_format)) {
      return res.status(400).json({ error: "Unsupported format. Use jpeg or png." });
    }
    if (output_format === "jpeg" && (!Number.isInteger(output_compression) || output_compression < 0 || output_compression > 100)) {
      return res.status(400).json({ error: "Compression must be an integer from 0 to 100." });
    }

    const generatePayload = {
      model: "gpt-image-1",
      prompt,
      size,
      quality,
      output_format
    };
    if (output_format === "jpeg") {
      generatePayload.output_compression = output_compression;
    }

    const result = await openai.images.generate(generatePayload);

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      return res.status(502).json({ error: "No image returned by API" });
    }

    const mimeType = output_format === "jpeg" ? "image/jpeg" : "image/png";
    res.json({ b64, mime_type: mimeType });
  } catch (error) {
    const message = formatOpenAIError(error, "Image generation failed");
    console.error("Generate error:", message);
    res.status(500).json({ error: message });
  }
});

app.post("/edit", async (req, res) => {
  try {
    const { prompt, size, quality, output_format, output_compression, image_b64, image_mime_type } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt" });
    }
    if (!image_b64 || typeof image_b64 !== "string") {
      return res.status(400).json({ error: "Missing source image" });
    }

    if (!ALLOWED_SIZES.has(size)) {
      return res.status(400).json({ error: "Unsupported size. Use 1024x1024, 1024x1536, or 1536x1024." });
    }
    if (!ALLOWED_QUALITIES.has(quality)) {
      return res.status(400).json({ error: "Unsupported quality. Use low, medium, or high." });
    }
    if (!ALLOWED_OUTPUT_FORMATS.has(output_format)) {
      return res.status(400).json({ error: "Unsupported format. Use jpeg or png." });
    }
    if (output_format === "jpeg" && (!Number.isInteger(output_compression) || output_compression < 0 || output_compression > 100)) {
      return res.status(400).json({ error: "Compression must be an integer from 0 to 100." });
    }

    const imageBuffer = Buffer.from(image_b64, "base64");
    const sourceMimeType = image_mime_type === "image/jpeg" ? "image/jpeg" : "image/png";
    const sourceExt = sourceMimeType === "image/jpeg" ? "jpg" : "png";
    const imageFile = new File([imageBuffer], "source." + sourceExt, { type: sourceMimeType });

    const editPayload = {
      model: "gpt-image-1",
      prompt,
      image: imageFile,
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
      return res.status(502).json({ error: "No edited image returned by API" });
    }

    const mimeType = output_format === "jpeg" ? "image/jpeg" : "image/png";
    res.json({ b64, mime_type: mimeType });
  } catch (error) {
    const message = formatOpenAIError(error, "Image edit failed");
    console.error("Edit error:", message);
    res.status(500).json({ error: message });
  }
});

app.listen(port, () => {
  console.log("Open http://localhost:" + port);
});
