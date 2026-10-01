# Swaroop Studios — SEO + AI Discoverability Audit

**Last updated:** 1 October 2026 (custom-domain migration, per-route social images, expanded structured data, local SEO, visible FAQ)
**Original pass:** 28 September 2026 (baseline SEO/AI implementation — still described where relevant)
**Scope:** technical SEO, structured data, social metadata, local SEO, AI discoverability. No redesign and no framework migration; the static single-document architecture is retained deliberately.

## 1. Current architecture

- Static single-document site: `Swaroop Studios (2).html` (~2,800 lines, markup + CSS + vanilla JS, no framework, no build step, no package.json).
- Served by Vercel rewrites (`vercel.json`): `/` → the HTML document; `/admin` → same document.
- Client-side hash routing (`#/home`, `#/about`, `#/services`, `#/gallery`, `#/contact`); `/admin` detected via `location.pathname`.
- Images: pre-generated AVIF + JPEG committed to `assets/images/`; videos: 8 MP4s in `assets/videos/` with posters in `assets/posters/`; social images in `assets/og/`.
- Admin/gallery API: `api/gallery.js` (serverless, GitHub-backed); seed data in `data/gallery.json`.
- Production origin: **`https://www.swaroopstudios.com/`** (custom domain, confirmed by the owner on 1 Oct 2026). Canonicals, OG URLs and structured data all resolve from the in-page `SITE_ORIGIN` constant, which is the single swap point.

## 2. Existing SEO implementation (before the 28 Sep pass)

- `<title>`, meta description, OG tags, Twitter card tags, `theme-color`, emoji data-URI favicon.
- Client-side JSON-LD (`ProfessionalService`, built by `buildLdJson()`, relative image, `{}` before JS runs — invisible to no-JS crawlers).
- No canonical, no `og:url`, no robots.txt (verified 404), no sitemap.xml (verified 404), no manifest, no llms.txt, no per-route metadata.

## 3. Problems found

Resolved in the 28 Sep pass:

1. Zero crawlable routes: everything behind `#/` hash fragments; sitemap/robots absent; crawlers saw one undifferentiated document.
2. `/admin` navigation lock: pathname check forced `admin` view, killing all nav/footer links on `/admin`.
3. Relative `og:image` / JSON-LD `image`; legacy `/_blob/` asset URLs could leak into OG/JSON-LD via dead code paths.
4. Duplicate-title risk: one static title for all five views; no per-route descriptions.
5. No-JS = blank page (all content JS-injected); no `<noscript>` fallback.
6. Gallery tiles not keyboard-operable (plain divs, click-only); mobile menu button had no `aria-expanded`; lightbox had no dialog semantics.
7. Heading skips: `h2 → h4` (timeline, VIP list), `h1 → h4` (contact), `h5` footer headings with no `h2` context.
8. Contrast: `--grey #8C887F` on paper = 3.36:1 (eyebrows, contact location, footer note, placeholders).
9. Favicon/manifest missing; `apple-touch-icon` missing.
10. No AI/LLM machine-readable files; crawler policy undocumented.

Found in the 1 Oct pass:

11. Canonical origin was the old Vercel host while the site is now served from a custom domain — every canonical, OG URL, sitemap entry and AI file pointed at the wrong host.
12. One shared `og:image` (1800×1200) across all five routes, with `og:image:width/height` describing a 1800×1200 source and an alt that did not match the image's own caption.
13. Structured data covered only two nodes: no service types, no service area, no region, no films.
14. `site.webmanifest` declared `favicon-512.png` as `512x512` while the file was actually 1254×1254, and no icon declared `purpose: "maskable"`.
15. A visible `[Add exact years / press experience details]` placeholder shipped in the About body copy.
16. No local vocabulary beyond "Bengaluru, India" — no `Hoskote`, no `Karnataka`, no `geo.region`, and no service-area statement.
17. `llms.txt` claimed the gallery organises photographs into Events and Corporate; the gallery contains no event or corporate images.

## 4. Changes made

Baseline (28 Sep pass, retained):

