import express from "express";
import path from "node:path";
import apiRouter from "./routes/api.js";
import { getSharedImageByShareId } from "./services/requestLogStore.js";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function renderSharedImagePage(sharedImage) {
  const promptText = sharedImage?.prompt_text ? escapeHtml(sharedImage.prompt_text) : "";
  const title = promptText ? `${promptText} | Dall-E Goblin` : "Shared Image | Dall-E Goblin";
  const imageSrc = `data:${sharedImage.mime_type};base64,${sharedImage.image_b64}`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="Shared AI image from Dall-E Goblin. Generate and edit your own images with reference images and optional bring-your-own OpenAI API key support." />
  <style>
    :root {
      --bg: #f7f4ed;
      --card: #fffdf9;
      --ink: #19140f;
      --muted: #6a6259;
      --border: #d9d0c4;
      --accent: #2f6f5f;
      --accent-ink: #ffffff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Segoe UI", Tahoma, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 10% 0%, #ebe2d5 0, transparent 50%),
        radial-gradient(circle at 90% 100%, #efe7db 0, transparent 45%),
        var(--bg);
      padding: 24px 16px;
    }
    .wrap {
      width: min(920px, 100%);
      margin: 0 auto;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 20px;
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.06);
    }
    h1 { margin: 0 0 10px; font-size: clamp(28px, 5vw, 40px); }
    p { margin: 0 0 14px; color: var(--muted); line-height: 1.5; }
    .brand-link {
      color: inherit;
      text-decoration: none;
    }
    .image-frame {
      margin-top: 18px;
      border: 1px solid var(--border);
      border-radius: 14px;
      overflow: hidden;
      background: #fff;
    }
    .image-frame img {
      display: block;
      width: 100%;
      height: auto;
    }
    .prompt-card {
      margin-top: 16px;
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: #faf8f3;
    }
    .prompt-label {
      margin: 0 0 6px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .cta {
      margin-top: 20px;
      padding-top: 18px;
      border-top: 1px solid var(--border);
    }
    .cta a {
      display: inline-block;
      margin-top: 8px;
      padding: 12px 16px;
      border-radius: 12px;
      background: var(--accent);
      color: var(--accent-ink);
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <main class="wrap">
    <a class="brand-link" href="/"><h1>Dall-E Goblin</h1></a>
    <p>Shared image created with Dall-E Goblin.</p>
    <div class="image-frame">
      <img src="${imageSrc}" alt="Shared AI-generated image" />
    </div>
    ${promptText ? `<div class="prompt-card"><div class="prompt-label">Prompt</div><p>${promptText}</p></div>` : ""}
    <div class="cta">
      <p>Want to generate or edit your own images with prompts, uploads, and reference images?</p>
      <a href="/">Create your own images</a>
    </div>
  </main>
</body>
</html>`;
}

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);

  app.use(express.json({ limit: "30mb" }));
  app.use("/images", express.static(path.resolve(process.cwd(), "images")));
  app.use("/api", apiRouter);

  app.get("/shared/:shareId", async (req, res) => {
    try {
      const shareId = String(req.params?.shareId || "").trim();
      if (!shareId) {
        return res.status(404).send("Not found");
      }
      const sharedImage = await getSharedImageByShareId(shareId);
      if (!sharedImage) {
        return res.status(404).send("Shared image not found");
      }
      res.type("html").send(renderSharedImagePage(sharedImage));
    } catch (error) {
      console.error("Shared image page failed:", error);
      res.status(500).send("Failed to load shared image");
    }
  });

  app.use(express.static(path.resolve(process.cwd(), "public")));

  app.get("/", (_req, res) => {
    res.sendFile(path.resolve(process.cwd(), "public", "index.html"));
  });

  return app;
}
