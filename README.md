# Waraqa CRM v2

Operations CRM for [Waraqa](https://waraqa.art): orders, products and prices, costs, shipping rates, WhatsApp, customers and analytics. It runs on a new Google Sheet that the store also reads, so a price or shipping change shows on the site within seconds.

v1 (the Vite app on the old Apps Script backend) is in git history before this branch.

## How it fits together

```
  waraqa.art (store, Next.js)        crm.waraqa.art (this CRM, Next.js)
          │  service binding                 │  service binding
          │  PublicApi                       │  AdminApi
          └──────────────►  waraqa-data  ◄───┘
                     (Worker + 1 Durable Object)
                               │  Google Sheets API (service account)
                               ▼
                       Waraqa Google Sheet
                               ▲
          order emails ◄── mailer (slim Apps Script, Gmail)
```

| Folder | What it is |
|---|---|
| `data/` | **waraqa-data**: the only thing that touches the Sheet. One Durable Object runs every write one at a time, so a sale and a stock edit can't overwrite each other. It keeps the Sheet in memory and drops that copy on every write, which is why changes sync straight away. No public URL. |
| `crm/` | **waraqa-crm**: this app, at `crm.waraqa.art`. Password sign-in, then everything goes to `waraqa-data`. |
| `mailer/` | `Code.gs`: Apps Script that only sends the owner alert and customer receipt from Gmail. |

### Why this syncs better than v1

- **Speed.** The old Apps Script took 2–35 s per call, so both apps hid it behind caches and fell back to stale copies. The Sheets API answers in about 0.3 s, and reads come from memory.
- **Instant updates.** Every write (CRM edit or store order) drops the cached copy. The store's next request reads fresh data. Edits typed into the Sheet by hand are picked up within 15 s.
- **Writes are checked.** If the stock you're editing changed since you loaded it (an order came in), the CRM refuses the write and shows the new number instead of overwriting it. After every save the CRM shows the Sheet as it is, not an optimistic guess.
- **One source for shipping.** Rates live in the Sheet's Shipping tab. The store's cart, the checkout quote, the order charge and the CRM all read the same rows.

## The Sheet

| Tab | Holds |
|---|---|
| Products | SKU, names, specs, **Price**, Compare-at, **Cost** (private), Stock, Status, Featured |
| Orders | One row per order, incl. Shipping Charged and **Courier Cost** |
| Order Items | One row per line, with the unit price and unit cost at the time of the order |
| Customers | One row per phone number; orders and spend kept up to date automatically |
| Shipping | Zones: governorates, fee, free-over threshold, courier cost |
| Settings | Support WhatsApp, confirm-within hours, restock on cancel, low-stock level |
| Newsletter | Sign-ups from the store |
| Audit Log | Every change made from the CRM |

Columns are found by header name, so you can reorder them or add your own. Don't rename the headers the app uses.

## Set up (one time)

**1. Google service account**
1. [console.cloud.google.com](https://console.cloud.google.com) → create a project (e.g. `waraqa`) → enable the **Google Sheets API**.
2. IAM & Admin → Service accounts → Create (`waraqa-data`) → Keys → Add key → JSON. Keep the file private: never commit it.

**2. New Sheet**
1. In your Gmail Drive, create a blank Google Sheet named `Waraqa Data`.
2. Share it with the service account's email as **Editor**.
3. Share the **old** Sheet with the same email as **Viewer** (for the import).
4. Put the new Sheet's ID (from its URL) in `data/wrangler.jsonc` → `SHEET_ID`.

**3. Deploy the data Worker**
```bash
cd data && npm install
npx wrangler secret put GOOGLE_SA_EMAIL
npx wrangler secret put GOOGLE_SA_KEY      # paste the private_key value from the JSON file
npm run deploy
```

**4. Deploy the CRM**
```bash
cd crm && npm install
npx wrangler secret put CRM_PASSWORD
npx wrangler secret put SESSION_SECRET     # 32+ random characters
npm run deploy
```
Open `crm.waraqa.art` → Settings → **Set up / repair tabs**, then **Import** with the old Sheet's URL. Then check prices, add product **costs**, and review the **Shipping** page.

**5. Mailer** (order emails): follow the steps at the top of `mailer/Code.gs`, then:
```bash
cd data
npx wrangler secret put MAILER_URL
npx wrangler secret put MAILER_SECRET
```

**6. Switch the store** to the `data-worker-sync` branch of waraqa-store and deploy it. From then on, orders go to the new Sheet. Leave the old Apps Script deployment running for a day as a fallback, then archive it.

## Local development

```bash
# terminal 1
cd data && cp .dev.vars.example .dev.vars   # fill in, SHEET_ID can be a test copy
npm run dev
# terminal 2
cd crm && cp .dev.vars.example .dev.vars
npm run dev                                 # http://localhost:3010
```
`next dev` reaches the local data Worker through Wrangler's dev registry.

Tests for the business rules: `cd data && npm test`.