- Head: canonical, `og:url`, absolute `og:image`/`twitter:image`, `og:locale`, `geo.placename`, robots meta, favicon links, manifest, static `@graph` JSON-LD.
- `buildLdJson()` patches the static graph (never wipes it, never emits `/_blob/` URLs).
- `ROUTE_SEO` + `applyRouteSeo()`: per-route title/description/canonical/OG, applied in `render_route()` (admin view excluded).
- `render_route()` understands path routes (`/about` …) and only forces `admin` when no explicit route was requested.
- `vercel.json`: rewrites for `/about`, `/services`, `/gallery`, `/contact`, `/admin/`; cache + Content-Type headers for sitemap/robots/llms files.
- `<noscript>` block with real NAP + crawlable links to path routes.
- Gallery keyboard access, lightbox dialog semantics, menu `aria-expanded`, heading order, `--grey` contrast fix.

1 Oct pass:

- **Domain migration.** Old-origin references replaced with `https://www.swaroopstudios.com` in the HTML (static canonical, `og:url`, OG/Twitter image URLs, JSON-LD), `SITE_ORIGIN`, `robots.txt`, `sitemap.xml`, `llms.txt` and `llms-full.txt`.
- **Per-route social images.** Five 1200×630 JPEGs in `assets/og/` (`swaroop-studios-{home,about,services,gallery,contact}.jpg`), each cropped from an existing archive photograph. `ROUTE_SEO` gained `image` + `imageAlt`; `applyRouteSeo()` now sets `og:image`, `og:image:secure_url`, `og:image:alt`, `og:image:width/height`, `twitter:image` and `twitter:image:alt` per route. The static head was updated to match the home route so no-JS crawlers and social scrapers see the same 1200×630 card.
- **Stale-image clobber removed.** `setOgImage()` and the `buildLdJson()` fallback no longer hardcode `assets/images/dsc05478-1800.jpg`, which would have overwritten the route-specific card after render.
- **Structured data expanded** from 2 nodes to 12: `ProfessionalService` (with `areaServed` for Bengaluru/Hoskote/Karnataka, `addressRegion`, `logo`, `knowsAbout`), `WebSite`, `OfferCatalog`, five `Service` nodes with a `ServiceChannel` pointing at `/contact`, and four `VideoObject` nodes for the real films. `BreadcrumbList` is added and removed at runtime per route (`applyBreadcrumb()`) so it only ever matches the rendered view.
- **Local SEO.** `geo.region`/`ICBM` meta, a service-area paragraph on About and Contact, a local-aware lede on Services, and local wording in the `<noscript>` block.
- **Visible FAQ** on `/contact` — six questions on coverage, city weddings, films, booking, VIP confidentiality and studio portraits, built on native `<details>`/`<summary>` with matching styles. Deliberately **not** marked up as `FAQPage`: ordinary business sites are not currently eligible for FAQ rich results, so the schema would be noise.
- **Placeholder removed.** The About `[Add exact years / press experience details]` marker was replaced with copy limited to facts the site already publishes.
- **Internal links.** Descriptive contextual links added on Home and About into `/gallery` and `/about`.
- **Icons.** `favicon-512.png` resized to a true 512×512; `favicon-maskable-512.png` added (opaque `#141310` field, logo at 50% width — inside the 80% safe zone) and declared `purpose: "maskable"`; `mask-icon` link added.
- **Verification hooks.** Commented-out `google-site-verification` / `msvalidate.01` placeholders in the head, so nothing invalid ships until tokens are issued.
- **Crawler files.** `sitemap.xml` `lastmod` refreshed to 2026-10-01; `llms.txt` and `llms-full.txt` corrected on service areas and the gallery-category claim.

## 5. Files created

`robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, `favicon.svg`, `site.webmanifest`, `SEO_AUDIT.md` (this file), `AI_DISCOVERABILITY.md`, `assets/og/swaroop-studios-{home,about,services,gallery,contact}.jpg`, `favicon-maskable-512.png`, `SEO_KEYWORD_MAP.md`.

## 6. Files modified

`Swaroop Studios (2).html` (head, CSS, JSON-LD, `ROUTE_SEO`/`applyRouteSeo`/`applyBreadcrumb`/`buildLdJson`/`setOgImage`, About and Contact copy, FAQ markup, `<noscript>`), `site.webmanifest`, `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, `vercel.json` (favicon caching, from concurrent work).

## 7. Routing findings

`#/home` is purely client-side; crawlers/social scrapers never execute the route change, so all hash views shared one title/description/OG image. Path routes (`/about` etc.) rewrite to the same document and the router honours them; hash links keep working and win when present. Canonicals/sitemap/OG always use path form. `/admin` and `/admin/` still resolve to the admin view only when no other route is requested.

