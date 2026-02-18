import "dotenv/config";
import express from "express";
import OpenAI from "openai";

const app = express();
const port = Number(process.env.PORT || 3000);
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error("Missing OPENAI_API_KEY. Copy .env.example to .env and set your key.");
  process.exit(1);
}

const openai = new OpenAI({ apiKey });

app.use(express.json({ limit: "10mb" }));

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
    select, button, .download {
      border-radius: 10px;
      border: 1px solid var(--border);
      padding: 10px 12px;
      font-size: 15px;
      font-family: inherit;
    }
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

    <h2>2) Edit Selected Image</h2>
    <textarea id="editPrompt" placeholder="Example: Make it sunset, add glowing fireflies, keep the same fox character."></textarea>

    <div class="row">
      <label for="size">Size:</label>
      <select id="size">
        <option value="1024x1024">1024x1024</option>
        <option value="1024x1536">1024x1536 (portrait)</option>
        <option value="1536x1024">1536x1024 (landscape)</option>
      </select>
      <button id="generate" type="button">Generate New</button>
      <button id="edit" type="button">Edit Selected</button>
      <a id="download" class="download" href="#" download="story-image.png">Download</a>
    </div>

    <div class="status" id="status"></div>
    <div class="canvas">
      <img id="preview" alt="Generated image preview" />
    </div>
    <div class="hint">Tip: click any thumbnail below to branch edits from an older version.</div>
    <div class="history" id="history"></div>
  </main>

  <script>
    const promptEl = document.getElementById("prompt");
    const editPromptEl = document.getElementById("editPrompt");
    const sizeEl = document.getElementById("size");
    const generateBtn = document.getElementById("generate");
    const editBtn = document.getElementById("edit");
    const statusEl = document.getElementById("status");
    const previewEl = document.getElementById("preview");
    const downloadEl = document.getElementById("download");
    const historyEl = document.getElementById("history");

    const imageHistory = [];
    let selectedId = null;

    function setButtons(disabled) {
      generateBtn.disabled = disabled;
      editBtn.disabled = disabled;
    }

    function selectImage(id) {
      selectedId = id;
      const item = imageHistory.find((entry) => entry.id === id);
      if (!item) return;

      const imageDataUrl = "data:image/png;base64," + item.b64;
      previewEl.src = imageDataUrl;
      previewEl.style.display = "block";
      downloadEl.href = imageDataUrl;
      downloadEl.style.display = "inline-block";

      for (const thumb of historyEl.querySelectorAll(".thumb")) {
        thumb.classList.toggle("active", thumb.dataset.id === String(id));
      }
    }

    function addToHistory({ b64, originPrompt, parentId }) {
      const id = Date.now() + Math.floor(Math.random() * 100000);
      imageHistory.unshift({ id, b64, originPrompt, parentId });

      const button = document.createElement("button");
      button.type = "button";
      button.className = "thumb";
      button.dataset.id = String(id);
      button.title = originPrompt || "Generated image";

      const img = document.createElement("img");
      img.alt = "Generated thumbnail";
      img.src = "data:image/png;base64," + b64;
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
      const size = sizeEl.value;

      if (!prompt) {
        statusEl.textContent = "Please enter a base prompt.";
        return;
      }

      setButtons(true);
      statusEl.textContent = "Generating image...";

      try {
        const data = await postJSON("/generate", { prompt, size });
        addToHistory({ b64: data.b64, originPrompt: prompt, parentId: null });
        statusEl.textContent = "Done.";
      } catch (error) {
        statusEl.textContent = "Error: " + (error?.message || "Unknown error");
      } finally {
        setButtons(false);
      }
    }

    async function editImage() {
      const prompt = editPromptEl.value.trim();
      const size = sizeEl.value;
      const base = imageHistory.find((entry) => entry.id === selectedId);

      if (!base) {
        statusEl.textContent = "Generate an image first, then select one to edit.";
        return;
      }
      if (!prompt) {
        statusEl.textContent = "Please enter what you want to change.";
        return;
      }

      setButtons(true);
      statusEl.textContent = "Editing image...";

      try {
        const data = await postJSON("/edit", {
          prompt,
          size,
          image_b64: base.b64
        });
        addToHistory({ b64: data.b64, originPrompt: prompt, parentId: base.id });
        statusEl.textContent = "Edit complete.";
      } catch (error) {
        statusEl.textContent = "Error: " + (error?.message || "Unknown error");
      } finally {
        setButtons(false);
      }
    }

    generateBtn.addEventListener("click", generateImage);
    editBtn.addEventListener("click", editImage);
  </script>
</body>
</html>`);
});

app.post("/generate", async (req, res) => {
  try {
    const { prompt, size } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: typeof size === "string" ? size : "1024x1024"
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      return res.status(502).json({ error: "No image returned by API" });
    }

    res.json({ b64 });
  } catch (error) {
    const message = error?.error?.message || error?.message || "Image generation failed";
    res.status(500).json({ error: message });
  }
});

app.post("/edit", async (req, res) => {
  try {
    const { prompt, size, image_b64 } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt" });
    }
    if (!image_b64 || typeof image_b64 !== "string") {
      return res.status(400).json({ error: "Missing source image" });
    }

    const imageBuffer = Buffer.from(image_b64, "base64");
    const imageFile = new File([imageBuffer], "source.png", { type: "image/png" });

    const result = await openai.images.edit({
      model: "gpt-image-1",
      prompt,
      image: imageFile,
      size: typeof size === "string" ? size : "1024x1024"
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      return res.status(502).json({ error: "No edited image returned by API" });
    }

    res.json({ b64 });
  } catch (error) {
    const message = error?.error?.message || error?.message || "Image edit failed";
    res.status(500).json({ error: message });
  }
});

app.listen(port, () => {
  console.log("Open http://localhost:" + port);
});
