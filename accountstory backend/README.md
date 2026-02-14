# Accountstory Backend Workspace

Standalone app (own server + API + UI) for your team to run ad automation for customers.

## Run
From this folder:

```bash
cd "/Users/chijokenwuzi/Documents/Accountstory with Codex/accountstory backend"
npm start
```

Server starts at:
- `http://127.0.0.1:9091`

You can change port/host:

```bash
PORT=9191 HOST=127.0.0.1 npm start
```

Set your OpenAI key before starting (or create `.env` in this folder):

```bash
export OPENAI_API_KEY="your_api_key_here"
```

Or use:

```bash
cp .env.example .env
```

Optional:

```bash
export OPENAI_MODEL="gpt-5-mini"
export OPENAI_TIMEOUT_MS=30000
export OPENAI_ALLOW_FALLBACK=false
```

If `OPENAI_API_KEY` is missing and `OPENAI_ALLOW_FALLBACK=false`, campaign option generation returns an error.
If `OPENAI_ALLOW_FALLBACK=true`, the app will still generate rule-based fallback options.

## What is included
- `server.js`: standalone Node server + REST API + static file serving
- `app.js`: frontend workspace wired to backend APIs
- `styles.css`: UI styles (with horizontal workspace scrolling)
- `data/store.json`: persisted workspace data

Customer profiles can now store extra defaults (website, geo, offer, audience, notes), and the campaign builder can load those defaults to generate campaigns faster.

## API
- `GET /api/state`
- `PATCH /api/selection`
- `POST /api/customers`
- `POST /api/campaigns/build` (single unified campaign builder flow)
- `POST /api/campaigns`
- `POST /api/assets`
- `POST /api/ad-inputs/generate`
- `PUT /api/guardrails`
- `POST /api/campaigns/:id/action`
- `POST /api/simulate`
