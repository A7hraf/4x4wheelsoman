# Business Hub server

Node 22 + Postgres. Holds the shared dashboard data, employee accounts and permissions, the approval
queue, the activity log, supplier catalogues, and a private proxy for Claude.

## Run on Railway
Build with `server/Dockerfile` from the repository root. Environment variables:

| Variable | |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `SETUP_CODE` | one-time code needed to create the owner account (long random text) |
| `APP_SECRET` | long random text; encrypts the Claude key and GitHub token stored in the database |
| `ALLOWED_ORIGINS` | `https://a7hraf.github.io` (comma-separated) |
| `CATALOG_URL` | `https://a7hraf.github.io/4x4wheelsoman/assets/js/catalog.js` (website parts assistant) |

Health check: `/api/health`. Supplier catalogues sync every night at about 03:00 Muscat time
(`DISABLE_SCHEDULER=1` turns that off). Then set the server address in `assets/js/config.js` and add it
to `connect-src` in `admin.html`.

## How saving works
The dashboard sends each save as a batch of row changes (`POST /api/sync`). The server merges each
record field by field (stock as a difference, so two tills never overwrite each other), checks the
person's permissions and then applies the batch, puts it in the owner's approval inbox, or refuses it —
always as a whole. Other devices pick up changes every few seconds (`GET /api/changes`).
The server fills in who made each sale, takes item costs from its own product records, fixes duplicate
invoice numbers, enforces discount limits and removes costs from what people without the cost
permission can read.

## Supplier catalogues
Shopify shops (`/products.json`) and Magento shops (GraphQL) are read slowly (1.2 s between pages) with
an identifying User-Agent; only public https addresses are fetched and redirects to private addresses are
refused. Sites that block automated access are kept as manual suppliers — no protection is bypassed.

## Tests
`npm install && npm test` — runs the API against a real embedded Postgres with fake supplier sites.
