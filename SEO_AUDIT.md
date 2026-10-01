# Swaroop Studios — SEO + AI Discoverability Audit

**Date:** 28 September 2026
**Scope:** complete technical SEO + AI discoverability implementation. No redesign; no visual-identity changes except a contrast fix and heading-tag swaps with visually identical CSS.

## 1. Current architecture

- Static single-document site: `Swaroop Studios (2).html` (~2,240 lines, markup + CSS + vanilla JS, no framework, no build step, no package.json).
- Served by Vercel rewrites (`vercel.json`): `/` → the HTML document; `/admin` → same document.
- Client-side hash routing (`#/home`, `#/about`, `#/services`, `#/gallery`, `#/contact`); `/admin` detected via `location.pathname`.
- Images: pre-generated AVIF + JPEG committed to `assets/images/`; videos: 8 MP4s in `assets/videos/` with posters in `assets/posters/`.
- Admin/gallery API: `api/gallery.js` (serverless, GitHub-backed); seed data in `data/gallery.json`.
- Production origin: `https://www.swaroopstudios.com` (no custom domain found in repo, env, Vercel config, or content). Canonicals use this origin via the `SITE_ORIGIN` constant in-page.

## 2. Existing SEO implementation (before this work)

- `<title>`, meta description, OG tags (relative `og:image` — inconsistent for crawlers), Twitter card tags, `theme-color`, emoji data-URI favicon.
- Client-side JSON-LD (`ProfessionalService`, built by `buildLdJson()`, relative image, `{}` before JS runs — invisible to no-JS crawlers).
- No canonical, no `og:url`, no robots.txt (verified 404), no sitemap.xml (verified 404), no manifest, no llms.txt, no per-route metadata.

## 3. Problems found

1. Zero crawlable routes: everything behind `#/` hash fragments; sitemap/robots absent; crawlers see one undifferentiated document.
2. `/admin` navigation lock: pathname check forced `admin` view, killing all nav/footer links on `/admin`.
3. Relative `og:image` / JSON-LD `image`; legacy `/_blob/` asset URLs could leak into OG/JSON-LD via dead code paths.
4. Duplicate-title risk: one static title for all five views; no per-route descriptions.
5. No-JS = blank page (all content JS-injected); no `<noscript>` fallback.
6. Gallery tiles not keyboard-operable (plain divs, click-only); mobile menu button had no `aria-expanded`; lightbox had no dialog semantics.
7. Heading skips: `h2 → h4` (timeline, VIP list), `h1 → h4` (contact), `h5` footer headings with no `h2` context.
8. Contrast: `--grey #8C887F` on paper = 3.36:1 (eyebrows, contact location, footer note, placeholders).
9. Favicon/manifest missing; `apple-touch-icon` missing.
10. No AI/LLM machine-readable files; crawler policy undocumented.

## 4. Changes made

- Head: canonical, `og:url`, absolute `og:image`/`twitter:image`, `og:locale`, `geo.placename`, robots meta, `favicon.svg` + `apple-touch-icon` + `site.webmanifest`, static `@graph` JSON-LD (ProfessionalService + WebSite).
- `buildLdJson()` now patches the static graph (never wipes it, never emits `/_blob/` URLs); `setOgImage()` pins the absolute canonical image.
- `ROUTE_SEO` + `applyRouteSeo()`: per-route title/description/canonical/OG, applied in `render_route()` (admin view excluded).
- `render_route()` now understands path routes (`/about` …) and only forces `admin` when no explicit route was requested — fixes the `/admin` nav lock.
- `vercel.json`: rewrites for `/about`, `/services`, `/gallery`, `/contact`, `/admin/`; cache + correct Content-Type headers for sitemap/robots/llms files.
- `<noscript>` block with real NAP + crawlable links to path routes.
- Gallery items: `tabindex`, `role="button"`, `aria-label`, Enter/Space activation; lightbox `role="dialog"` + focus management.
- Menu button: `aria-expanded`/`aria-controls`/`aria-label`, synced on open/close.
- Headings: timeline/VIP `h4`→`h3`, contact `h4`→`h2.f-head`, footer `h5`→`h2.f-head`, with CSS extended so rendering is pixel-identical.
- `--grey` darkened `#8C887F` → `#6F6B62` (≈4.9:1 on paper) for eyebrows, placeholders, contact/footer notes.
- New root files: `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, `favicon.svg`, `site.webmanifest`.

## 5. Files created

`robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, `favicon.svg`, `site.webmanifest`, `SEO_AUDIT.md` (this file), `AI_DISCOVERABILITY.md`.

## 6. Files modified

`Swaroop Studios (2).html` (head, CSS selectors, router, SEO script, gallery/lightbox/menu a11y, noscript), `vercel.json` (rewrites + headers).

## 7. Routing findings

