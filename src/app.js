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

function buildSafeDownloadName(promptText, fallbackBaseName) {
  const normalized = String(promptText || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

  if (!normalized) {
    return fallbackBaseName;
  }

  return normalized.slice(0, 48).replace(/-+$/g, "") || fallbackBaseName;
}

function renderSharedImagePage(sharedImage) {
  const rawPromptText = sharedImage?.prompt_text || "";
  const promptText = rawPromptText ? escapeHtml(rawPromptText) : "";
  const title = promptText ? `${promptText} | Dall-E Goblin` : "Shared Image | Dall-E Goblin";
  const imageSrc = `data:${sharedImage.mime_type};base64,${sharedImage.image_b64}`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="Shared AI image from Dall-E Goblin. Generate and edit your own images with reference images and optional bring-your-own OpenAI API key support." />
  <link rel="icon" type="image/png" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/favicon.png" />
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
      border-radius: 16px;
      padding: 18px;
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.06);
    }
    h1 {
      margin: 0 0 8px;
      font-size: clamp(22px, 4vw, 32px);
      line-height: 1.1;
    }
    p { margin: 0 0 14px; color: var(--muted); line-height: 1.5; }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    .brand-link {
      display: flex;
      align-items: center;
      gap: 14px;
      color: inherit;
      text-decoration: none;
    }
    .logo {
      width: 86px;
      height: 86px;
      border-radius: 18px;
      border: 1px solid var(--border);
      display: block;
      background: radial-gradient(circle at 25% 20%, #fff5e6 0%, #f1e2cf 58%, #e3d2bc 100%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
      overflow: hidden;
      flex: 0 0 auto;
    }
    .logo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
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
    .image-actions {
      margin-top: 12px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .action-link,
    .cta a {
      display: inline-block;
      padding: 12px 16px;
      border-radius: 12px;
      background: var(--accent);
      color: var(--accent-ink);
      text-decoration: none;
      font-weight: 600;
    }
    .action-link.secondary {
      background: #fff;
      color: var(--ink);
      border: 1px solid var(--border);
    }
    .cta a {
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <main class="wrap">
    <div class="brand">
      <a class="brand-link" href="/">
        <div class="logo" aria-hidden="true">
          <img src="/images/goblin-profile-right.png" alt="Dall-E Goblin logo" />
        </div>
        <h1>Dall-E Goblin</h1>
      </a>
    </div>
    <p>Image shared with the following prompt:</p>
    ${promptText ? `<div class="prompt-card"><div class="prompt-label">Prompt</div><p>${promptText}</p></div>` : ""}
    <div class="image-frame">
      <img src="${imageSrc}" alt="Shared AI-generated image" />
    </div>
    <div class="image-actions">
      <a class="action-link secondary" href="/shared/${sharedImage.share_id}/download">Download Image</a>
    </div>
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

  app.get("/shared/:shareId/download", async (req, res) => {
    try {
      const shareId = String(req.params?.shareId || "").trim();
      if (!shareId) {
        return res.status(404).send("Not found");
      }
      const sharedImage = await getSharedImageByShareId(shareId);
      if (!sharedImage) {
        return res.status(404).send("Shared image not found");
      }

      const extension = sharedImage.mime_type === "image/jpeg" ? "jpg" : "png";
      const fileName = buildSafeDownloadName(sharedImage.prompt_text, "shared-image") + "." + extension;
      const imageBuffer = Buffer.from(sharedImage.image_b64, "base64");

      res.setHeader("Content-Type", sharedImage.mime_type);
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(imageBuffer);
    } catch (error) {
      console.error("Shared image download failed:", error);
      res.status(500).send("Failed to download shared image");
    }
  });

  app.use(express.static(path.resolve(process.cwd(), "public")));

  app.get("/", (_req, res) => {
    res.sendFile(path.resolve(process.cwd(), "public", "index.html"));
  });

  return app;
}