## 8. Sitemap strategy

Single `sitemap.xml`, 5 canonical indexable URLs (`/`, `/about`, `/services`, `/gallery`, `/contact`). Excluded: `/admin`, `/api/*`, private galleries, query/hash variants. Hash fragments are never listed — sitemap URLs must be fetchable documents. The gallery is a fixed archive with no per-story URLs, so a static sitemap is correct; if per-story URLs are ever added, generate them from `data/gallery.json` + `LOCAL_GALLERY` ids. No image sitemap: the `images` sitemap extension is deprecated and ignored in favour of image discovery through `srcset`, `sizes` and image sitemap reporting in Search Console.

## 9. Robots strategy

`Allow: /` for all legitimate crawlers (Googlebot, Bingbot included — no per-bot blocks needed today). `Disallow: /admin`, `/admin/`, `/api/`. Explicit `Allow: /assets/` so media stays indexable. Sitemap referenced with the custom origin. No AI-bot blocks: public marketing content is meant to be understood by answer engines; private areas are excluded by path rules, not by bot name. No per-AI-crawler rules were added — they would add maintenance cost with no current benefit; revisit if crawl abuse is observed.

## 10. AI/LLM discoverability strategy

See `AI_DISCOVERABILITY.md`. `llms.txt` (concise) + `llms-full.txt` (full reference incl. claims policy) complement sitemap/robots/JSON-LD/semantic HTML. All facts sourced from the repo (`CONTACT` block, services markup, gallery data); no awards, ratings, pricing or locations invented. Both files now state the real service area and no longer claim populated event/corporate gallery categories.

## 11. Structured data strategy

Static `@graph`, 12 nodes, no JavaScript required:

| Node | Notes |
|---|---|
| `ProfessionalService` | name, url, description, `foundingDate` 1972, phone, email, `address` (Bengaluru, Karnataka, IN), `areaServed` (Bengaluru, Hoskote, Karnataka), `knowsAbout`, `logo`, Instagram `sameAs`, OG image |
| `WebSite` | name, url, `inLanguage: en-IN`, `publisher` → `#studio` |
| `OfferCatalog` | the five services, referenced by `@id` so each is described once |
| `Service` ×5 | wedding, event, corporate, portrait/headshot, complete coverage — each with `provider` → `#studio` and a `ServiceChannel` (`/contact` + phone) |
| `VideoObject` ×4 | the four films with real `contentUrl` (`/assets/videos/*.mp4`), poster `thumbnailUrl`, factual names/descriptions |

`BreadcrumbList` is emitted at runtime only, and only for non-home routes, so a no-JS crawler is never shown a breadcrumb trail that contradicts the document it fetched.

Deliberately omitted: `Review`/`AggregateRating` (no reviews published), `FAQPage` (not eligible for rich results on business sites), street address / `geo` coordinates (none published), `availableLanguage` (no published language list), `isFamilyFriendly` and `uploadDate` (no published content ratings or upload dates), any Google Business Profile `sameAs` (no URL or place ID supplied yet).

## 12. Image SEO findings

Strong base: AVIF+JPEG, correct `sizes`, lazy + async everywhere except hero (`eager`, `fetchpriority="high"`), intrinsic dimensions present, descriptive alt text in `LOCAL_IMAGES`. Social images are now route-specific, absolute, 1200×630, with `type`, `secure_url` and alt text that matches the existing caption for the source photograph. No alt text was keyword-stuffed. Remaining: 2 unreferenced files (`dsc04330a-2400.avif`, `studio-story-replacement.svg`) left in place — harmless.

## 13. Video SEO findings

All eight MP4 variants are H.264, silent, and fast-start (`moov` atom before `mdat`), at 1920×1080 and 1280×720. Verified durations: intro band 61 s, reception film 316 s, studio teaser 58 s, wedding film 127 s. `VideoObject` is now included because the films have stable, public `contentUrl`s — the previous pass omitted them when they were hash-only. Posters exist on every film; `muted`/`playsinline`/dimensions/aria-labels are correct. No preloading was added for SEO: the films total ~297 MB and aggressive preloading would regress mobile payload. The video playback defects recorded in `AUDIT_REPORT.md` (P1) remain open and are deliberately not mixed into this SEO change.

## 14. Accessibility findings

