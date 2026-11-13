# 4x4 Wheels Oman: online store and business dashboard

A static website (no server needed) hosted on **GitHub Pages**.

| Page | Address | For |
|---|---|---|
| Online store | `https://a7hraf.github.io/4x4wheelsoman/` | Customers |
| Admin dashboard | `https://a7hraf.github.io/4x4wheelsoman/admin.html` | Owner only (don't share) |
| Online invoice | `…/bill.html#…` | Opened by customers from the WhatsApp bill link |

## Online store
- Same design and structure as 4x4wheelsoman.com: dark theme, red accent, Chakra Petch / Barlow fonts, Arabic and English.
- Real catalog: 58 parts, 9 categories, 19 vehicles and 20 brands, with photos, part numbers, specs and fitment.
- Pages: home (vehicle finder, categories, brands, popular upgrades, Qpay, fitment help), shop with filters, categories, vehicles, product pages (zoom, fit checker, specs), Pay in installments (Qpay calculator and FAQ), Visit us, and the quote list.
- The quote list is sent to WhatsApp with the customer's vehicle and an optional Qpay request.

## Admin dashboard
- **Dashboard, Point of Sale, Orders, Inventory, Purchasing, Finance, Reports, Customers, AI Advisor.**
- **Quotes**: paste the customer's WhatsApp message (sent from the website) to build a quote automatically, price it, send it back on WhatsApp, then convert it to an order.
- **WhatsApp**
  - Send a bill: a professional online invoice link sent to the customer on WhatsApp.
  - Notify the customer when an order is confirmed, ready, shipped or delivered, or send a payment reminder.
  - Advertising campaigns: target customers by vehicle, governorate, purchased category, workshops, or no purchase in 60+ days. Product links are added to the message, and a "Send next" runner sends one message at a time.
  - Editable message templates and a message log.
- **Qpay**: a pipeline for installment orders (To request → Requested → Approved → Settled / Declined), a 4-payment schedule, a limit check (OMR 500), merchant-fee tracking, and the request message sent on WhatsApp.
- **Publish to website**: push product, price and setting changes to the live store with one click, using a GitHub token. You can also download `catalog.js` and upload it to `assets/js/` yourself.

## First-time setup
1. Open **Admin → Settings**. Check the business details and WhatsApp number. Click **Start fresh** to remove the demo orders and demo prices.
2. Open **Inventory**. Set your real prices and stock. Tick **Show price on website** only for items with a fixed price; all others show "Price on request".
3. In **Settings → Publish to website**, paste a GitHub fine-grained token with *Contents: Read and write* on this repository only, then click **Publish now**.

## Notes
- Admin data (orders, customers, expenses) is stored in the browser you use for the admin. Download a backup regularly (Settings → Download backup).
- WhatsApp messages open in WhatsApp or WhatsApp Business with the text ready, and you press Send. Fully automatic sending would need the Meta WhatsApp Business Cloud API and a server.
- Qpay (Oman) doesn't publish a public merchant API. Requests are created in the Qpay merchant app/portal, and the dashboard tracks each request and messages the customer.
- Only send marketing messages to customers who agreed to receive them (the "opt-in" flag on each customer).
