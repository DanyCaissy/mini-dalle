# Dall-E Goblin

AI image generator/editor built with a Node/Express backend and vanilla frontend.

## Stack

- Node.js (ES modules)
- Express
- OpenAI Images API (`gpt-image-1.5`)
- MySQL (request logging, key tracking, contact + interest data)
- Browser IndexedDB (per-user image history, 10 per tab)

## Project Structure

- `server.js` - app bootstrap
- `src/app.js` - Express app setup
- `src/routes/api.js` - API routes
- `src/services/imageService.js` - image generate/edit logic
- `src/services/openaiClient.js` - OpenAI client factory
- `src/services/requestLogStore.js` - MySQL tables + queries
- `public/index.html` - UI markup
- `public/styles.css` - UI styles
- `public/app.js` - UI behavior

## Prerequisites

- Node 18+ (Node 20 recommended)
- MySQL running locally or remotely
- OpenAI API key

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure env (`.env`):

```env
OPENAI_API_KEY=your_openai_key
PORT=3000
REQUEST_LIMIT_PER_IP=2

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=dalle-goblin
```

3. Ensure MySQL database exists:

```sql
CREATE DATABASE `dalle-goblin`;
```

4. Run app:

```bash
npm run dev
```

Open: `http://localhost:3000`

## Runtime Behavior

- First 2 requests per IP can use server key.
- After that, user must provide own OpenAI API key in UI.
- High quality is locked unless user key is saved.
- API key can be saved/edited in browser localStorage.
- Create/Edit image history is stored in IndexedDB (client-side only).

## Server-created DB Tables

Auto-created at startup:

- `api_keys`
- `request_logs`
- `subscription_interest_events`
- `subscription_interest_submissions`
- `contact_messages`

## API Endpoints

- `POST /api/generate`
- `POST /api/edit`
- `POST /api/interest/event`
- `POST /api/interest/submit`
- `POST /api/contact`

## Notes

- Contact form has honeypot + rate limit (`3/day/IP`).
- This project is not affiliated with OpenAI.
