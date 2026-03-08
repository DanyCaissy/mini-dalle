# mini dall-e (Local App)

This app runs on your computer and lets you:
- create images from text
- include optional reference images as context for generation
- include separate optional reference images as context for editing
- edit the selected image with another prompt
- keep image history persisted between restarts
- download the result

It uses OpenAI model `gpt-image-1.5`.

## Before you start

You need:
- Windows computer
- internet connection
- OpenAI API key
- Node.js (which includes `npm`)

## Install Node.js and npm (non-technical steps)

`npm` is installed automatically when you install Node.js.

1. Open: `https://nodejs.org`
2. Download the **LTS** version.
3. Run the installer and keep clicking **Next** (default options are fine).
4. After install, fully close and reopen Terminal/PowerShell/PhpStorm.
5. Check it worked:
   - `node -v`
   - `npm -v`
6. If both commands show version numbers, you are ready.

## First-time project setup (only once)

In a terminal inside this `Dalle` folder:

1. Install project packages:
   - `npm install`
2. Create your env file:
   - copy `.env.example` and rename it to `.env`
3. Open `.env` and add your key:
   - `OPENAI_API_KEY=your_key_here`

Important:
- Do not share your `.env` file.
- Use a project with a spending limit in OpenAI billing.

## Start the app (recommended)

Use auto-restart mode so you do not need to keep restarting manually:

- `npm run dev`

Then open:
- `http://localhost:3000`

Keep that terminal window open while using the app.

## Project structure

The app is now split into backend and frontend folders:

- `server.js`: startup entrypoint
- `src/app.js`: express app wiring
- `src/routes/api.js`: API routes (`/api/*`)
- `src/services/imageService.js`: OpenAI image generation/edit logic
- `src/services/historyStore.js`: persistent history storage
- `src/config/constants.js`: shared config/constants
- `src/utils/formatOpenAIError.js`: API error formatter
- `public/index.html`: UI markup
- `public/styles.css`: UI styles
- `public/app.js`: frontend behavior/state
- `data/history.json`: local JSON database for image history

## Daily use

1. Start app: `npm run dev`
2. Open browser: `http://localhost:3000`
3. Choose size/quality/format/compression (these are saved automatically and restored after reload)
4. (Optional) Upload up to 4 reference images (PNG or JPEG) to guide generation
5. Type a prompt and click **Generate New**
6. After first image appears, the edit section appears automatically
7. (Optional) Upload edit-specific reference images (separate from generation references)
8. Type edit prompt and click **Edit Selected**
9. Click **Download** to save current image

## Data storage

- A local JSON database is used at `data/history.json`.
- Each generate/edit result is stored automatically.
- On page load, history is fetched from `/api/history` and restored in the UI.
- Max stored history entries defaults to `50` (configurable with `MAX_HISTORY_ITEMS` in `.env`).

## Size limits

Only these sizes are supported:
- `1024x1024`
- `1024x1536`
- `1536x1024`

The UI dropdown only shows supported values.

## Output settings

- Quality options: `low`, `medium`, `high`
- Format options: `jpeg`, `png`
- Compression: `0` to `100` (used for JPEG output)

## Stop / restart

- Stop app: press `Ctrl + C` in the terminal
- Start again: `npm run dev`
- If needed, you can still use `start.bat` and `stop.bat`

## Useful scripts

- `npm run dev`: start with auto-restart when files change
- `npm start`: start normally (no auto-restart)
- `npm run setup`: installs dependencies (same as `npm install`)

## Troubleshooting

If page does not open:
- check terminal for errors
- make sure app is running (`npm run dev`)
- refresh browser and confirm URL is `http://localhost:3000`

If you see API key errors:
- confirm `.env` exists in the `Dalle` folder
- confirm line is exactly `OPENAI_API_KEY=...`
- restart app after changing `.env`

If you want to change the image model:
- set `OPENAI_IMAGE_MODEL=...` in `.env` (default is `gpt-image-1.5`)

If you see a safety/policy rejection:
- sometimes benign prompts can be blocked by mistake
- try once with simpler wording
- if it repeats, use the shown Request ID when contacting OpenAI support
