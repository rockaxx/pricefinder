# PriceFinder.sk

Slovak price comparison MVP for new merchandise and used listings. The seed includes 30 clearly labeled example products across seven categories. Prices and availability in the demo are illustrative. Demo outbound links go to example.com. Product illustrations are generated category imagery.

## Run locally

Use Node.js 22.13 or newer and npm. On Windows PowerShell, use npm.cmd if script execution is restricted.

```sh
npm ci
cp .env.example .env
npm run setup
npm run seed
npm run dev
```

On PowerShell use `Copy-Item .env.example .env` instead of `cp`. Open [http://localhost:3000](http://localhost:3000). The setup command resolves the SQLite file to an absolute path for Prisma's migration engine. Relative SQLite paths in `DATABASE_URL` are relative to the `prisma/` directory. The seed can be rerun without overwriting existing demo offers. To serve an optimized build, use `npm run build` then `npm start`.

## Admin and merchant feeds

With `BAZOS_SEARCH_ENDPOINT` configured, the search page displays Bazoš offers
in one results grid beside the filters. Price limits and ascending/descending
price sorting apply to those listings, including pagination. Alza live search
and its search links are disabled for now. There is no separate empty catalog
below the listings. Without a Bazoš endpoint or local search mode, the catalog
search remains available for imported products and demo data.

For a compact localhost search with name, price and optional photo, set
`LOCAL_SIMPLE_SEARCH=1` in `.env` and start Next.js on `127.0.0.1`.
Saved HTML results can contain multiple items from any search topic:

```sh
npm run local:import -- alza "alza-results.html"
npm run local:import -- bazos "bazos-results.html"
```

The import saves only listing fields and adds or updates rows by source ID. Demo
sources are disabled. The Bazoš search ranks imported Bazoš listings and its
external link opens the same query directly on Bazoš. Legacy Alza import
utilities remain separate.

For live HTML search, copy the source settings from `.env.example` into `.env`
and restart the server. The example includes the public Bazoš search URL,
its query parameter, and a two-second minimum request interval
(`BAZOS_SEARCH_ENDPOINT`, `BAZOS_SEARCH_QUERY_PARAM`, `BAZOS_SEARCH_INTERVAL_MS`).
With any required field missing, that source stays disabled. Adjust endpoints
and limits to your integration terms. `BAZOS_SEARCH_IMAGES_ALLOWED=1` enables
the source's listing photos; the example enables them. Alza is not included
in the active live-search configuration.
The server applies the limits per source, reuses recently fetched
results, does not follow redirects, and displays only listing names, prices,
source links and any price condition. Locally saved listings are clearly
labeled and remain available when the live source is unavailable.
Bazoš request caps are enforced in rolling windows at 60/minute and 300/24 hours.
Requests for the same normalized search term and updates to an existing
listing's displayed data are limited to once per hour. The SQLite records
preserve these limits across restarts. Install the migration with `npm run setup`.
Successful query results also persist in SQLite for the refresh window, so a
server restart can reuse the results without consuming another source request.
With permission for unlimited Bazoš requests, set `BAZOS_SEARCH_UNLIMITED=1`
to disable its local request quotas and hourly refresh window.

Set `ADMIN_TOKEN` in `.env` to a random secret of at least 24 characters, restart, and open [/admin](http://localhost:3000/admin). Generate a key with `node -p "require('node:crypto').randomBytes(32).toString('hex')"`. Keep the value private.

- Use **Importovať ukážkové XML** to record a demo observation for the PS5 Slim Disc. The first import of the day and each price or shipping change create an observation. Seed prices have no historical samples.
- Use **Importovať ukážkový bazár** to test the used-listing connector.
- Register a source for a merchant who has authorized use of its data. Enter the exact HTTPS hostname of the listing links. Upload a file through the source row or use the remote sync command below.
- XML uses `SHOP/SHOPITEM`. CSV uses comma-separated UTF-8 with headers. Required columns are `ITEM_ID`, `PRODUCTNAME` (or `PRODUCT`), `URL`, and `PRICE_VAT` in EUR. Optional fields include `IMGURL`, `CATEGORYTEXT`, `MANUFACTURER`, `EAN`, `MODEL`, `VARIANT`, `STORAGE`, `AVAILABILITY`, `CONDITION`, `SELLER_TYPE`, `LOCATION`, and ISO `LISTED_AT`. Use `SHIPPING` in CSV or a `DELIVERY/DELIVERY_PRICE` in XML. Where multiple XML rates are supplied the lowest is used. Include applicable delivery rates only. See the [Heureka XML format](https://sluzby.heureka.sk/napoveda/xml-feed/).
- Imports are complete snapshots limited to 1 MB and 2,000 rows. Invalid or duplicate rows fail the batch and are recorded in the job log. A successful real import marks previous listings omitted from the snapshot as unavailable. XML DTDs and entity declarations are rejected. Source URLs must match the approved merchant host. Browser-facing remote image URLs should be supplied only by merchants with permission to show them.
- Uncertain listings stay out of the public comparison until an admin assigns them to an existing product or creates the variant. A reviewed match persists on subsequent imports for the same source and listing ID. Only reuse a listing ID for the same variant. Real offers and demo products are isolated during matching and review.

### Synchronizácia cien z e-shopov

1. Získaj od obchodu povolenie na preberanie a zobrazovanie produktov a cien. Pre feed si vypýtaj priamu HTTPS adresu exportu v podporovanom formáte `SHOP/SHOPITEM` alebo CSV, s produktovými odkazmi na doméne obchodu. Pri veľkých katalógoch si vypýtaj výrez pre kategóriu alebo značku do 2 000 položiek a 1 MB.
2. V [/admin](http://localhost:3000/admin) pridaj obchod ako schválený zdroj a skopíruj jeho identifikátor. Pri čítaní produktových stránok vyber formát CSV. Pre konkrétny zdroj používaj jeden spôsob synchronizácie.
3. Skopíruj `merchant-sync.example.json` do `merchant-sync.local.json` a vlož svoj identifikátor zdroja, schválenú URL feedu alebo schválený zoznam produktových URL. Zapni `authorized` až po získaní povolenia. Alternatívnu cestu k súboru možno nastaviť cez `MERCHANT_SYNC_CONFIG`. Súbor môže obsahovať privátne adresy feedov a patrí iba na server.
4. Spusť `npm run sync:catalog -- ID_ZDROJA` alebo `npm run sync:catalog` pre všetky nastavené zdroje. Výsledok je v denníku importov. Nové nepriradené ponuky schváľ v **Kontrole párovania**. Opakovaný import aktualizuje cenu a zachová schválené párovanie. Tento príkaz možno pravidelne spúšťať cez plánovač servera v intervale dohodnutom s obchodom.

Režim `pages` číta JSON-LD `Product` a jednoduchú ponuku `Offer` s cenou v EUR. Prečíta najviac 20 explicitných URL na doméne obchodu s odstupom aspoň jednej sekundy. Pri nejednoznačnej ponuke alebo neúspešnom stiahnutí sa dávka neaplikuje. Doprava zostáva neznáma a obrázky sa použijú iba po nastavení `includeImages`. Synchronizácia stránok aktualizuje zadané ponuky. Pri stiahnutí schváleného feedu sa uplatňuje existujúce pravidlo úplného snapshotu. Pri odstránení URL zo zoznamu stránok vypni príslušný zdroj, ak už jeho ponuky nemajú byť viditeľné, alebo aktualizuj starú ponuku cez riadený import.

### Zdroje pre slovenskú elektroniku

- **Alza.sk** zverejňuje partnerskú kampaň s XML feedmi v eHUB. Po schválení porovnávača si vypýtaj kompatibilný výrez feedu s priamym produktovým odkazom a schváleným formátom affiliate odkazu. [Kampaň Alza](https://ehub.cz/sk/002222e6-alza-sk) · [Prístup k feedom eHUB](https://ehub.cz/publishersky-manual).
- **TPD.sk** má kampaň pre elektroniku v Dognete. Prístup k feedom je v partnerskej administrácii. Pred spustením si potvrď pravidlá kampane a kombinovania feedov. [Kampaň TPD](https://www.dognet.sk/kampane/kampan-tpd-sk/) · [Feedy Dognet](https://www.dognet.sk/xml-feedy/) · [Podmienky Dognet](https://www.dognet.sk/vop/vop-sk-26092023.pdf).
- **TME** má bezplatné API pre elektronické súčiastky, ktoré vyžaduje účty zákazníka a vývojára aj API kľúč. Podmienky upravujú zobrazenie dát vrátane povinnej atribúcie. Samostatný konektor TME v tomto MVP nie je. [Dokumentácia TME API v2](https://developers.tme.eu/en/api-doc/v2) · [Podmienky API](https://developers.tme.eu/en/terms).

### Alza PS5 cez Crawlee

Príkaz spracuje produktové karty z konkrétnej stránky [Alza PlayStation 5](https://www.alza.sk/gaming/playstation-5/18872471.htm?evt=re&exps=ps5). Na výstupe je JSON s kódom, názvom, odkazom, cenou v eurocentoch, textom pri cene a dostupnosťou uvedenou na karte. Výstup je samostatná snímka.

```sh
npm run --silent scrape:alza -- --html "ulozena-stranka.html"
```

Pri súbore zostane čas cenového pozorovania neznámy. Po potvrdení povolenia na automatizovaný zber možno pre túto jednu URL použiť `npm run --silent scrape:alza -- --live-authorized`. Crawlee pri tomto režime kontroluje robots.txt a neposiela opakované požiadavky pri zablokovaní. Schválený import do katalógu používaj až pri jednoznačnej cene a dostupnosti konkrétneho variantu.

`npm run local:alza` pridá dodanú snímku do lokálnej SQLite databázy a vypne ukážkové zdroje. Cenu označí ako cenu zo snímky s neznámym dátumom. Nevytvára cenové pozorovanie a nevstupuje do cenových upozornení. Opakovaný beh upraví tú istú ponuku.

## Comparison and alerts

Product variants have independent URLs and prices. Search uses normalized catalog text with partial matching, conservative typo tolerance, and an alias for PS5. A result can be filtered by category, brand, condition, merchant, stock and price range. Known totals include shipping, with unknown shipping listed separately and sorted after known totals. Price range uses product price when the total is unknown.

Deal Score takes the percentage difference from the median of the latest recorded totals on at least five distinct past days within 90 days for the same real listing. Demo prices are excluded. The chart uses actual stored observations and labels demo observations explicitly.

```sh
npm run alerts -- --log
npm run alerts
```

For a local test, create a PS5 Slim Disc alert with a target of €380, then run the log command. It records channel `log` and emits a console message with the matched product and total without logging the address. The default command does nothing until both `SMTP_URL` and `SMTP_FROM` are configured. With approved SMTP credentials it sends only alerts for real products using enabled real, in-stock offers whose known total meets the target. Schedule this command separately in production. The evaluator claims pending rules before sending. Production should add address confirmation, unsubscribe and deletion controls, abuse protection, and provider-level delivery idempotency before enabling SMTP publicly.

## Source and approval status

| Source | MVP status | Activation |
| --- | --- | --- |
| Merchant XML and CSV | Admin upload and HTTPS sync with validation, snapshot reconciliation, review and price observations | Obtain merchant approval to receive, store and display offers, permitted images, and optional referral links. Configure and test each source using its real domain. |
| Merchant product pages | Configurable JSON-LD collector for explicit URLs | Use product pages whose merchant permits automated access and republication. A list of approved URLs is required. |
| Local demo catalog and sample marketplace | Enabled with example-only prices, sources and destinations | No credentials required. |
| Heureka Bidding Data API | Disabled partner source | Request eligibility, plan, API key and endpoint scopes from Heureka. Published documentation describes API key access, call limits and monthly billing. Obtain written terms that explicitly cover PriceFinder's downstream caching, history retention, public display and redistribution before mapping permitted responses into the connector. Eligibility and display/storage rights for this comparison site remain unconfirmed. |
| Heureka Affiliate | Disabled | Register the site and obtain approval for the specific domain and placements. The public terms describe approved advertising elements and referrals to Heureka, including product-level destinations. They do not publish a bulk catalog reuse grant. Confirm separately whether licensed data delivery is offered and on what terms. |
| Bazoš and Facebook Marketplace | Disabled partner registry entries | Obtain written partner authorization and a documented API or feed with scopes for SK listings, public display, refresh/deletion and retention. Implement the approved transport against the connector interface after receiving credentials and the data contract. |
| SMTP | Real optional adapter, disabled by default | SMTP URL, verified sender and recipient consent workflow. |
| Merchant affiliate links | Configurable, off by default | Configure the merchant's approved exact URL format using `Merchant.affiliate` with `{url}` as the encoded destination placeholder. Fixed approved deep links can be supplied directly in the merchant feed if they match the approved hostname. Sponsored records are labeled independently of ranking. |

Primary research includes [Heureka’s Slovak category](https://herne-konzoly.heureka.sk/), [product and shop offer comparison](https://herne-konzoly.heureka.sk/playstation-5-slim/), [Bidding Data API](https://sluzby.heureka.sk/help/bidding-data-api/), [API gateway](https://api.heureka.group/docs), [affiliate overview](https://heureka.group/sk/affiliate-program) and [affiliate terms](https://heureka.group/sk/podmienky-pouzivania/podmienky-pouzivania-programu-heureka-affiliate). Heureka informed the comparison features. No Heureka page content, listings, reviews, or assets are used in the catalog.

## Architecture and verification

- Next.js App Router, React and Tailwind. The project adapts thefrontkit configuration and shadcn button, with a custom Slovak interface, Lucide, Recharts and next-themes. Both [QuickCart](https://github.com/GreatStackDev/QuickCart/blob/main/LICENSE.md) and [thefrontkit](https://github.com/thefrontkit/nextjs-ecommerce-starter/blob/main/LICENSE) were checked and use MIT. The adopted starter's notice is preserved in `LICENSE`. Its original storefront, checkout and assets were omitted.
- Prisma and SQLite store products, categories, merchants, offers, observations, sources, jobs, alerts and privacy-conscious outbound counts. Prices are integer euro cents. PostgreSQL migration requires changing the datasource provider, generating a PostgreSQL migration, and copying data.
- `lib/domain.ts` implements price representation, ranking and deterministic identity matching. `lib/importer.ts` defines the connector contract and import transaction. `lib/alerts.ts` evaluates alerts and selects the notification adapter. `app/admin/` handles protected imports and match review.
- `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` exercise the code and build. Run `npx playwright install chromium` before `npm run e2e`. Browser tests use port 3001 and an isolated temporary database.

If Windows reserves ports 3000/3001 (`listen EACCES`), run
`npm run dev -- --port 3100` and open `http://localhost:3100`.
Set `SITE_URL=http://localhost:3100` in `.env` for that instance.
For browser tests, choose a free port with `PRICEFINDER_E2E_PORT` (PowerShell:
`$env:PRICEFINDER_E2E_PORT='3101'; npm run e2e`).

Before production, set the canonical HTTPS domain, replace draft legal/contact pages with operator details, configure approved partnerships, add scheduled imports and freshness thresholds, confirm affiliate link contracts, plan backups and monitoring, and move shared rate limits upstream for multi-instance deployment. Search currently ranks a small database-backed candidate set in memory. At larger scale, add a normalized search index and database-level candidate pagination.

