# AI parts assistant proxy (Cloudflare Worker)

The store is a static site, so a Claude API key can't be placed in it — anyone could copy it.
This small Worker holds the key and answers the store's chat on its behalf.

What it does
- Accepts requests only from the origins in `ALLOWED_ORIGINS` (your GitHub Pages address).
- Limits each visitor (Cloudflare rate-limit binding, plus a fallback in memory) and rejects oversized or malformed requests.
- Loads your **published** `catalog.js` (cached 10 minutes) and tells Claude to recommend only those products, only for the customer's vehicle, never to invent prices or stock, and to ignore instructions hidden in customer messages.
- Uses structured output, then drops any product the catalog doesn't contain before replying.
- Never returns the key; the browser never sees it.

Deploy (about 5 minutes)
1. Install Wrangler: `npm i -g wrangler`, then `wrangler login`.
2. In this folder: `npx wrangler secret put ANTHROPIC_API_KEY` and paste your key.
3. Check `wrangler.toml` (`ALLOWED_ORIGINS`, `CATALOG_URL`, `MODEL`), then `npx wrangler deploy`.
4. Copy the `https://…workers.dev` URL into **Admin → Settings → AI parts assistant URL**, save, and **Publish**.

If the Worker is down or over its limit, the store assistant automatically falls back to its built-in engine.
Cost control: set a monthly spend limit for the key in the Claude Console.