Fixed: gallery keyboard access, menu `aria-expanded`, lightbox dialog semantics + focus, heading order, grey contrast. The FAQ uses native `<details>`/`<summary>`, so it is keyboard-operable and screen-reader friendly without extra script; a visible focus ring is defined for the summary. Not changed (brand risk): terracotta eyebrow 4.15:1, service-card title scrim, intro-band film has no pause control (background element; reduced-motion users get no download).

## 15. Performance findings

No payload regressions from this work: no asset renames, no added blocking requests, and the five OG images (~552 KB total) are only fetched by social scrapers, never by the page itself. Manifest/favicon files are tiny and non-blocking. LCP/CLS drivers (JS-injected hero, video weight) are unchanged. Media keeps 7-day + SWR caching; SEO text files get 1-hour + SWR. The performance findings in `AUDIT_REPORT.md` (P1 video loading, P1 gallery `srcset`, desktop CLS) predate this pass and remain open.

## 16. Remaining recommendations

1. Attach `swaroopstudios.com` / `www.swaroopstudios.com` in Vercel, verify DNS and TLS, and confirm the apex and `www` hosts redirect to a single canonical host with a 301. This must be verified before the canonical changes in this pass are relied upon.
2. Supply the Google Business Profile Maps URL or place ID, then add it to `sameAs` in the `ProfessionalService` node and to the footer/contact links.
3. Uncomment the `google-site-verification` / `msvalidate.01` tags when the tokens are issued, and submit `sitemap.xml` in Search Console and Bing Webmaster Tools.
4. Review the per-route titles and descriptions against actual search-query data once impressions arrive; they are written for local intent, not for volume.
5. Add server-side enquiry storage or honest WhatsApp-handoff copy (out of SEO scope; flagged by prior audit — the form currently confirms receipt without storing anything).
6. Resolve the P1 findings in `AUDIT_REPORT.md` separately: editorial videos load and autoplay off-screen, and gallery images ship without `srcset`.
7. Run Lighthouse on the deployed custom domain and compare against the recorded baseline.

## 17. Validation results

- Inline scripts extracted and syntax-checked with `node --check` — PASS, 0 errors.
- JSON-LD parses; 12 nodes; every absolute URL inside it is either `https://schema.org`, the canonical origin, or the intentional Instagram profile — PASS.
- Per-route SEO logic executed against a DOM stub: all 5 routes set a distinct title, description, canonical, `og:image`, `og:image:secure_url`, 1200×630 dimensions, image alt and `twitter:image`; home emits no breadcrumb; the other four emit `Home > <Section>`; exactly one `BreadcrumbList` exists after navigating all five routes (no duplication); `@context` preserved — PASS.
- Tag balance for `main`, `section`, `details`, `summary`, `footer`, `noscript` — balanced. No duplicate `og:*` tags. No `[Add …]` placeholders remain in the HTML — PASS.
- Title lengths 50–57 chars; meta description lengths 127–150 chars — within display limits.
- `sitemap.xml` parses; 5 absolute URLs, no hashes, `lastmod` 2026-10-01 — PASS.
- `robots.txt` allows `/` + `/assets/`, disallows `/admin`, `/admin/`, `/api/`, references the custom-domain sitemap — PASS.
- `site.webmanifest` parses; declared icon sizes now match real pixel dimensions; a `maskable` icon is declared with its logo inside the safe zone — PASS.
- OG images: all five are valid `mjpeg` 1200×630 `yuvj420p` JPEGs; mean luminance tracks each source crop within ~15/255, so no blank or wrong-region crop shipped.
- No old-origin reference remains in shipped code or config; the only occurrences are historical context in `AUDIT_REPORT.md` / `AUDIT_REPORT_2026-09-27.md`.
- No TypeScript/lint/test/build tooling exists in this repo (static site), and `pnpm` is not installed — nothing to run; noted.
- Lighthouse / live crawl against the custom domain not yet possible — deferred until DNS and deployment are confirmed.

## 18. Verified entity information (factual audit)

Every value asserted in the structured data was checked against explicit repository source. Verdict: **all retained — nothing invented.**

