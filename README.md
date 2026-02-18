# Story Image Generator (Local Node App)

Minimal local app for:
- generate image
- edit selected image with follow-up prompts
- download results

Uses `gpt-image-1`.

## One-time setup

1. Install Node.js 18+.
2. Copy `.env.example` to `.env`.
3. Put your key in `.env`:
   - `OPENAI_API_KEY=...`
4. Run `start.bat` (or run `npm install` then `npm start`).

## Use

1. Open `http://localhost:3000` (starts automatically from `start.bat`).
2. Enter a base prompt and click **Generate New**.
3. Enter a change prompt and click **Edit Selected**.
4. Click any thumbnail to branch from an older version.
5. Click **Download** for the currently selected image.

## Safety

- Use a separate OpenAI project key with a spending cap.
- Never share `.env`.