`#/home` is purely client-side; crawlers/social scrapers never execute the route change, so all hash views shared one title/description/OG image. Path routes (`/about` etc.) now rewrite to the same document and the router honours them; hash links keep working and win when present. Canonicals/sitemap/OG always use path form. `/admin` and `/admin/` still resolve to the admin view only when no other route is requested.

## 8. Sitemap strategy

Single `sitemap.xml`, 5 canonical indexable URLs (`/`, `/about`, `/services`, `/gallery`, `/contact`). Excluded: `/admin`, `/api/*`, private galleries, query/hash variants. Gallery is currently a fixed archive (no dynamic public project URLs), so a static sitemap is correct; if per-story URLs are ever added, generate them from `data/gallery.json` + `LOCAL_GALLERY` ids.

## 9. Robots strategy

`Allow: /` for all legitimate crawlers (Googlebot, Bingbot included — no per-bot blocks needed today). `Disallow: /admin`, `/admin/`, `/api/`. Explicit `Allow: /assets/` so media stays indexable. Sitemap referenced with the production origin. No AI-bot blocks: public marketing content is meant to be understood by answer engines; private areas are excluded by path rules, not by bot name. No per-AI-crawler rules were added — they would add maintenance cost with no current benefit; revisit if crawl abuse is observed.

## 10. AI/LLM discoverability strategy

See `AI_DISCOVERABILITY.md`. `llms.txt` (concise) + `llms-full.txt` (full reference incl. claims policy) complement sitemap/robots/JSON-LD/semantic HTML. All facts sourced from the repo (CONTACT block, services markup, gallery data); no awards/ratings/pricing/locations invented.

## 11. Structured data strategy

Static `@graph`: `ProfessionalService` (name, url, description, foundingDate 1972, phone, email, Bengaluru address, Instagram `sameAs`, absolute image) + `WebSite`. Omitted deliberately: `Review`/`AggregateRating` (no reviews published), `VideoObject` (films are looping atmosphere pieces with hash-only URLs — no stable watch URLs), `BreadcrumbList` (single-document views), `LocalBusiness` street address (none published). Runtime script only upgrades the image URL.

## 12. Image SEO findings

Strong base: AVIF+JPEG, correct `sizes`, lazy + async everywhere except hero (`eager`, `fetchpriority="high"`), intrinsic dimensions present, descriptive alt text in `LOCAL_IMAGES`. No changes to assets or alt text (no keyword stuffing; decorative placeholders unchanged). `og:image` now absolute with dimensions/type. Remaining: 2 unreferenced files (`dsc04330a-2400.avif`, `studio-story-replacement.svg`) left in place — harmless.

## 13. Video SEO findings

This working copy already contains the conservative loader (preload `metadata`, Save-Data/2G guard, IntersectionObserver gating, reduced-motion respect) — no changes made. Posters present on all films; `muted`/`playsinline`/dimensions/aria-labels correct. `VideoObject` intentionally omitted (see §11). Do not add aggressive preloading for SEO; it would regress mobile payload.

## 14. Accessibility findings

Fixed: gallery keyboard access, menu `aria-expanded`, lightbox dialog semantics + focus, heading order, grey contrast. Not changed (brand risk): terracotta eyebrow 4.15:1, service-card title scrim, intro-band film has no pause control (background element; reduced-motion users get no download). Verified no duplicate ids introduced.

## 15. Performance findings

No payload changes in this work (no asset renames, no added blocking requests; manifest/favicon are tiny and non-blocking). LCP/CLS drivers (JS-injected hero, video weight) were already conservative in this copy; the 94 MB regression described in prior audits applies to a newer commit (`109d1ad`) than this working copy (`bf877fa`) — confirm before deploying. Cache: media keeps 7-day + SWR; SEO text files get 1-hour + SWR.

## 16. Remaining recommendations

1. Rebase/merge with `origin/main` (this copy is behind; verify the video-regression fixes and `/admin` behaviour survive the merge).
2. Fill or remove the two About-page `[…]` placeholders before any press/PR push.
3. Consider real square PNG `apple-touch-icon` + OG image at 1200×630 for pixel-perfect social cards (current JPG works; not blocking).
4. Add server-side enquiry storage or honest WhatsApp-handoff copy (out of SEO scope; flagged by prior audit).
5. Run Lighthouse on the deployed URL post-merge and compare with baseline (P61/A94/BP100/SEO100, LCP 4.5s, CLS 0.592, 8.6MB).

## 17. Validation results

- `node --check api/gallery.js` — PASS (untouched).
- Inline scripts extracted and syntax-checked with node — PASS, 0 errors.
- `sitemap.xml` parses (5 URLs, all absolute, no hashes) — PASS.
- `robots.txt` allows `/` + `/assets/`, disallows `/admin`, `/admin/`, `/api/`, references sitemap — PASS.
- JSON-LD block parses, `@graph` with ProfessionalService + WebSite, absolute URLs — PASS.
- `vercel.json` parses; rewrites cover `/about /services /gallery /contact /admin/`; no localhost/preview URLs anywhere — PASS.
- Served locally: `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt`, `/site.webmanifest`, `/favicon.svg` all return 200 with expected content — PASS.
- No TypeScript/lint/test/build tooling exists in this repo (static site) — nothing to run; noted.
- Lighthouse re-run not available in this environment — deferred to post-deploy (see §16.5).

