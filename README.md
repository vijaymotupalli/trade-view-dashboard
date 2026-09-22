# Trade Desk

Dark-mode-first, mobile-friendly static dashboard with a **three-tab** layout:

- **Market** — Cary market sentiment, signal score, outlook chips, and a news list of `top_stories` (with citations / links when present)
- **Stocks** — Trade Desk table (expandable rows for deep analysis / primary trader notes) + compact best-opportunity strip
- **Cassy** — Cassy research in the same table (feed id `cassy`). Missing or empty payloads show **No Cassy feed yet**

**Not financial advice.** This site is for research and educational purposes only. Trading involves risk of loss.

Feeds are stored in **Supabase** (`public.dashboard_feeds`) with RLS: **authenticated SELECT only**. The static GitHub Pages site uses **Google OAuth** (primary) plus optional magic-link auth (email OTP) via the public anon key.

> The GitHub repo / Pages path is `trade-view-dashboard`; the product name in the UI is **Trade Desk**. Prefer feed id `stocks` for the Stocks tab (legacy id `han_view` is still accepted by the client). Market feed id remains `cary_market`. Cassy research uses feed id `cassy`.

## Live site

**https://vijaymotupalli.github.io/trade-view-dashboard/**

## Auth setup (required once)

### 1. URL configuration

In **Supabase Dashboard → Authentication → URL Configuration**, set:

**Site URL**

- `https://vijaymotupalli.github.io/trade-view-dashboard/`

**Redirect URLs** (add all that apply)

- `https://vijaymotupalli.github.io/trade-view-dashboard/`
- `https://vijaymotupalli.github.io/trade-view-dashboard/index.html`
- `https://vijaymotupalli.com/trade-view-dashboard/` (if using a custom domain)
- `http://localhost:5500/` (optional, local preview)

### 2. Google OAuth provider

1. **Google Cloud Console** → APIs & Services → Credentials → Create **OAuth client ID** (Application type: **Web application**).
2. Under **Authorized redirect URIs**, add:
   - `https://umkbxexijazlpqbjwvlb.supabase.co/auth/v1/callback`
3. Copy the Client ID and Client Secret.
4. **Supabase Dashboard → Authentication → Providers → Google** → enable, paste Client ID + Secret, save.
5. Confirm Site URL + Redirect URLs include `https://vijaymotupalli.github.io/trade-view-dashboard/` (and your custom domain if used).

On the live site, click **Sign in with Google**. After Google / Supabase redirect, you return signed in and feeds load.

### 3. Magic-link fallback (optional)

Also enable **Email** provider / magic link (OTP) under Authentication → Providers.

Then open the live site and use **Email me a magic link** if you prefer email OTP. After you open the email link, you return signed in and feeds load from Supabase.

`config.js` holds `SUPABASE_URL` + `SUPABASE_ANON_KEY` on `window.TRADE_DESK_SUPABASE` (anon is public by design with RLS). **Never commit the `service_role` key.**

## Enable GitHub Pages

1. Open the repo: https://github.com/vijaymotupalli/trade-view-dashboard
2. Go to **Settings → Pages**
3. Under **Build and deployment**:
   - **Source:** Deploy from a branch
   - **Branch:** `main`
   - **Folder:** `/ (root)`
4. Click **Save**
5. Wait 1–2 minutes, then visit
   https://vijaymotupalli.github.io/trade-view-dashboard/

No build step is required — the site is vanilla HTML/CSS/JS (+ Supabase JS from jsDelivr ESM CDN).

## UI notes

- Sticky tab bar: **Market | Stocks | Cassy** (`aria-selected` on semantic buttons)
- Default tab: last choice in `localStorage` key `trade-desk-tab` when that feed is present (reads legacy `han-dash-tab` once and migrates `market` / `stocks`); otherwise Market, then Stocks, then Cassy
- Unauthenticated visitors see a centered **Trade Desk** login card: **Sign in with Google** first, then optional magic-link form (no Market/Stocks/Cassy data)
- Authenticated users: header shows email + **Sign out**; app fetches `dashboard_feeds` and maps `stocks` (or legacy `han_view`) → Stocks, `cary_market` → Market, `cassy` → Cassy
- Header feed badge: **Live feeds** when Market, Stocks, and Cassy payloads are all present; **Partial feeds** when only some are present
- Market news items show `source_name` (citation) and a **Read full story** link when `url` is present; otherwise muted “No link” (no invented URLs)
- Fed / snapshot / levels / scenarios / catalysts live in a collapsible **Details** section (closed by default)
- Stocks table sorts `high_conviction` → `watchlist` → `avoid`; click a row to expand inline analysis from `tickers[]`
- Expand panels show **Primary view** (from payload `primary` or legacy `han`) plus **My analysis**
- Robinhood helpers: ticker & current price link to `https://robinhood.com/stocks/{TICKER}`
- `[hidden]` CSS fix preserved so tab panels / login / auth chrome stay correctly hidden

## Update data (publish flow)

Live payloads live in Supabase table `public.dashboard_feeds` (ids `stocks` or legacy `han_view`, `cary_market`, and `cassy`), not in the public JSON files.

Repo stubs `data/latest.json` and `data/market.json` are placeholders (`login_required`) so raw GitHub URLs no longer leak full feeds. Upsert new payloads into Supabase (service role / SQL / MCP) instead of committing full JSON.

**Suggested publish steps**

1. Prepare Market and Stocks JSON payloads matching the schemas below.
2. Upsert into `public.dashboard_feeds`:
   - `id = 'cary_market'` → Market tab
   - `id = 'stocks'` → Stocks tab (preferred; client still accepts `han_view` if `stocks` is missing)
   - `id = 'cassy'` → Cassy tab (same ticker / dashboard shape as Stocks; empty or missing payload shows an empty state)