| Value | Verdict | Explicit source evidence |
|---|---|---|
| `name`: "Swaroop Studios" | RETAIN | Header brand lockup, `<title>`, footer, meta author — consistent everywhere; no variant names in repo |
| `alternateName`: "SWAROOP STUDIOS" | RETAIN | Header and footer brand lockups render this in capitals |
| `url`: `https://www.swaroopstudios.com/` | RETAIN | Custom domain confirmed by the owner on 1 Oct 2026; isolated in `SITE_ORIGIN` for one-line swap |
| `description` | RETAIN | Matches the site's own meta description |
| `foundingDate`: "1972" | RETAIN | "SINCE 1972" in header + footer, heritage timeline "1972 — The beginning", manifest and metadata. The former About placeholder is gone, so nothing now contradicts the year |
| `telephone` / `email` | RETAIN | `CONTACT.phone` / `CONTACT.email`, the source of all rendered phone and mailto links |
| `address.addressLocality`: "Bengaluru", `addressCountry`: "IN" | RETAIN | `CONTACT.location`: "Bengaluru, India"; "IN" is the ISO mapping of the published "India". No street address is published, so none is claimed |
| `address.addressRegion`: "Karnataka" | RETAIN | Bengaluru is the capital of Karnataka; the region is now stated in visible copy the owner has seen |
| `areaServed`: Bengaluru, Hoskote, Karnataka | RETAIN (owner-supplied) | Hoskote and Karnataka were supplied by the owner as real service areas and are now published in visible copy on About and Contact |
| `sameAs`: Instagram only | RETAIN | `CONTACT.instagram`; a repo-wide search confirms no Facebook/YouTube/X/LinkedIn profiles exist. Google Business Profile exists but no URL or place ID has been supplied, so nothing is listed yet |
| `image` / `logo` | RETAIN | Five 1200×630 JPEGs in `assets/og/` verified on disk; `favicon.svg` verified |
| `Service` ×5 | RETAIN | Titles, descriptions and bullet lists are taken from the services markup and service cards, including the coverage items actually listed on the page |
| `ServiceChannel.serviceUrl` → `/contact` | RETAIN | The contact route is the site's real enquiry path |
| `VideoObject` ×4 | RETAIN | Files, posters and durations verified with `ffprobe`; names and descriptions reuse the site's own on-page labels ("wedding film", "reception film", "studio teaser") |
| `WebSite.inLanguage: "en-IN"` | RETAIN | `<html lang="en">`, `og:locale: en_IN`, all content in English |

Excluded after checking: no awards, reviews, ratings, prices, team rosters, client counts, years-of-experience figures or additional locations appear anywhere in source. "Award ceremonies" is a corporate service offered, not an award won. WhatsApp (+91 90360 55099) is real repo data but is not a schema-expected business field, so it lives in the contact copy and the AI files only.

## 19. Reconciliation with origin/main (28 Sep 2026, pre-deployment)

- Previous HEAD `bf877fa` was a direct ancestor of `origin/main`; fast-forwarded to `cc31220` ("Swap the about page portrait image"), then re-applied the SEO work. Nothing committed, nothing pushed.
- Integrated upstream (20 commits): interactive service cards + VIP enquiry CTA, mobile title/hero/gallery fixes, shared video playback engine with iOS/Safari hardening and media recovery (`recoverEditorialVideo`, `data-doc-id` gallery recovery), gallery manifest seeding (32 images in `data/gallery.json`), portrait gallery assets, about-portrait swap, `applySelectedService()` contact pre-fill.
- Conflicts (3, all in `Swaroop Studios (2).html`, all resolved by keeping both sides): `LOCAL_GALLERY` additions (kept upstream's 3 new portrait entries) and the two gallery renderers (combined upstream's `data-doc-id` with the SEO keyboard `tabindex`/`role`/`aria-label`).
- `render_route()` auto-merged correctly and was verified by reading: pathname/hash route resolution + `/admin` lock fix + `applyRouteSeo()` (SEO) combined with `applySelectedService()` (upstream).
- Video policy note: the merged tree uses upstream's newer playback engine (observer + recovery, no Save-Data/2G gate). It was kept verbatim per the no-revert rule; SEO work does not touch video loading, so no new payload was introduced by this implementation.
- `vercel.json` merged clean (upstream never touched it). `data/gallery.json` taken from upstream (4 categories, 32 images). Untracked local portrait duplicates were checksummed identical to the now-tracked versions and removed.

## 20. Working-tree note (1 Oct 2026)

The favicon/manifest/vercel.json icon work, plus the five OG images and this pass's HTML edits, are **uncommitted** local work. Nothing has been committed, pushed or deployed. `AUDIT_REPORT.md` records a pre-existing inconsistency in its own severity table (F-11 is counted as P3 but labelled P2 in §16); that is a documentation fix and independent of this SEO pass.