## 18. Verified entity information (pre-deployment factual audit, 28 Sep 2026)

Every value in the `ProfessionalService` JSON-LD was checked against explicit repository source. Verdict: **all retained — nothing invented, nothing removed.**

| JSON-LD value | Verdict | Explicit source evidence |
|---|---|---|
| `name`: "Swaroop Studios" | RETAIN | Header brand lockup, `<title>`, footer, meta author — consistent everywhere; no variant names in repo |
| `url`: production origin | RETAIN | Only deployed origin known to repo (`swaroop-studios.vercel.app` per live audit); isolated in `SITE_ORIGIN` for one-line swap if a custom domain is confirmed |
| `description`: "Photography studio established in 1972, …" | RETAIN | Verbatim from the site's own meta description (head, line 7) |
| `foundingDate`: "1972" | RETAIN | Explicitly published in multiple places: meta description "established in 1972", "SINCE 1972" tagline in header + footer, heritage timeline "1972 — The beginning … Swaroop Studios opens its doors." NOT inferred. Caveat: the About page carries a `[Add exact year / founding details]` placeholder next to its 1972 line — the year itself is the site's published claim, but recommend the owner confirm it is the literal founding year before deployment |
| `telephone`: "+91 99004 86574" | RETAIN | `CONTACT.phone` block (source of all rendered phone links) |
| `email`: "swaroopstudios@gmail.com" | RETAIN | `CONTACT.email` block (source of all rendered mailto links) |
| `address.addressLocality`: "Bengaluru", `addressCountry`: "IN" | RETAIN | `CONTACT.location`: "Bengaluru, India" — "IN" is the ISO mapping of the published "India", not a new fact. No street address published, so none claimed |
| `sameAs`: instagram URL only | RETAIN | `CONTACT.instagram`; repo-wide search confirms no Facebook/YouTube/X/LinkedIn profiles exist, so no other profile could be listed without inventing it |
| `image`: absolute OG image URL | RETAIN | File verified on disk (`assets/images/dsc05478-1800.jpg`, 487 KB); URL absolutised with production origin |
| `WebSite` name/url/`inLanguage: en` | RETAIN | Brand name, canonical origin, `<html lang="en">` |

Excluded after checking: no awards, reviews, ratings, prices, team, client counts, or extra locations appear anywhere in source — the two nearest misses were verified benign ("award ceremonies" = a corporate service offered, not an award won; "years of experience" = vague About copy flagged with its own placeholder, not a countable claim, and not used in any schema). WhatsApp number (+91 90360 55099) is real repo data but intentionally kept out of JSON-LD (not a schema-expected business field; it lives in `llms.txt`/`llms-full.txt` contact lines instead).

## 19. Reconciliation with origin/main (28 Sep 2026, pre-deployment)

- Previous HEAD `bf877fa` was a direct ancestor of `origin/main`; fast-forwarded to `cc31220` ("Swap the about page portrait image"), then re-applied the SEO work. Nothing committed, nothing pushed.
- Integrated upstream (20 commits): interactive service cards + VIP enquiry CTA, mobile title/hero/gallery fixes, shared video playback engine with iOS/Safari hardening and media recovery (`recoverEditorialVideo`, `data-doc-id` gallery recovery), gallery manifest seeding (32 images in `data/gallery.json`), portrait gallery assets, about-portrait swap, `applySelectedService()` contact pre-fill.
- Conflicts (3, all in `Swaroop Studios (2).html`, all resolved by keeping both sides): `LOCAL_GALLERY` additions (kept upstream's 3 new portrait entries) and the two gallery renderers (combined upstream's `data-doc-id` with the SEO keyboard `tabindex`/`role`/`aria-label`).
- `render_route()` auto-merged correctly and was verified by reading: pathname/hash route resolution + `/admin` lock fix + `applyRouteSeo()` (SEO) combined with `applySelectedService()` (upstream).
- Video policy note: the merged tree uses upstream's newer playback engine (observer + recovery, no Save-Data/2G gate). It was kept verbatim per the no-revert rule; SEO work does not touch video loading, so no new payload was introduced by this implementation.
- `vercel.json` merged clean (upstream never touched it). `data/gallery.json` taken from upstream (4 categories, 32 images). Untracked local portrait duplicates were checksummed identical to the now-tracked versions and removed.
- Post-merge validation: JS syntax PASS, no conflict markers, no duplicate markup ids, JSON-LD entity values re-verified (§18), all six root SEO files serve 200 locally.
