# Business Hub: shop, online store, inventory and finance

A complete management system for an off-road / 4x4 parts business in Oman. It's a plain HTML/CSS/JS site with no build step, so it runs directly on **GitHub Pages**.

| Page | What it does |
|---|---|
| `admin.html` (admin dashboard) | Dashboard, Point of Sale, Online Orders, Inventory, Purchasing, **AI Advisor**, Finance, Reports, Customers, Settings |
| `index.html` (online store) | Home with offers, shop with categories and filters, product pages, cart, checkout, **order via WhatsApp**, Arabic / English |

## Features

**Online store (customers)**
- Modern, responsive design for phones and desktops, in Arabic (RTL) and English
- Home page with hero, vehicle finder, categories, hot offers, featured products, brands and a WhatsApp banner
- Shop page with category, vehicle, brand, in-stock and on-sale filters, plus search and sort
- Product page with photo, price and "was" price, stock status, fitment, description and related items
- Cart drawer where customers change quantities, see VAT and delivery, and get a free-delivery progress bar
- Checkout on the website (cash on delivery, card on delivery or bank transfer), or **send the order on WhatsApp** with the full cart pre-filled
- Every order, including WhatsApp orders, appears in the admin as a **New** online order

**Admin dashboard (owner)**
- Products: add, edit, delete, upload photos, set offers ("was" price), choose featured items, show or hide in the store
- Orders: a pipeline (New → Processing → Shipped → Delivered / Cancelled), order details, customer data and printable invoices
- Point of Sale for the physical shop: product grid, cart, discount, 5% VAT, cash/card/transfer and a printable receipt
- Inventory: stock levels, low-stock alerts, stock adjustments, a stock movement log and CSV export
- Purchasing: suppliers, purchase orders, reorder suggestions, and receiving stock (which updates stock and costs)
- Finance: P&L, cash flow, VAT summary, expenses, payment mix and income vs expenses for the last 6 months
- Reports: best sellers, sales by brand, governorate, weekday and source, with CSV export
- **AI Advisor**
  - A business health score and smart insights that work offline: sales trend, profit, stock-outs, slow movers, late orders and the best trading day
  - A chat with Claude about your own numbers ("What should I reorder?", "Where am I losing money?")
  - **Report generation**: a printable / PDF / downloadable business report, with an optional AI-written executive summary and recommendations
- Arabic / English, light / dark mode, global search, backup / restore

## Publish on GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repository, go to **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, then select `main` and `/ (root)`.
3. After about a minute the site is live at `https://<user>.github.io/<repo>/`:
   - Store (send this to customers): `https://<user>.github.io/<repo>/`
   - Admin (keep private): `https://<user>.github.io/<repo>/admin.html`

## Connect the AI (optional)

1. Create an API key at https://console.anthropic.com.
2. In the admin, go to **Settings → AI (Claude) connection**, paste the key and click Save.

The key is stored **only in that browser** and is sent only to Anthropic. It is never written into the site's code or into backups. Use it only on your own device.

## Important: where data is stored

This version has no server. All data (products, orders, customers, expenses) is saved in the **browser's local storage** on the device where it's used.

- The store and the admin share data only when they're opened **in the same browser on the same device**. That's ideal for a demo or for single-computer use.
- Use **Settings → Download backup** regularly. You can restore it on another computer.
- For real customers ordering from their own phones while the owner manages everything from another device, the next step is to connect a free hosted database (for example Supabase or Firebase). The data layer is isolated in `assets/js/db.js` so it can be swapped without touching the screens.

## Customize

- Business name, phone, WhatsApp number, address, VAT, delivery fee and the free-delivery threshold are in **Settings**.
- Demo data is loaded the first time. Use **Settings → Reset demo data** to restore it, or delete and replace products with your own.

## Files

```
index.html            online store (main page)
admin.html            admin dashboard
assets/css/app.css    admin styles
assets/css/store.css  store styles
assets/js/db.js       data layer + demo data
assets/js/app.js      admin screens
assets/js/store.js    store screens
assets/js/ai.js       insights engine, Claude integration, report builder
assets/js/art.js      product illustrations and photo resizing
assets/js/i18n.js     Arabic / English texts
assets/js/icons.js    icon set
```