3. Open the live site signed in and confirm the tabs refresh (no Pages redeploy needed for feed-only updates).

## Files

| Path | Role |
|------|------|
| `index.html` | App shell (login gate + Market / Stocks / Cassy tabs) |
| `login.css` | Centered premium Google + magic-link auth screen |
| `config.js` | Public Supabase URL + anon key (`TRADE_DESK_SUPABASE`) |
| `styles.css` | Dark theme base + tab bar + auth helpers (`[hidden]` panel fix) |
| `theme.css` | Stocks table / strip / expand styles |
| `market.css` | Market tab + news list styles |
| `lib.js` | Shared helpers (`TradeDesk`, Robinhood links, `primaryView`) |
| `market.js` | Market tab renderer (`TradeDeskMarket`) |
| `stocks.js` | Stocks tab renderer (`TradeDeskStocks`); Cassy reuses it with a Cassy label config |
| `app.js` | Supabase auth (Google OAuth + magic link) + feed fetch + tab switching + footer |
| `data/latest.json` | Placeholder (data behind auth) |
| `data/market.json` | Placeholder (data behind auth) |
| `favicon.svg` | Brand mark |

## Feed payload schemas

### Cary market (`cary_market` / former `data/market.json`)

Locked fields (`schema_version: 1`):

| Field | Notes |
|-------|--------|
| `schema_version` | `1` |
| `generated_at` | ISO-8601 timestamp |
| `source` | Provenance (e.g. `Cary`) |
| `disclaimer` | Optional short disclaimer under Market tab |
| `market_regime` | Regime title (UI also accepts legacy `regime`) |
| `signal_score` | Numeric score; label bands: +60..+100 Strong Bullish, +25..+59 Bullish, -24..+24 Neutral / Mixed, -25..-59 Bearish, -60..-100 Strong Bearish |
| `signal_label` | Display label matching the score band |
| `outlook` | `{ spy, qqq, small_caps, semiconductors, volatility_risk }` |
| `top_stories[]` | `{ headline, impact, strength, affected[], status?, summary?, source_name?, url? }` |
| `fed` | `{ bias, current_target, next_decision, hike_probability_pct, expected_move_bp, expected_target, key_event }` |
| `catalysts` | `{ top_bullish, top_bearish, most_important_today, next_extreme_event: { when, what } }` |
| `scenarios` | `bull` / `base` / `bear` with `probability_pct` + `summary` |
| `snapshot` | `{ ten_year_yield_pct, vix, vix_class, wti_usd, brent_usd, dxy, geo_risk }` |
| `levels` | `{ spy_support[], spy_resistance[], note }` |

### Stocks feed (`stocks` preferred; legacy `han_view` still accepted)

Top-level fields:

- `generated_at` — ISO-8601 timestamp (shown in header/footer)
- `source` — data provenance string
- `market_context` — e.g. `{ "fomc": "YYYY-MM-DD", "note": "..." }`
- `best_opportunity` — compact Stocks strip (ticker, action, price)
- `dashboard` — table rows (expandable)
- `tickers` — deep analysis matched by ticker into row expand panels

Per-ticker detail may include:

- `primary` — Trade Desk stocks / primary trader notes (`summary`, `direction`, `entry`, `target`, `stop`); UI label is **Primary view**
- `han` — legacy alias for the same object (still read if `primary` is absent)
- `analysis` — “My analysis” column (entries, targets, opinion, risks)

### Cassy feed (`cassy`)

Same table shape as Stocks. Levels are **not** read from `han` or `primary`.

- `generated_at`, `source`, optional `trader`, `window`
- `dashboard[]` — table rows (ticker, company, price, class, direction, entry, target, stop, status, rating, post)
- `tickers[]` — `{ ticker, cassy, analysis }`. Expand panel labels **Cassy** from `tickers[].cassy` (`summary`, `direction`, `entry`, `target`, `stop`) and **Cassy analysis** from `tickers[].analysis`
- `best_opportunity` — strip (`action`, `ticker`, `current_price`, plus `targets`, `stop`, `preferred_entry`, `cassy_view` when present)
- `meta` — `ticker_count`, `fill_ins`, `fill_in_tickers`, optional `post_count` and `note`
- `market_context.note` — shown in the footer as Cassy context
- `posts[]` — used only when `dashboard` is empty

The panel title is **Cassy trades**. If the row is missing or has no dashboard rows, tickers, posts, or best opportunity, it shows **No Cassy feed yet**. Live prices use the same `.js-live-price[data-ticker]` hooks as Stocks.

### `best_opportunity.action` values

`BUY_NOW` | `WAIT_FOR_PULLBACK` | `WAIT_FOR_BREAKOUT` | `WATCH_ONLY` | `AVOID`

### `dashboard[].class` values

`high_conviction` | `watchlist` | `avoid`

## Local preview

Because `fetch` / Supabase auth require HTTP(S):

```bash
python3 -m http.server 5500
# then visit http://localhost:5500/
```

Add `http://localhost:5500/` to Supabase Redirect URLs for Google / magic-link return.

## Compatibility leftovers

Intentional technical leftovers (not product branding):

- Repo / Pages path: `trade-view-dashboard` (renamed from `han-view-dashboard`)
- Legacy Stocks feed id: `han_view` (client prefers `stocks`)
- Legacy payload key: `han` on ticker details (client prefers `primary`)
- One-time `localStorage` migrate from `han-dash-tab` → `trade-desk-tab`

## Disclaimer

This dashboard does **not** constitute financial, investment, or trading advice. Ideas, levels, and ratings are illustrative research samples and may be incomplete, delayed, or wrong. Do your own research. Past performance is not indicative of future results.
