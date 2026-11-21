# 4x4 Wheels Oman: online store and business dashboard

A static website (no server needed) hosted on **GitHub Pages**.

| Page | Address | For |
|---|---|---|
| Online store | `https://a7hraf.github.io/4x4wheelsoman/` | Customers |
| Admin dashboard | `https://a7hraf.github.io/4x4wheelsoman/admin.html` | Owner only — protected by a password |
| Online invoice | `…/bill.html#…` | Opened by customers from the WhatsApp bill link |

## Online store
- Same design and structure as 4x4wheelsoman.com: dark theme, red accent, Chakra Petch / Barlow fonts, Arabic and English.
- Real catalog: 58 parts, 9 categories, 19 vehicles and 20 brands, with photos, part numbers, specs and fitment.
- Pages: home (vehicle finder, categories, brands, popular upgrades, Qpay, fitment help), shop with filters, categories, vehicles, product pages (zoom, fit checker, specs), Pay in installments (Qpay calculator and FAQ), Visit us, and the quote list.
- The quote list is sent to WhatsApp with the customer's vehicle and an optional Qpay request.
- **Parts assistant** (chat button, bottom corner): customers type what they need in English or Arabic ("lift kit for my LC300 2023", "ابي كفرات للباترول") and get only parts that fit their vehicle, with *Add to quote* buttons, answers about hours, location, Qpay and delivery, and a hand-off to WhatsApp. It works with no server and no API key. Optionally, it can use Claude through a small proxy you host (see `worker/`).

## Admin dashboard
- **Login**: the dashboard is locked with your password (see *Security* below). Lock button in the top bar; auto-lock when idle.
- **Dashboard, Point of Sale, Orders, Inventory, Purchasing, Finance, Reports, Customers, AI Advisor.**
- **AI (Claude)** — add your Claude API key in Settings:
  - *AI Advisor* chat that can look up your real products, customers, orders, sales breakdowns, open quotes and the reorder plan before it answers ("What did Ahmed buy?", "Which Patrol parts sell best on WhatsApp?").
  - *Read with AI* in **Quotes → Paste from WhatsApp**: turns any customer message (English/Arabic, any format) into quote lines from your catalog, and lists what isn't in the catalog.
  - *Write with AI* on products (English + Arabic description and bullet points) and on WhatsApp campaigns.
  - AI executive summary in the printable business report.
- **Works without AI too**: pasted WhatsApp messages in plain words are understood by the built-in matcher, and smart insights run offline.
- **Purchasing forecast**: reorder suggestions use sales over the last 60 days, your supplier lead time and target days of stock, and subtract what is already on open purchase orders (so nothing is ordered twice).
- **Quotes**: paste the customer's WhatsApp message (sent from the website) to build a quote automatically, price it, send it back on WhatsApp, then convert it to an order.
- **WhatsApp**
  - Send a bill: a professional online invoice link sent to the customer on WhatsApp.
  - Notify the customer when an order is confirmed, ready, shipped or delivered, or send a payment reminder.
  - Advertising campaigns: target customers by vehicle, governorate, purchased category, workshops, or no purchase in 60+ days. Product links are added to the message, and a "Send next" runner sends one message at a time.
  - Editable message templates and a message log.
- **Qpay**: a pipeline for installment orders (To request → Requested → Approved → Settled / Declined), a 4-payment schedule, a limit check (OMR 500), merchant-fee tracking, and the request message sent on WhatsApp.
- **Publish to website**: push product, price and setting changes to the live store with one click, using a GitHub token. You can also download `catalog.js` and upload it to `assets/js/` yourself.

## Suppliers, team and approvals (online server)
The dashboard now runs on a small server (`server/`, hosted on Railway) so the owner and employees share the same data from any phone or computer.
- **Suppliers**: one page per supplier with what to buy now (customer orders that were sold but are not in stock, plus restock suggestions), supplier orders (send by WhatsApp/email, or open a ready cart on Shopify shops), history, linked products and *How to buy* notes (contact, payment terms, delivery time, currency, VAT, shipping %, default margin). Receiving a supplier order puts stock up and sends items straight to the waiting customer orders.
- **Supplier catalog**: AM Wrangler (Shopify) and Offroad Zone (Magento) catalogs are copied every night (and on demand) so you can search them, see stock and price, compare the same part number at both, and *Add to my products* with a margin → selling price calculator (supplier price × VAT × exchange rate × shipping %). Titan Performance and Ramy Automotive don't offer open product lists, so their products are added from a link and price. *Price changes* shows supplier price moves and flags products you sell.
- Every sale records which supplier each item comes from; add, change or remove suppliers at any time.
- **Team**: create employee accounts with a permission level per section (no access / view / ask approval / edit / full), plus "can see costs", "can download data" and a discount limit. Ready roles: Cashier, Sales, Store keeper, Manager. See each person's sales, orders handled, quotes, supplier orders, requests and a full activity log. Switching an account off signs it out at once.
- **Approvals**: changes from employees with *ask approval* (and deletes, cancellations and refunds from *edit*) wait in the owner's inbox with a before/after view.
- Permissions are enforced on the server, not only in the screen. The Claude key and GitHub token are stored encrypted on the server; employees' AI requests go through it, so the key never reaches a browser.
- **Daily supplier check**: every night the suppliers are checked again — price up/down, out of stock, back in stock, new and removed products are listed in *Sourcing → Supplier updates* and sent as notifications. Titan Performance's product list is read from its sitemap (prices are entered by you or imported from their price list); Ramy Automotive's products are added by link and those pages are re-read daily. Any supplier's price list (CSV / pasted from Excel) can be imported.
- **Out of stock at the supplier**: per product or for the whole shop, choose to hide it on the website, or keep it visible as *Out of stock · on order, about N days* so customers know delivery takes longer.
- **My work** (employees): their own sales, tasks, orders given to them and new orders waiting — never the shop's overall sales and profit. A bell shows new orders, assignments, task reminders and approvals (optionally as device alerts).
- **AI assistant** (owner and employees): connect Claude, the free Google Gemini or any OpenAI-compatible service in *Settings → AI*. It only sees what the person asking may see. It analyses customers and the team, and can add products, change stock, order from suppliers, add expenses, prepare campaigns, give tasks, create employee accounts and make PDF reports — each action is shown first and only happens after *Do it*.
- **WhatsApp Business** (Meta Cloud API, optional): in *Settings → WhatsApp* enter the phone number ID, business account ID, access token and app secret, and paste the webhook address and verify token into Meta. Bills and order updates then go from the shop's number, customers' messages arrive in *WhatsApp → Inbox* (new numbers become customers), and offers are sent with approved Marketing templates to chosen customers who agreed to receive them (they can reply STOP).

