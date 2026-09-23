# Costco Stock Checker

A small static web page for manually checking Costco pickup availability
for a list of items across one or more warehouses. Pick item(s) and
warehouse(s), hit "Check Availability," see results. Nothing runs on a
schedule and nothing is remembered between checks — every check is live,
on demand.

## Setup

1. **Create a GitHub repo** (private is fine) and push these files,
   keeping the folder structure — `docs/` needs to stay at that path.

2. **Enable GitHub Pages**: repo Settings → Pages → Source → "Deploy from
   a branch" → branch `main`, folder `/docs` → Save. GitHub gives you a
   URL like `https://<you>.github.io/<repo>/` (takes a minute to go live).

3. **Edit `config.json`** (copy `config.example.json` to `config.json`
   first) with your real item list and warehouse(s) — this is the list
   the page's checkboxes are built from.

4. **Open the page**, expand "Settings", and set **Config source** to the
   raw GitHub URL of your `config.json`, e.g.
   `https://raw.githubusercontent.com/<you>/<repo>/main/config.json`.
   Click "Save & Load" — the warehouse and item checkboxes should populate.

5. **Try a check as-is first.** Leave "Proxy base URL" blank and hit
   "Check Availability" — the page calls Costco's API directly from your
   browser. This may just work.

6. **If you see errors** in the results (or a CORS error in the browser's
   dev console), Costco's server is refusing the cross-origin request —
   a browser can't set `Origin`/`Referer`/`User-Agent` the way curl can,
   and if Costco checks those server-side, direct calls get blocked.
   Fix: deploy the included Cloudflare Worker as a free proxy.
   - Cloudflare dashboard → Workers & Pages → Create → paste in
     `cloudflare-worker/worker.js` → Deploy.
   - Copy the Worker's URL (looks like
     `https://costco-proxy.<you>.workers.dev`).
   - Back on the checker page, paste that into "Proxy base URL", Save.
   Nothing else changes — the page now routes calls through the Worker,
   which makes the real request server-side with the original headers
   and hands the JSON back with CORS enabled so your browser can read it.

## Editing the item/warehouse list from your phone

Install the **GitHub mobile app** (or use github.com in mobile
Safari/Chrome). Navigate to your repo → `config.json` → tap the
pencil/edit icon → make your change → commit directly to `main`. Reload
the checker page and click "Save & Load" again to pick up the change —
there's no automatic refresh since nothing runs in the background.

`config.json` format:

```json
{
  "warehouses": [
    { "id": "648-wh", "label": "Maple Grove" },
    { "id": "377-wh", "label": "SLP" }
  ],
  "items": [
    { "name": "1792 Bottled In Bond", "sku": "1411507" },
    { "name": "Blanton's Original", "sku": "122438" }
  ]
}
```

- `warehouses`: entries can be a plain string (`"648-wh"`) or an object
  with a `label` for readability — labels show up in the checkboxes and
  results table instead of the raw ID.
- To find a warehouse ID, check the URL Costco's site calls when you
  select a warehouse for pickup on costco.com.

## Things worth knowing

- **This is entirely manual.** There's no schedule, no notifications, and
  no memory of past results — every click is a fresh set of live
  requests, and closing the tab discards everything.
- **The proxy setting is per-browser** (stored in `localStorage`), so
  you'll need to re-enter the Worker URL if you check from a different
  device or browser.
- **Rate limits still apply.** Checking a lot of item x warehouse
  combinations back-to-back can trigger Costco's bot protection (a 403
  in the results). The page waits ~400ms between requests as a courtesy,
  but if you're seeing a wall of 403s, try fewer combinations at once.
- Keep the repo **private** if your item list feels like something you'd
  rather not have public.