First time online: open the dashboard, enter the **setup code** you were given, create the owner account, then choose *Upload the data on this device* (with your old dashboard password), a backup file, your catalog or demo data. Server details: `server/README.md`. Setting `assets/js/config.js` back to `''` returns to the old single-device mode.

## First-time setup
1. Open the admin page and **create your admin password** (at least 8 characters; there is no way to recover it — keep it safe). Existing dashboard data on that browser is kept and encrypted.
2. Open **Admin → Settings**. Check the business details and WhatsApp number. Click **Start fresh** to remove the demo orders and demo prices.
3. Open **Inventory**. Set your real prices and stock. Tick **Show price on website** only for items with a fixed price; all others show "Price on request".
4. In **Settings → Publish to website**, paste a GitHub fine-grained token with *Contents: Read and write* on this repository only, then click **Publish now**.

5. Optional: paste a Claude API key in **Settings → AI (Claude) connection** to switch on the AI features.

## Security
- **Password + encryption.** The site has no server, so the password unlocks the data itself: it is turned into a key with PBKDF2-SHA256 (600,000 rounds) and all admin data — orders, customers, costs, the Claude API key and the GitHub token — is compressed and encrypted with AES-256-GCM in the browser. Nothing readable is left in browser storage.
- While a tab is unlocked, its key is kept in that tab's session storage so a page reload doesn't ask again; locking, the idle timer or closing the tab clears it. Other tabs need the password.
- 5 wrong passwords → a short lock-out that doubles each time (up to 15 minutes). Auto-lock after 15 minutes idle (changeable in Settings → Security). Change the password in Settings → Security.
- **Forgot the password?** The data can't be decrypted without it. On the sign-in page choose *Forgot password?* and type `ERASE` to wipe that device, then restore a backup.
- **Backups** (Settings → Download backup) are plain JSON so you can restore anywhere — store them safely. They never include the API key or GitHub token.
- Content-Security-Policy on every page, no third-party scripts (Chart.js and the Anthropic SDK are served from `assets/vendor/`), the dashboard refuses to open inside another site's frame, and invoice links can't change the shop's name, phone, WhatsApp number or payment link.
- Limits of a static site: the password protects the data on each device; it is not a server account. Anyone can open `admin.html`, but they only see an empty dashboard on their own device — never your data. The lock-out counter lives in the browser, so the real protection against guessing is the slow key derivation plus a strong password: use 12+ characters.

## AI parts assistant with Claude (optional)
The store assistant works without any setup. To have Claude answer customers, deploy the small Cloudflare Worker in `worker/` (free plan is enough). It keeps your API key secret, only answers your website, rate-limits each visitor and only recommends products from your published catalog. Then paste its URL in **Settings → AI parts assistant URL** and click **Publish**. See `worker/README.md`. Never put an API key in the website itself.

## Tests
End-to-end tests (Playwright) cover the store, every dashboard workflow, the AI features (with a fake Claude API), login and security, and the online mode (owner, cashier and store keeper on the real server with fake supplier websites):
```
cd server && npm install && npm test     # API: permissions, approvals, sync, suppliers, security
cd ../tests && npm install && npx playwright install chromium && npm test
```

## Notes
- Admin data (orders, customers, expenses) is stored, encrypted, in the browser you use for the admin. Download a backup regularly (Settings → Download backup).
- When you click **Preview website** in Settings, a public copy of the catalog (no costs, no customers) is saved so `index.html?preview` can show your unpublished changes.
- WhatsApp messages open in WhatsApp or WhatsApp Business with the text ready, and you press Send. Fully automatic sending would need the Meta WhatsApp Business Cloud API and a server.
- Qpay (Oman) doesn't publish a public merchant API. Requests are created in the Qpay merchant app/portal, and the dashboard tracks each request and messages the customer.
- Only send marketing messages to customers who agreed to receive them (the "opt-in" flag on each customer).
