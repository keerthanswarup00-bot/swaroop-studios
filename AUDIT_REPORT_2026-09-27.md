# Swaroop Studios — Production Audit Report

**Audit date:** 27 September 2026
**Auditor:** Claude (read-only static + runtime audit)
**Repository:** `https://github.com/keerthanswarup00-bot/swaroop-studios.git`
**Audited commit:** `9d0ded1` — *Fix viewport-triggered video autoplay* (`origin/main`)
**Live URL audited:** `https://swaroop-studios.vercel.app`
**Local working copy audited for comparison:** `bf877fa` (the cinematic-intro-band commit)

> **Files modified by this audit: NONE.** No source file, tracked file, or configuration file was changed. No commit, no branch, no push. This report is the only file created, and it is untracked.

---

## 1. Executive Summary

Swaroop Studios is a visually strong, single-file static site with a small Vercel serverless API. The typography, art direction and layout discipline are good: no horizontal overflow at any tested width, all 8 videos are correctly encoded with `moov`-before-`mdat` and no audio tracks, all 186 generated AVIF variants and 41 JPEG fallbacks exist on disk, Brotli is on, HSTS is set, and the homepage JSON-LD resolves correctly at runtime.

However, the audit found **94 distinct findings: two P0, thirteen P1, thirty-two P2 and forty-seven P3**. (Seventeen of these are cross-referenced in more than one section, so 111 severity-tagged rows appear in the tables below; see *Counting rules* in the Final Counts section.) The most serious are behavioural, not cosmetic:

1. **The site is completely blank without JavaScript.** All six `<main>` regions are `display:none` until JS adds `.active`, and every photograph is injected by script. Verified with JavaScript disabled: zero visible page content, empty hero, empty gallery.
2. **94 MB of video is downloaded on a first homepage visit**, with the 73 MB reception film autoplaying from a section far below the fold. This is a **regression** introduced by `109d1ad` — the IntersectionObserver lazy-load gate was removed from `syncEditorialVideos()`, the `shouldConserveVideoData()` call sites were deleted, and `video.preload` was changed from `"metadata"` to `"auto"`.
3. **`prefers-reduced-motion: reduce` does not prevent the 50.6 MB gallery film from downloading and autoplaying**, because the observer calls the loader with `force`, which bypasses the reduced-motion guard.
4. **Enquiries are never stored anywhere.** The form opens a WhatsApp deep link and then shows *"your enquiry has been received"* even if the user cancels. The database code path requires `window.claude.use`, which does not exist on Vercel, so `dbCap` is permanently `null`.
5. **Navigation is completely dead on `/admin`** — the router forces the admin route whenever the pathname is `/admin`, so every nav and footer link is inert.
6. **The gallery cannot be opened with a keyboard.** All 29 gallery items are plain `<div>` elements with click handlers and no `role`, `tabindex` or key handling.
7. **The closed mobile menu is still in the tab order** — six invisible links are focusable, and the menu button has no `aria-expanded`.
8. **The gallery admin API writes from a stale deploy-time snapshot**, so two edits made before a Vercel redeploy silently overwrite each other.

Most of the P1s are cheap to fix — several are one-line reversions to `109d1ad^`. The two P0s and the enquiry-storage gap need structural work.

**Recommended order:** fix the video regressions (#2, #3) and the `/admin` navigation lock (#5) first — they are the highest-impact and lowest-risk changes — then the stale-write data loss (#8), which is the only confirmed data-loss defect.

---

## 2. Project Overview

Swaroop Studios is the marketing site for a photography studio in Bengaluru, India, operating since 1972. It presents six client-side routes (Home, About, Services, Gallery, Contact, Admin), a curated local image archive, four silent cinematic video bands, and a self-service gallery admin backed by GitHub.

**Route → pathname/hash model.** The site is a single HTML document. Routing is hash-based (`#/gallery`), with one exception: Vercel rewrites the path `/admin` to the same document, and the router detects it via `location.pathname`.

**Content model.** All photography is committed to the repository as pre-generated responsive assets (AVIF + JPEG fallbacks, 5 widths each) and referenced from a hard-coded `LOCAL_IMAGES` dictionary in the HTML. There is no CMS, no build step, and no runtime image service.

**Admin model.** A Vercel Node serverless function (`api/gallery.js`) authenticates with a single shared password and writes gallery JSON plus image binaries directly into the GitHub repository via the Contents API, which then triggers a Vercel redeploy.

**Business-critical flows.**
- Public browsing: Home → About → Services → Gallery → Contact.
- Enquiry capture: Contact form → WhatsApp deep link.
- Gallery management: `/admin` → password → GitHub commit → Vercel redeploy → new public gallery.

---

## 3. Tech Stack & Architecture

| Layer | Technology | Notes |
|---|---|---|
| Markup | Hand-authored HTML5, one file | 2,240 lines deployed |
| Styling | Hand-authored CSS in a single `<style>` block | ~535 lines |
| Behaviour | Vanilla ES2020 JavaScript, two inline `<script>` blocks | No framework, no bundler |
| Fonts | Google Fonts (Fraunces + Inter) | Third-party runtime dependency |
| Images | Pre-generated AVIF + JPEG, committed to git | 186 AVIF variants + 41 JPEG fallbacks referenced from `LOCAL_IMAGES`; 187 AVIF + 41 JPEG + 1 SVG files tracked |
| Video | H.264 MP4, two renditions per film | 8 files, 296.6 MB total, all audio-free |
| Server | Vercel Node.js serverless function | CommonJS, `api/gallery.js`, 46 lines |
| Persistence | GitHub repository contents via REST API | `data/gallery.json` + `assets/images/gallery/` |
| Hosting | Vercel static + serverless | `vercel.json`, no framework preset |
| Build | **None** | No `package.json`, lockfile, bundler, or build script |
| Lint / Format / Types | **None** | No ESLint, Prettier, TypeScript, or editor config |
| Tests | **None** | No unit, integration, or end-to-end tests |
| CI | **None** | No workflow files |

**Architecture assessment.** For a five-route brochure site this is a defensible architecture: no framework tax, no build step, and an extremely small attack surface. The cost is that every piece of state — routing, image injection, gallery data, video lifecycle, admin auth — lives in one 2,240-line document with no static analysis, no types, and no tests, which is exactly how the regressions in Section 9 went unnoticed.

The `dbCap` / `assetsCap` / `userCap` capability layer is a leftover from the Claude Artifacts host platform. It gates roughly 200 lines of code (database slots, enquiry storage, the cropper, the featured-film manager, the `/_blob/` asset route) that can never initialise on Vercel because `initCaps()` returns `false` unless `window.claude.use` exists.

---

## 4. File & Component Inventory

### 4.1 Tracked source and configuration (6 files, all read in full)

| File | Lines | Bytes | Role |
|---|---|---|---|
| `Swaroop Studios (2).html` | 2,240 | 131,465 | Entire application: markup, CSS, both script blocks |
| `api/gallery.js` | 46 | 7,765 | Vercel serverless gallery/admin API, GitHub persistence |
| `vercel.json` | 24 | 483 | Rewrites for `/` and `/admin`; `/assets/*` cache header |
| `data/gallery.json` | 9 | 206 | Deploy-time gallery seed (4 categories, 0 images) |
| `.env.example` | 7 | 291 | Documented Vercel env vars, placeholders only |
| `.gitignore` | 2 | 18 | `.vercel`, `.DS_Store` |

### 4.2 Media assets (241 tracked files)

| Group | Files | Size | Status |
|---|---|---|---|
| `assets/images/` | 229 (187 AVIF, 41 JPEG, 1 SVG) | 65.1 MB | 186/186 expected AVIF variants present, 41/41 JPEG fallbacks present. 2 files unreferenced: `dsc04330a-2400.avif`, `studio-story-replacement.svg` |
| `assets/videos/` | 8 | 296.6 MB | 4 films × 1080p/720p |
| `assets/posters/` | 4 | 0.79 MB | 1 poster per film |
| `assets/images/gallery/` | 0 | 0 | Admin upload target — empty; no image has ever been published |

**Total tracked:** 247 files, 362.5 MB of assets. `.git` directory: 369 MB. Repository on disk: ~1.0 GB.

### 4.3 Untracked local-only files (not deployed)

| Path | Finding |
|---|---|
| `.vercel/` | 604 MB total. `project.json` links the project (`prj_9XE8JNW89opBtyMyBo7E0Hge6TCw`). |
| `.vercel/hero-staged/` | **Stale 269 MB duplicate of the entire site** (a 70 KB copy of the HTML from 25 Sep, plus a partial `assets/` tree). Not deployed. |
| `.vercel/output/` | Vercel build output. Not deployed. |
| `.vercel/.env.preview.local` | **SECRET DETECTED** — contains a live `VERCEL_OIDC_TOKEN` (1380 chars). Gitignored, so not committed and not deployed, but a live credential at rest on disk. Not reproduced here. |

### 4.4 Page/component map

| Route | Key components |
|---|---|
| Home | Full-bleed hero (3:2, `100svh` on mobile) → `.hero-sub` cinematic video band → `.intro-cinematic` full-bleed plate → `.heritage` (1972 chapter + 4-step timeline) → `.next-chapter` (Destiny cross-promo) → `#homeGalPreview` 6-tile archive preview → `#filmSection` (**dead, `display:none`**) → `.motion-feature` reception film → CTA |
| About | Page hero → portrait + biography (contains two unfilled placeholders) → tag chips → "1972 to today" split → CTA |
| Services | Page hero → 5 interactive `.svc` cards with `.svc-detail` panels → `.vip` dark VIP section → `.motion-feature` studio teaser → CTA |
| Gallery | Page hero → 5 category filters → 2 `.gallery-film` video figures (All / Wedding) → `#fullGalGrid` 29-tile CSS-columns masonry |
| Contact | Page hero → direct contact links → 7-field enquiry form |
| Admin | Session gate → password login → Enquiries list (**broken**) → 10 Site Photograph slots (**broken**) → Featured Film manager (**broken**) → Gallery image manager (**works**) |
| Global | Fixed header (2 responsive modes + hide-on-scroll), `#mobileNav` overlay, footer, `#lightbox`, `#videoModal` (**dead**), `#cropModal` (**dead**), 2 hidden file inputs |

### 4.5 Function inventory

- **Routing:** `render_route`, `resetNavbar`, `initNavbarScroll`
- **Video:** `prefersReducedMotion`, `shouldConserveVideoData` *(dead)*, `editorialSectionIsActive`, `updateEditorialVideoButton`, `loadEditorialVideo`, `playEditorialVideo`, `retryEditorialVideo`, `toggleEditorialVideo`, `syncEditorialVideos`, `initEditorialVideos`, `initIntroBandVideo`
- **Content:** `renderLocalImages`, `localImageMarkup`, `localAvifSrcset`, `localImageWidths`, `localGalleryImageId`, `localLightboxSrc`, `galleryItemImage`, `loadSiteImages`, `paintSlot`, `loadGallery`, `renderHomePreview`, `renderFullGallery`, `mixGalleryDocs`, `setGalleryCategory`
- **Overlays:** `openLightbox`, `paintLightbox`, `lbStep`, `openVideo`
- **Form:** inline `enquiryForm` submit handler
- **Admin:** `initAdmin`, `renderEnquiries`, `renderFilmAdmin`, `renderSlotGrid`, `renderAdminGallery`, `renderGalleryFilters`, `renderAdminGalleryCategoryOptions`, `addGalleryCategory`, `saveGalleryCategories`, `loadGalleryCategories`, `uploadGalleryProduction`, `triggerProductionGalleryUpload`, `galleryApi`
- **Cropper (dead):** `openCropper`, `buildCropFields`, `setupCropBox`, `clampAndPaint`
- **Capabilities (dead):** `initCaps`
- **Services:** `initServiceCards`, `applySelectedService`
- **Contact/SEO:** `applyContact`, `buildLdJson`, `setOgImage`
- **Reveal:** `initReveal`, `revealNew` *(no-op)*

---

## 5. Code Quality & Maintainability

**Overall:** functional and readable, but structurally fragile.

**Positives**
- Consistent naming, consistent CSS conventions, and coherent design-token variables in `:root`.
- No global namespace pollution beyond the implicit script scope; the code reads in the order it runs.
- Genuinely thoughtful comments explaining *why* non-obvious CSS decisions were made (crop behaviour, scrim direction, editorial rhythm).
- No `eval`, no `innerHTML` of raw user input, no third-party JS, no CDN-hosted code.

**Negatives**
- **2,240 lines in one document.** No separation of markup, style, and behaviour. Every change risks a merge conflict and every regression has no test to catch it.
- **No zero-dependency safety net:** no lint, no types, no tests, no CI. The Section 9 regressions were all silent — no console errors, no failed requests, nothing that any existing check would have surfaced.
- **Dead code is substantial and load-bearing for reader trust.** Roughly 200 lines depend on `window.claude`; the Featured Film section, video modal, and cropper are unreachable. A reader cannot tell dead code from working code without tracing Vercel's runtime.
- **`revealNew()` is an explicit no-op still called from two places**, with a comment saying the feature was "intentionally removed".
- **Magic strings and magic numbers** are pervasive: `'swaroop_admin'`, `28800`, `860`, `240`, `360`, `8 * 1024 * 1024`, `'silent'`, `':active'`. None are named.
- **Comment/code drift.** `.motion-toggle` copy is hard-coded as `action + " film"` regardless of what the video actually is, so the Studio page button reads "Play film" for a "studio teaser".
- **`window.__*` globals** (`__galleryDocs`, `__galleryRemoteData`, `__lbHome`, `__lbGallery`, `__m`) leak internal state onto `window` with no namespacing.

---

## 6. HTML & Semantic Markup

**Positives**
- Correct `<!DOCTYPE html>`, `lang="en"`, charset declared first.
- One `<h1>` per route; heading order is otherwise logical.
- Real `<header>`, `<nav>`, `<main>`, `<section>`, `<figure>`/`<figcaption>`, `<footer>`, `<label>`, `<button type>`, and `<form>` elements.
- `aria-required` on the two required fields; `aria-describedby` wiring to per-field error spans; `aria-pressed` on gallery filters; `aria-label` on all icon buttons; `alt` text on all 41 catalogue images and dynamically set on the lightbox image.
- `viewport-fit=cover` plus `env(safe-area-inset-*)` used consistently for the notch and home indicator.
- **Verified: zero duplicate `id` attributes** (73 static ids, 73 unique) and **zero duplicate label/`for` pairs**.

**Negatives**

| Category | Sev | File | Line | Issue | Impact | Fix |
|---|---|---|---|---|---|---|
| HTML | **P0** | `Swaroop Studios (2).html` | 182–183, 1067 (deployed) | All six `<main class="page">` elements are `display:none` and only one gets `.active` from JavaScript. Every photograph, poster and gallery tile is injected by script. | With JavaScript disabled the site renders **no content at all** — verified: 0 visible pages, empty hero, empty gallery, `href="#"` contact links, only nav and footer text. Any JS failure, blocked script, or non-executing crawler sees a blank page. | Make Home visible by default in the HTML (`class="page active"`), render the hero and first gallery images as real markup, and progressively enhance the remaining routes. |
| HTML | P2 | same | 1260 (DOMContentLoaded) | **Cross-reference of §8 row 4.** `initServiceCards()` and `initEditorialVideos()` run **before** `render_route()`, which is what makes pages visible. | If either function throws, `render_route()` never runs and the entire site is blank. This is a real fragility, not a hypothetical: the ordering puts two large functions ahead of the one that reveals content. | Call `render_route()` first, then the initialisers, each in its own `try/catch`. |
| HTML | P2 | same | 565, 683, 728, 785, 828, 870 | Six `<main>` landmarks exist in the DOM simultaneously. | Invalid landmark structure; assistive technology is entitled to treat the document as having six main regions. Only the CSS-hidden ones are currently ignored. | Keep one `<main>` and swap its contents, or use `<div role="main">` for the inactive routes. |
| HTML | P2 | same | 693–694, 710 | Unfilled editorial placeholders ship to production: `[Add exact years / press experience details]` and `[Add exact year / founding details]`. | Visible placeholder text in the live About page body copy. | Replace with real copy, or comment the lines out. |
| HTML | P3 | same | 670, 718 | `id="contact"` on a homepage CTA section and `id="about-contact"` on an About CTA, while `#/contact` is also a route. | Confusing ID space; `location.hash` anchor resolution in `render_route` can scroll to an unexpected element. | Prefix with something route-specific, e.g. `id="home-contact-cta"`. |
| HTML | P3 | same | 924–925, 938–941, 644–655, 910–923 | `<input id="videoInput">`, `#videoModal`, `#vmVideo`, `#filmSection`, `#cropModal` and their CSS/JS are present but unreachable in production. | ~40 lines of markup, ~15 CSS rules and ~30 JS lines shipped to every visitor for features that can never run. | Delete, or gate behind a documented feature flag. |

---

## 7. CSS Analysis

**Positives**
- A coherent token system in `:root` (paper tones, accent, two font families, `--hero-top`).
- Fluid type via `clamp()` throughout, with sensible minimums and maximums.
- Deliberate, documented responsive strategy: desktop horizontal scrims become mobile vertical scrims; the heritage timeline steps 4 → 2 → 1 columns; the services grid steps 12 → 2 → 1 column.
- `-webkit-` prefixes present for `backdrop-filter` and `appearance` where historically required.
- `overflow-wrap`, `box-sizing:border-box`, and `min-width:0` on all grid/flex children where needed — no overflow was observed anywhere.

**Negatives**

| Category | Sev | File | Line | Issue | Impact | Fix |
|---|---|---|---|---|---|---|
| CSS | **P2** | `Swaroop Studios (2).html` | 320–339, 339 (`.svc-detail`) | *(Canonical row — cross-referenced by §11 row 2.)* The `.svc-detail` panel is `position:absolute; inset:0` inside `.svc`, which is `overflow:hidden` with a fixed `aspect-ratio:4/5`. | **Verified clipping at every viewport from 761 px to 860 px** (iPad portrait, small laptops, split-screen). At 800 px the Corporate card needs 325 px of content in a 295 px box — 30 px is clipped and unreachable; at 761 px, 46 px is clipped. Below 761 px the grid switches to 2 columns and the bug disappears. The "Enquire about Corporate" CTA can be entirely hidden. | Replace the absolute overlay with a disclosure that expands the card, or allow the detail to scroll, or set `min-height` on `.svc` when `.is-open`. |
| CSS | P2 | same | 54 (`.eyebrow`), 71 (`.heritage__eyebrow`), 437 (`.contact-loc`), 451 (`.f-note`), 48 (placeholder) | *(Canonical row — cross-referenced by §16.1 row 3.)* Text colours below WCAG AA 4.5:1. | Measured live: `.eyebrow` `#8C887F` on `#FAF9F6` = **3.36:1** (used for "Studio film", "Wedding film", "STUDIO ADMIN"); `.heritage__eyebrow` = **4.15:1**; `.contact-loc` = **3.36:1**; `.f-note` = **3.36:1**; `input::placeholder` = **3.36:1**. | Darken `--grey` to at least `#6F6B62` and the heritage eyebrow to a darker terracotta; verify after. |
| CSS | P2 | same | 290 (`.svc .cap`) plus the gradient | *(Canonical row — cross-referenced by §16.1 row 4.)* Service card titles sit at the top of a caption whose gradient is `transparent → rgba(10,10,9,.72)` over a photo already dimmed to `brightness(.72)`. | Pixel-sampled: the h3 band contains **2.7% pure-white pixels**; white 16 px/600 text against the mean background is **3.94:1**, below AA. Parts of the title are genuinely unreadable depending on the frame. | Strengthen the gradient (start the scrim higher, raise peak opacity) or add a text-shadow. |
| CSS | P3 | same | 39 (`:root`) | `padding-top`/`padding-bottom: env(safe-area-inset-*)` applied to the root `<html>` element. | Root padding is a known source of odd iOS scroll and `100%` height behaviour. | Move to `body` and keep `position:fixed` insets on `header`. |
| CSS | P3 | same | 43 (`body { overflow-x:hidden }`) | Horizontal overflow is masked, not prevented. | If overflow ever does occur it becomes invisible and undebuggable rather than obviously broken. | Remove it; the layout currently overflows nowhere. |
| CSS | P3 | same | 266, 235, 109 | *(Canonical row — cross-referenced by §11 row 3.)* `svh`/`dvh` units (`min-height:clamp(520px,72svh,650px)`, `height:100svh`, `height:100dvh`). | `svh` requires Safari 16.4+; `dvh` requires 15.4+. On older iOS the whole declaration is dropped and the section collapses. | Acceptable if iOS 16.4+ is the support floor — state it explicitly, or add a `vh` fallback declaration before each `svh`/`dvh` use. |
| CSS | P3 | same | 320–349, 289–302 | Two unrelated responsive breakpoints govern the same services grid: `760px` switches to 2 columns, `520px` to 1, but the clipping bug lives in the 761–860px band created by the 12-column layout above `760px`. | A one-pixel change in breakpoint position moves a whole class of devices into or out of a content-clipping bug. | Align the breakpoint that causes clipping with the one that fixes it, and test the boundary. |
| CSS | P3 | same | 1284 vs 1297 | `MOBILE_SOURCE_MEDIA` is `(max-width:640px)` for images while the video source switch is `(max-width:860px)`. | Two different breakpoints for the same responsive intent; a 700 px device gets the mobile image and the desktop video. | Unify to a single documented breakpoint. |

---

## 8. JavaScript & TypeScript

**Verification performed:** `node --check api/gallery.js` → **PASS**. Both inline `<script>` blocks extracted and compiled with `new Function()` → **PASS**, 0 parse errors. All `getElementById()` targets resolve to an existing static or dynamically-created id → **0 dangling references**.

**Positives**
- No framework, no globals beyond script scope, no `eval`, no `innerHTML` from untrusted input at any code path I could reach without authentication.
- Clean, well-factored video subsystem with explicit state flags (`userPaused`, `autoplayBlocked`, `sourceLoaded`).
- `safeEqual()` in the API uses `crypto.timingSafeEqual` with a length guard — correct.
- `window.open()` for the WhatsApp deep link is called **synchronously** in the submit handler before any `await`, so it is not popup-blocked. Verified in code.
- Service cards added in the last 10 commits are correctly keyboard-operable (`tabindex="0"`, `role="button"`, `aria-expanded`, Enter/Space/Escape). Verified working: exclusive open, Escape closes, Enter opens, `aria-expanded` updates.

**Negatives**

| Category | Sev | File | Line | Issue | Impact | Fix |
|---|---|---|---|---|---|---|
| JavaScript | **P0** | `api/gallery.js` | 24, 25, 40–43 | *(Canonical row — cross-referenced by §14 row 3.)* `readGalleryData()` tries `fs.readFileSync(process.cwd() + '/data/gallery.json')` **before** falling back to GitHub. That file is present in the deployment, so it always wins. Every write (`save-category`, `delete-category`, `upload`, `delete-image`) is then based on that snapshot and `PUT`s it wholesale to GitHub. | **Confirmed data-integrity defect.** Two admin edits made before Vercel redeploys cause the second to overwrite the first, because both read the same stale snapshot. Deleting an image can resurrect a previously deleted one, and concurrent uploads can drop each other's entries. The write itself uses the correct live `sha`, so GitHub accepts the lossless-looking but semantically stale write. | Read from GitHub first and use the local file only as a cold-start fallback, or write a compare-and-swap (reject if the GitHub `sha` differs from the one the client read). |
| JavaScript | P1 | `Swaroop Studios (2).html` | 1240–1241 (deployed) | `const directAdmin = location.pathname === "/admin" \|\| ...; let h = directAdmin ? "admin" : (hash route)`. | **Confirmed:** on `/admin`, clicking About changes the hash to `#/about` but the active page stays `page-admin`. Same for the footer links. The user is trapped on the admin page with no working navigation. | Only force `admin` when the hash is empty: `if (directAdmin && !location.hash) h = "admin"`. |
| JavaScript | P2 | same | 1916, 1963 | `let adminInited = false;` is assigned `true` and never read. | `initGalleryAdminControls()` re-registers click listeners on `#addGalleryCategory` and `#uploadGalleryImage` on every visit to `/admin`. The second visit can create duplicate categories. Latent today only because of the `/admin` navigation lock. | Guard with `if (adminInited) return;` at the top of `initAdmin`, or move the listener wiring out of the async function. |
| JavaScript | P2 | same | 1260 | *(Canonical row — cross-referenced by §6 row 2.)* `DOMContentLoaded` runs `initServiceCards(); initEditorialVideos(); render_route(); initIntroBandVideo(); applyContact(); buildLdJson(); renderLocalImages(); loadSiteImages(); loadGallery(); loadFilm(); initReveal(); initNavbarScroll();` with no error isolation. | One uncaught throw before `render_route()` blanks the site (see §6). `loadGallery()`, `loadSiteImages()` and `loadFilm()` are async and unawaited — their rejections are swallowed by internal `try/catch`, so failures are silent. | Reorder to `render_route()` first; wrap each initialiser. |
| JavaScript | P2 | same | 1191, 1554, 1385, 1402–1403, 1745–1750 (deployed) | *(Canonical row — cross-referenced by §15 row 6.)* `innerHTML` built from API-supplied strings: gallery category labels, image titles, category values, admin enquiry names/messages. | A stored-XSS vector. Anyone with commit access to `data/gallery.json` (or an admin account) can inject script that runs for every visitor. | Build these with `createElement`/`textContent`, or sanitise with a strict allow-list before insertion. |
| JavaScript | P3 | same | 1276–1278 (deployed) | `shouldConserveVideoData()` is defined and never called. | Dead code that actively misleads a reader into thinking data-saving is implemented. See §9 for the regression this leaves behind. | Delete it, or restore its call sites. |
| JavaScript | P3 | same | 1400–1404 (`galleryApi`) | `method: action==="login" ? "POST" : "POST"`. | Dead conditional; implies the distinction matters when it does not. | Simplify to `method:"POST"`. |
| JavaScript | P3 | `api/gallery.js` | 34 | `GET /api/gallery?action=<anything other than session>` silently returns the full gallery payload with `200`. | Verified: `?action=bogus` returns gallery data. A typo in a client call fails silently instead of erroring. | Return `404` for unrecognised actions on `GET`. |
| JavaScript | P3 | same | 41 | The `delete-category` action is fully implemented server-side but has no client UI. | Dead endpoint; unreachable by any visitor or admin. | Add the UI or remove the action. |
| JavaScript | P3 | `Swaroop Studios (2).html` | 1446–1453, 1829, 1874–1992, 1466 | `initCaps()` gates `dbCap`/`assetsCap`/`userCap` on `window.claude.use`, which never exists on Vercel. | ~200 lines of database, cropper and featured-film code are permanently unreachable. `canEdit` is always `false`, so the admin's "Replace"/"Upload Film" buttons never render. | Remove the capability layer and the dependent code, or reintroduce a supported persistence adapter. |
| JavaScript | P3 | same | 1882 (`URL.createObjectURL`) | Object URL is never revoked. | Memory leak — currently unreachable, so latent. | Call `URL.revokeObjectURL` on modal close. |
| JavaScript | P3 | same | 1459–1616 (`LOCAL_GALLERY`), 1288 | 29 hard-coded gallery entries duplicate the `LOCAL_IMAGES` dimension and alt-text data. | Two sources of truth for the same images; adding a photograph requires editing two structures. | Derive `LOCAL_GALLERY` from a single data structure. |

---

## 9. Video & Motion

**This is the highest-severity area of the audit.** All 8 MP4s were probed with `ffprobe` and their box structure parsed byte-by-byte.

### 9.1 Asset quality — all good

| File | Codec / profile | Resolution | fps | Duration | Bitrate | Size | `moov` before `mdat` | Audio |
|---|---|---|---|---|---|---|---|---|
| `intro-band-1080p.mp4` | H.264 High L4.1 | 1920×1080 | 24 | 61.0 s | 2.76 Mbps | 20.1 MB | Yes | none |
| `intro-band-720p.mp4` | H.264 Main L3.1 | 1280×720 | 24 | 61.0 s | 1.30 Mbps | 9.5 MB | Yes | none |
| `reception-film-1080p.mp4` | H.264 High L4.1 | 1920×1080 | 30 | 316.8 s | 1.84 Mbps | 69.6 MB | Yes | none |
| `reception-film-720p.mp4` | H.264 Main L3.1 | 1280×720 | 30 | 316.8 s | 1.24 Mbps | 46.8 MB | Yes | none |
| `studio-teaser-1080p.mp4` | H.264 High L4.1 | 1920×1080 | 25 | 58.4 s | 6.94 Mbps | 48.3 MB | Yes | none |
| `studio-teaser-720p.mp4` | H.264 Main L3.1 | 1280×720 | 25 | 58.4 s | 1.52 Mbps | 10.6 MB | Yes | none |
| `wedding-film-1080p.mp4` | H.264 High L4.1 | 1920×1080 | 23.976 | 127.7 s | 4.18 Mbps | 63.6 MB | Yes | none |
| `wedding-film-720p.mp4` | H.264 Main L3.1 | 1280×720 | 23.976 | 127.7 s | 1.85 Mbps | 28.1 MB | Yes | none |

All renditions are `yuv420p`, so they decode on every target device including older iPhones. No audio tracks anywhere, so no autoplay-with-audio violations and no `playsinline` audio workaround needed. GOP lengths are 0.5–2.5 s, so seeking and looping are responsive. Correct `1020`-level profiles (Main L3.1 for 720p) avoid the "video format not supported" class of iOS failure. **No encoding defects found.**

### 9.2 Loading and autoplay — multiple confirmed regressions

| Category | Sev | File | Line | Issue | Impact | Fix |
|---|---|---|---|---|---|---|
| Video | **P1** | `Swaroop Studios (2).html` | 1344–1356, 1305 (deployed) | *(Canonical row — cross-referenced by §13 row 1.)* `syncEditorialVideos()` now calls `loadEditorialVideo(video)` and `retryEditorialVideo(video)` **unconditionally** for any active, non-hidden section. Before `109d1ad` the call was gated: `if(!video.dataset.sourceLoaded && !editorialVideoObserver) loadEditorialVideo(video);`, and `canPlay` also tested `!shouldConserveVideoData()`. The same commit deleted the `shouldConserveVideoData()` call from `loadEditorialVideo` and `playEditorialVideo` and changed `video.preload = "metadata"` to `"auto"`. | **Confirmed by browser measurement.** On a first visit to the homepage at 1440×900, without any scrolling: `intro-band-1080p.mp4` **and** `reception-film-1080p.mp4` both load, both reach `readyState 4`, and the reception film is `paused: false` — **94 MB, autoplaying, from a section far below the fold.** At 390×844 it is 59 MB. | Restore the observer guard: only call `loadEditorialVideo` from `syncEditorialVideos` when there is no observer. Set `video.preload` back to `"metadata"`. |
| Video | **P1** | same | 1276–1278, and all former call sites (deployed) | `shouldConserveVideoData()` — the `Save-Data` / `slow-2g` / `2g` check — is still defined but **no longer called from anywhere.** Confirmed by `grep`: one occurrence in the deployed document, the definition itself. | **Confirmed:** a metered or 2G connection now triggers the full 50–94 MB download with no opt-out. All three call sites were deleted by `109d1ad`. | Restore the check in `loadEditorialVideo`, `playEditorialVideo` and the `canPlay` condition. |
| Video | **P1** | same | 1409 (deployed) | *(Canonical row — cross-referenced by §16.1 row 10.)* The IntersectionObserver callback calls `loadEditorialVideo(video, **true**)` — `force: true` — and `loadEditorialVideo` only checks reduced motion `if(!force …)`. **Pre-existing, not a regression:** the same `force: true` call is present at `bf877fa` and earlier. | **Confirmed:** with `prefers-reduced-motion: reduce` emulated, `/#/gallery` still requested `/assets/videos/studio-teaser-1080p.mp4` (50.6 MB) and autoplayed it. The homepage correctly requested nothing, because `syncEditorialVideos` independently tests `!prefersReducedMotion()`. Reduced-motion is honoured on Home but broken on Gallery. | Never pass `force` from the observer, or check reduced motion independently of `force`. |
| Video | **P1** | same | 1438–1441, 1260 (deployed) | *(Canonical row — cross-referenced by §13 row 3.)* `initIntroBandVideo()` calls only `loadEditorialVideo(video)`. It is not gated by `editorialSectionIsActive`, is never stopped, and is never asked to play. **Introduced by `bf877fa`** ("Run the homepage intro as a cinematic video band"), i.e. pre-dates the two autoplay commits. | **Confirmed:** the 21 MB intro band is downloaded on **every route**, including `#/contact`, `#/services` and `#/gallery` where the section is `display:none`. It was `loaded: true, paused: true` on the homepage after 9 s — 21 MB fetched, nothing to show. | Gate on the active route, call `playEditorialVideo` explicitly, and pause the band when navigating away. |
| Video | **P2** | same | 671 | *(Canonical row — cross-referenced by §16.1 row 9.)* The `.hero-sub__video` autoplays and loops for 61 s with no pause, mute, or stop control, and is `tabindex="-1"` so it is not reachable by keyboard. | WCAG **2.2.2 Pause, Stop, Hide** failure: moving content that runs longer than 5 s must be pausable. The other three videos all have a visible "Play film" / "Pause film" toggle; this one has none. | Add a visible, focusable pause control, or honour a global "reduce motion" preference by default. |
| Video | P3 | same | 1409 vs 1421–1422 (deployed) | The observer now observes the **section** rather than the **video**, and the callback re-queries `.motion-video` on every entry. | Works, but the `if(!video \|\| section.hidden) return;` early return means a section that becomes visible while already intersecting produces no callback, so loading depends entirely on `syncEditorialVideos`. This coupling is what made the regression in §9.2 hard to see. | Observe the video element and keep the section lookup at setup time. |
| Video | P3 | same | 1389–1393 (deployed) | The `stalled` handler calls `playEditorialVideo(video)` on any stalled video, including paused ones. | A paused video that stalls repeatedly re-enters the play path. The `userPaused` guard prevents an actual restart, so this is wasted work rather than a visible defect. | Check `video.dataset.userPaused` first. |
| Video | P3 | same | 786, 901, 934, 946 (markup) | Four of the five real `<video>` elements declare `preload="none"` and the intro band declares `preload="metadata"`, but `loadEditorialVideo` unconditionally overwrites both to `preload="auto"`. The `preload` attribute in the HTML is decorative; the real policy is invisible in JS. | Any future contributor who sets `preload="none"` in the markup will believe they have deferred the download. They will not. | Drive `preload` from a named constant instead of mutating the attribute. |
| Video | P3 | same | 1600 (`openVideo`) | `openVideo` pauses `.motion-video` elements but not `.hero-sub__video`, and the modal itself is unreachable (§6). | Dead code, so latent. | Include the intro band or delete the function. |

**Rendition selection and mount points — all verified correct:** source switching at `(max-width:860px)` correctly picks 720p at 390 px and 1080p at 1440 px on every film; every `<video>` carries `muted`, `playsinline`, `disablepictureinpicture`, `disableremoteplayback`, explicit `width`/`height`, and an `aria-label` announcing that the film is silent. The four gallery/home/services toggles correctly report Play/Pause state and update `aria-label` from `data-video-label`. Scrolling a video out of view pauses it. `visibilitychange` and `pageshow` both re-sync. **No console errors or failed video requests were observed in any configuration.**

---

## 10. Image & Asset Optimization

**Positives — this is the strongest area of the codebase.**

- **All 186 expected AVIF variants exist.** Widths are derived as `[480, 768, 1200, 1800, 2400]` filtered to the source width, with the source width appended when below 2400. Verified: 186/186 present, 0 missing.
- **All 41 JPEG fallbacks exist** at `min(1800, sourceWidth)`. Verified: 41/41 present, 0 missing.
- **Every `<picture>` has a correct `sizes` attribute** tuned per slot (`100vw` for the hero and full-bleed plates, `46vw` for the heritage plate, `33vw` for service cards, `50vw` for gallery tiles).
- **A dedicated mobile source exists for the hero** (`hero-mobile`, 1664×2214) with a `max-width:640px` media query, and the hero is `fetchpriority="high"` + `loading="eager"`.
- **Every other image is `loading="lazy" decoding="async"`**, including all 29 gallery tiles.
- **Intrinsic `width`/`height` are present on all 41 catalogue images** — this is what should prevent layout shift, and the architecture is right.
- **Two genuinely unused assets**, both confirmed by diffing every tracked image against the filenames `localImageWidths()` can emit:
  - `assets/images/dsc04330a-2400.avif` (517 KB) — `dsc04330a` has `width:2195`, so `localImageWidths()` emits `[480, 768, 1200, 1800, 2195]` and can never request a 2400 px variant. A leftover from before the source was downscaled.
  - `assets/images/studio-story-replacement.svg` (~10 KB).
- **The 41 catalogue images map 1:1 to the 41 `LOCAL_IMAGES` entries**, so there is no orphan entry in the dictionary and no referenced file is missing.
- `assets/images/gallery/` exists and is empty — the admin upload target is wired but has never been used.
- Cache headers are applied uniformly: `public, max-age=604800, stale-while-revalidate=86400`. Brotli is enabled. `accept-ranges: bytes` is present for range requests.

**Negatives**

| Category | Sev | File | Line | Issue | Impact | Fix |
|---|---|---|---|---|---|---|
| Assets | **P2** | `vercel.json` | 13–23 | *(Canonical row — cross-referenced by §13 row 6.)* `Cache-Control: public, max-age=604800, stale-while-revalidate=86400` with no `immutable`, and asset filenames are **not content-hashed** (`dsc05478-1800.avif`, not a hash). | Replacing an image keeps the same URL, so returning visitors can be served the old file for up to **8 days** (7-day fresh + 1-day stale). | Add `immutable` and long `max-age` after adopting hashed filenames, or version the paths. |
| Assets | P2 | all `assets/**` | — | 296.6 MB of video and 65.1 MB of images committed directly to git with no LFS; `.git` is 369 MB and the working tree ~1.0 GB. | Clone time, disk usage and Vercel build time all scale with the full media history. Vercel's per-deployment limits become a real ceiling as the archive grows. | Move media to object storage/CDN with a manifest, or adopt Git LFS. |
| Assets | P3 | `vercel.json` / Vercel default | — | *(Canonical row — cross-referenced by §17 row 9.)* `content-disposition: inline; filename="Swaroop Studios (2).html"` on the root document, and `access-control-allow-origin: *` on every static asset. | Leaks the internal filename (with a space, which needs escaping) and applies a blanket CORS header to assets that do not need it. | Set an explicit `Content-Disposition` for the document and scope CORS if it is actually required. |
| Assets | P3 | `Swaroop Studios (2).html` | 28 | Fonts are loaded from `fonts.googleapis.com` at runtime with no local fallback stack. | A blocked or unreachable Google Fonts (corporate proxies, some regions) degrades typography to generic serif/sans with no design control. `Fraunces 600` is requested but appears never to be used. | Self-host the two families as `woff2` with a metric-compatible local fallback, and drop the unused weight. |

---

## 11. Responsive & Mobile

**Verified across 320, 360, 390, 768, 834, 1024, 1280, 1440 and 1920 px on all five public routes: zero horizontal overflow.** No element extends past the viewport on any route at any width. This is genuinely well-executed.

**Home hero geometry, measured:**

| Viewport | Hero height | Hero bottom vs first viewport | `h1` fully visible | Intro band in first viewport |
|---|---|---|---|---|
| 360×640 | 640 px | **60 px past** | Yes | No |
| 390×844 | 844 px | **60 px past** | Yes | No |
| 430×932 | 932 px | **60 px past** | Yes | No |
| 768×1024 | 512 px | 436 px inside | Yes | **Yes** |
| 834×1112 | 556 px | 480 px inside | Yes | **Yes** |
| 1440×900 | 824 px | exactly flush | Yes | No |

**Negatives**

| Category | Sev | File | Line | Issue | Impact | Fix |
|---|---|---|---|---|---|---|
| Responsive | P2 | `Swaroop Studios (2).html` | 252–260 (deployed) | On mobile the hero is `height:100svh; min-height:100svh` while `#page-home` keeps `padding-top:var(--hero-top)` (60 px). | The hero is 60 px taller than the first viewport on every phone width. The commit that introduced it describes the hero as "the entire first mobile viewport", which is not what ships. | Use `height:calc(100svh - var(--hero-top))`. |
| Responsive | P2 | same | 320–339 (`.svc-detail`) | **Cross-reference of §7 row 1.** See §7. Content clipping in the 761–860 px band. | Verified across a 23-width sweep. Loses the enquiry CTA on iPad portrait. | Fix the disclosure layout. |
| Responsive | P3 | same | 235, 266, 109 | **Cross-reference of §7 row 6.** `svh` / `dvh` with no `vh` fallback. | On iOS < 16.4 (`svh`) or < 15.4 (`dvh`) the declaration is dropped entirely and sections collapse. | Add a preceding `vh` declaration. |
| Responsive | P3 | same | 517–533 (mobile header) | The mobile header switches between `nav-top` (full-width bar) and `nav-compact` (centred pill) at an 8 px scroll threshold, with a 0.3 s transition on `top`, `left`, `right`, `width`, `transform` and `background-color` simultaneously. | Choreographed layout animation on scroll; a source of jank on low-end Android and of `position:fixed` repaint cost during momentum scrolling. | Simplify to one header treatment, or transition only `transform`/`opacity`. |
| Responsive | P3 | same | 140 | `#lightbox .lb-nav` is `display:none` at ≤640 px, and the lightbox has no click-to-close. | On touch, the only ways out of the lightbox are the ✕ button and a horizontal swipe; there is no tap-to-dismiss. | Add tap-to-close on the stage backdrop. |
| Responsive | P3 | same | 1401–1423 (`.svc`) | `.svc` cards are `cursor:pointer` and scale on `:hover`, but on touch the hover transform sticks after a tap in some engines. | Minor visual artefact on iOS/Android. | Gate hover effects behind `@media (hover:hover)`. |

**Positive note on mobile typography:** commits `cd195b3`, `e485264`, `3ef5c7d` and `aa213a6` in the last ten correctly fixed mobile page-title inset and subtitle alignment, excluding Home and Gallery. Verified: at 390 px the About page `h1` and lede are inside the content padding and aligned. These are good fixes.

---

## 12. Cross-Browser & Device Compatibility

Everything below was tested in **Chromium 1243 (Playwright)** against the live production site. **Safari, iOS Safari, iOS Chrome, Firefox and real devices were not available.** Those rows are marked honestly and analysed by code inspection only.

| Browser / device | Viewports tested | Layout | Video | A11y interactions | Result |
|---|---|---|---|---|---|
| **Chrome desktop** (Chromium 1243) | 320, 360, 390, 768, 834, 1024, 1280, 1440, 1920 px | Pass — no overflow on any of 45 route/width combinations | Pass — correct 1080p/720p selection, autoplay, scroll-pause, reduced-motion on Home | Pass with documented failures (§16) | **Tested — issues found** |
| **Desktop Safari** (macOS) | — | UNKNOWN | UNKNOWN | UNKNOWN | **Not tested** — code risk: `100svh`/`100dvh` (needs 15.4/16.4+), `backdrop-filter` (prefixed, OK), `aspect-ratio` (OK), `column-count` masonry (OK), `env(safe-area-inset-*)` (OK). No `-webkit-` gap identified that would block layout. |
| **iPhone Safari** (iOS 16–18) | — | UNKNOWN | UNKNOWN | UNKNOWN | **Not tested** — highest-risk untested target. Code risks: `100svh` in `.hero-full` and `.hero-sub` is dropped on iOS < 16.4; `position:fixed` header inside a `100svh` section is a known Safari source of jump-on-scroll; `filter:brightness()` on `.svc .ph` creates a containing block; the lightbox has no scroll lock, so Safari momentum scrolling continues behind the overlay. |
| **iOS Chrome** (CriOS) | — | UNKNOWN | UNKNOWN | UNKNOWN | **Not tested** — WebKit, same code risks as iPhone Safari. |
| **Android Chrome** | 360, 390, 412-equivalent widths via desktop-mode emulation | Pass (layout only, desktop engine) | UNKNOWN | UNKNOWN | **Not tested** — real Android engine and touch behaviour not exercised. |
| **Firefox** | — | UNKNOWN | UNKNOWN | UNKNOWN | **Not tested** — no `-moz-` prefixed properties exist that are required; `backdrop-filter` is unprefixed in Firefox 103+. |
| **Reduced motion** | 1440, 390 | Pass | **Fail on Gallery** — 50.6 MB still requested | Pass | **Tested — issue found** |
| **`Save-Data` / 2G** | — | — | **Not honoured** — the check exists but is never called | — | **Tested — issue found** |
| **JavaScript disabled** | 1440 | **Total failure** | n/a | n/a | **Tested — issue found** |

---

## 13. Performance & Core Web Vitals

**Measured on the live production site, Chromium, 1440×900 and 390×844, `load` event 0.5–1.0 s, LCP 520 ms, Brotli on, warm CDN.**

| Category | Sev | File | Line | Issue | Impact | Fix |
|---|---|---|---|---|---|---|
| Performance | **P1** | `Swaroop Studios (2).html` | 1344–1356 (deployed) | **Cross-reference of §9.2 row 1.** See §9.2. | **94 MB of video on a first homepage visit** (59 MB on mobile), autoplaying below the fold. This dwarfs every other performance concern and is the single largest fix available. | Restore the observer gate and `video.preload = "metadata"`. |
| Performance | **P1** | same | 565–680 (all content JS-injected) | Cumulative Layout Shift of **0.577 on mobile** and **0.404 on desktop** — both "poor" (good is < 0.1). Traced to a single 0.577 shift at t=549 ms attributed to `FOOTER` moving from a 390×487 px box at y=0 to zero, which is the pre-hydration empty document being replaced by injected content. | Fails Core Web Vitals. Caused by rendering nothing before JS runs — the same root cause as the P0 in §6. | Server-render or hard-code the first screenful so the layout is stable at first paint. |
| Performance | **P1** | same | 238 (`.hero-sub` poster), 671 | **Cross-reference of §9.2 row 4.** See §9.2. The poster is fetched on every route as well, so the wasted request is a 64 KB poster plus a 21 MB video. | Redundant bytes on pages where the band is not shown. | Gate the video on the active route and let the poster serve alone elsewhere. |
| Performance | **P2** | same | 1010 (`buildLdJson`) | **Cross-reference of §17 row 4.** The JSON-LD `image` is the root-relative `/assets/images/dsc05478-1800.jpg`, and the `<meta property="og:image">` is likewise relative. | Search engines resolve these inconsistently; absolute URLs are required by most consumers. | Emit `location.origin + path`. |
| Performance | P3 | same | 1301 | `fetchpriority="high"` is set on the About page's archive image (`data-local-priority="true"` on `dsc03239`) as well as on the hero, so two images compete for priority. | Dilutes the priority of the actual LCP element on that route. | Keep `fetchpriority="high"` for the hero only. |
| Performance | **P2** | `vercel.json` | 13–23 | **Cross-reference of §10 row 1.** The 8-day effective cache window described in §10. | Repeat visitors re-download changed assets. | Hashed filenames + `immutable`. |
| Performance | P3 | same | 28 | Google Fonts render-blocking `<link>` in `<head>` without `media="print"` swap or `preload`. | `font-display: swap` is set by Google's CSS, so text paints immediately; font bytes are 0.11 MB total. | Preload the two `woff2` files if self-hosting. |

**Positive measurements:** initial document + image weight before any video is **1.77 MB across 19 requests** — reasonable for a photography site. Largest individual non-video assets are the `wedding-film.jpg` poster (364 KB), `studio-teaser.jpg` (269 KB) and `dsc05478-1800.avif` (167 KB). No failed requests, no console errors, no uncaught exceptions in any tested configuration.

---

## 14. Network & API

**Endpoints, all verified live:**

| Request | Status | Content-Type | Result |
|---|---|---|---|
| `GET /` | 200 | `text/html; charset=utf-8` | 131,465 bytes, Brotli |
| `GET /admin` | 200 | `text/html` | Rewrite works |
| `GET /admin/` | **404** | `text/plain` | **Rewrite does not cover the trailing slash** |
| `GET /api/gallery` | 200 | `application/json` | `{"categories":[…4],"images":[]}` |
| `GET /api/gallery?action=session` | 200 | `application/json` | `{"ok":true,"authenticated":false,"configured":true}` |
| `GET /api/gallery?action=bogus` | 200 | `application/json` | Returns gallery data instead of 404 |
| `POST …?action=login` (wrong password) | 401 | `application/json` | `{"ok":false,"error":"Incorrect password."}` |
| `POST …?action=upload` (unauthenticated) | 401 | `application/json` | Correctly rejected |
| `POST …?action=save-category` (unauthenticated) | 401 | `application/json` | Correctly rejected |
| `POST …?action=delete-category` (unauthenticated) | 401 | `application/json` | Correctly rejected |
| `POST …?action=logout` | 200 | `application/json` | Correctly clears the cookie |
| `OPTIONS /api/gallery` | 204 | — | Handled |
| `GET /robots.txt` | **404** | — | Does not exist |
| `GET /sitemap.xml` | **404** | — | Does not exist |
| `GET /nonexistent` | 404 | `text/plain` | Vercel default `The page could not be found / NOT_FOUND` |

**Authentication boundary verified correct:** every mutating action returns `401` without a session cookie, and the public `GET` exposes only the intended gallery payload.

**External network dependencies:** `fonts.googleapis.com`, `fonts.gstatic.com`, `api.github.com` (server-side only). No third-party analytics, tag manager, chat widget, or CDN-hosted script. No client-side calls to any external service.

**Negatives**

| Category | Sev | File | Line | Issue | Impact | Fix |
|---|---|---|---|---|---|---|
| Network | **P1** | `Swaroop Studios (2).html` | 1900–1910 (deployed) | **Cross-reference of §18 row 1.** The form has no server-side submission path. `dbCap` is always `null`, so `dbCap.collection("enquiries").add(...)` is skipped, `enquiryForm.reset()` runs, and the success banner is shown regardless. The only delivery mechanism is `window.open("https://wa.me/…")`. | **Confirmed:** a visitor who dismisses the WhatsApp tab, or who has WhatsApp blocked, is shown *"Thank you — your enquiry has been received"* and the enquiry is **silently lost**. There is no fallback, no email, no server record. | Add a real serverless submit action, or at minimum only show the success banner once the WhatsApp handoff is confirmed. |
| Network | P2 | `Swaroop Studios (2).html` | 1723–1724 (deployed) | `renderEnquiries()` calls `dbCap.collection(...)`; `dbCap` is `null`, so it always throws and is caught, rendering "Couldn't load enquiries." | The admin's Enquiries panel can never display anything. There is no way for the studio to see an enquiry through the site. | Same fix as above. |
| Network | **P0** | `api/gallery.js` | 24, 25 | **Cross-reference of §8 row 1** (the second P0). Stale-snapshot read-before-write. | Silent data loss on rapid admin edits. | Read GitHub first, or compare-and-swap on `sha`. |
| Network | P2 | `api/gallery.js` | 42 | *(Canonical row — cross-referenced by §20 row 4.)* An uploaded image is committed to `assets/images/gallery/…` in GitHub but is not served until Vercel redeploys, and the gallery JSON that lists it is also deploy-time. | Every upload is invisible to visitors for the duration of a deploy. `assets/images/gallery/` is empty after the site's entire history, which suggests this has never been used end to end. | Serve the gallery from the GitHub API at request time, or trigger and await a deploy, or accept a CDN-based asset store. |
| Network | P2 | `vercel.json` | 9–11 | `rewrites` covers `/admin` but not `/admin/`. | `/admin/` returns 404 to any visitor or bot that normalises the trailing slash, even though the router explicitly handles `pathname === "/admin/"`. | Add a second rewrite for `/admin/`, or a `trailingSlash: false` setting. |
| Network | P3 | `api/gallery.js` | 34 | `?action=session` responses carry `cache-control: public, max-age=0, must-revalidate` and are CDN-cacheable. | The `authenticated` flag and the `configured` boolean are publicly cacheable. Low impact, but the endpoint should be `no-store`. | Set `Cache-Control: no-store` on session responses. |
| Network | P3 | `api/gallery.js` | 34 | `GET ?action=session` returns `configured: Boolean(ADMIN_PASSWORD && TOKEN)` to anonymous callers, and the admin UI then prints "Add ADMIN_PASSWORD and GITHUB_TOKEN in Vercel, then redeploy." | Reveals the exact environment-variable names and the auth mechanism to anyone who visits `/admin`. | Keep the flag if the studio needs the diagnostic, but drop the variable names from the message. |
| Network | P3 | `api/gallery.js` | 43 | `delete-image` wraps the GitHub binary deletion in `try { … } catch {}`. | A failed deletion leaves an orphaned binary in the repository forever, with no record that it is unreferenced. | Report the failure and record it, or retry. |

---

## 15. Security

**No live secret is committed to git.** A pattern scan across every tracked text file for GitHub tokens (`gh[pousr]_*`, `github_pat_*`), OpenAI keys, AWS access key IDs, private key blocks, Slack tokens and Vercel OIDC tokens returned **zero matches**. `.env.example` contains placeholders only.

**SECRET DETECTED** — one live credential exists on disk outside version control:
- **Location:** `.vercel/.env.preview.local`
- **Key:** `VERCEL_OIDC_TOKEN` (1380 characters)
- **Status:** the file is covered by `.gitignore` and is not committed and not deployed, so there is no exposure through the repository or the live site. It is nonetheless a valid federation token at rest on this machine. Rotate it if the machine is shared, and confirm the file's permissions.

Other findings:

| Category | Sev | File | Line | Issue | Impact | Fix |
|---|---|---|---|---|---|---|
| Security | **P1** | `api/gallery.js` | 16–20, 27 | The session token is `HMAC-SHA256(secret, "authenticated")` — a **deterministic** value with no timestamp, nonce or expiry claim. Only the cookie's `Max-Age=28800` limits it, and that is enforced by the browser, not the server. | A captured token is valid **indefinitely** until `ADMIN_PASSWORD` or `GITHUB_TOKEN` changes. Rotating either credential silently invalidates every live admin session. | Issue a random session id and store it, or embed `issuedAt`/`expiresAt` in a signed payload and verify server-side. |
| Security | P1 | `api/gallery.js` | 37 | `login` has no rate limiting, no lockout, no progressive delay, and no failed-attempt counter. | The entire admin surface is protected by a single shared password that can be brute-forced at network speed. Vercel provides no WAF here by default. | Add per-IP throttling with exponential backoff, and consider an IP allow-list or an identity provider. |
| Security | P2 | `api/gallery.js` | 20, 37 | A single shared password for all administrators; no per-user identity, no 2FA, no audit log of who changed what. | No accountability, and no revocation short of changing the password for everyone. | Move to a real identity provider, or at minimum record actor and timestamp in the commit message. |
| Security | P2 | `vercel.json` | 13–23 | Response headers set: `Cache-Control` for `/assets/*` only. **Missing:** `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` / `frame-ancestors`, `Permissions-Policy`. | No defence in depth against XSS, MIME sniffing, clickjacking or referrer leakage. The admin page is also framable. | Add the five headers. A CSP is especially valuable given the `innerHTML` sinks in §8. |
| Security | P2 | `api/gallery.js` | 42 | Upload validation trusts the client-declared `mime` field; the file extension is derived from it, and there is no magic-byte or image-decode validation. | An authenticated attacker can commit arbitrary bytes to the repository under an image extension. Requires a valid session, so severity is bounded. | Validate magic bytes server-side, re-encode, and derive the extension from the detected type. |
| Security | P2 | `Swaroop Studios (2).html` | 1191, 1554, 1385, 1745 (deployed) | **Cross-reference of §8 row 5.** `innerHTML` sinks fed by API/DB-supplied strings. | Stored-XSS vector for anyone able to write `data/gallery.json` or an admin record. A category label such as `<img src=x onerror=…>` would execute for every visitor. | Use `textContent` / `createElement`, or sanitise. |
| Security | P3 | `api/gallery.js` | 45 | `error.message` is returned to the client for every failure, including GitHub API messages that can name the repository, branch and path. | Reconnaissance value for an attacker probing the admin. | Return a generic message to the client and log the detail server-side. |
| Security | P3 | `api/gallery.js` | 19, 27 | The admin cookie is `HttpOnly; Secure; SameSite=Strict; Path=/` with no `__Host-` prefix and no `Domain`. | `Secure` means the admin login **cannot persist over plain HTTP**, which affects local development only. `__Host-` would harden against sibling-domain cookie injection. | Add the `__Host-` prefix. |
| Security | P3 | `api/gallery.js` | 29 | The 12 MB raw-body cap is only applied when `req.body` has not already been parsed by the platform. | A body larger than the 8 MB image limit may be accepted by the function before the check runs. | Enforce the limit in `vercel.json` or at the platform layer as well. |
| Security (verified pass, not a finding) | — | production headers | — | HSTS **is** present and correct. Verified live: `strict-transport-security: max-age=63072000; includeSubDomains; preload`. TLS is HTTP/2, and `accept-ranges: bytes` is present, so range requests work for video. | No finding. | — |

The row above is a positive control, not a defect, and is **excluded** from the finding counts. All other rows in this table are genuine findings.
| Security | P3 | `.vercel/` | — | A 269 MB stale duplicate of the site sits in an ignored directory, and a live OIDC token sits beside it. | Deploying `.vercel/hero-staged` by mistake would publish an outdated site. | Delete the directory; rotate the token. |

---

## 16. Accessibility (a11y)

**Standard applied:** WCAG 2.1 AA, with WCAG 2.2 criteria noted where relevant.

### 16.1 Failures

| Criterion | Sev | File | Line | Issue | Impact | Fix |
|---|---|---|---|---|---|---|
| **2.1.1 Keyboard** | **P1** | `Swaroop Studios (2).html` | 1701 (deployed `renderFullGallery`) | All 29 gallery tiles are plain `<div class="item">` with a click listener and no `role`, `tabindex` or key handler. Verified: **0 of 29** are focusable. | The gallery lightbox — the primary way to view photographs — is completely unreachable without a mouse. This is a total failure of the site's core content path for keyboard and switch users. | Render tiles as `<button>` or add `role="button" tabindex="0"` plus Enter/Space handling and `aria-haspopup="dialog"`. |
| **2.4.3 Focus Order / 2.4.7 Focus Visible** | **P1** | same | 555–562, 552 | `#mobileNav` uses `opacity:0; pointer-events:none` when closed, which does **not** remove it from the tab order. Verified tab trace: `CLOSE ✕, Home, About, Services, Gallery, Contact` are all focusable while the menu is closed. `.menu-btn` has no `aria-expanded` and no `aria-controls`. | Mobile keyboard and screen-reader users tab into an invisible menu and hear six links that are not on screen. Violates WCAG 2.4.3 and 2.4.7. | Toggle `visibility:hidden`/`inert` when closed, and add `aria-expanded` + `aria-controls` to the button. |
| **1.4.3 Contrast (Minimum)** | **P2** | same | 54, 71, 437, 451, 48 | **Cross-reference of §7 row 2.** Live-measured failures: `.eyebrow` **3.36:1**, `.heritage__eyebrow` **4.15:1**, `.contact-loc` **3.36:1**, `.f-note` **3.36:1**, `input::placeholder` **3.36:1**. All need 4.5:1. | Small secondary text fails AA across the gallery, heritage, contact and admin pages. | Darken the tokens. |
| **1.4.3 Contrast (Minimum)** | **P2** | same | 290–292 (`.svc .cap`) | **Cross-reference of §7 row 3.** Pixel-sampled service card titles: 2.7% of pixels behind the 16 px white `h3` are pure white; white-on-mean is **3.94:1**. | Card titles are intermittently illegible depending on the photograph. | Strengthen the caption gradient. |
| **2.1.2 No Keyboard Trap / 2.4.3** | **P2** | same | 928–935 (`#lightbox`) | The lightbox has no `role="dialog"`, no `aria-modal`, and no focus trap. Verified: after 3 tab stops focus escapes to background page links, and 10 background elements remain focusable. Escape closes it, but focus is **not restored** (`document.activeElement` becomes `<body>`). | Screen-reader and keyboard users are dumped into an unannounced overlay and then released into the page with no focus context. | Add dialog semantics, trap focus, and restore focus to the triggering tile on close. |
| **2.1.2** | **P2** | same | 928–935 | No background scroll lock. Verified: scrolling with the lightbox open moved `window.scrollY` from 980 to 1379. | The page scrolls behind a fixed overlay, so the next/prev image and the user's scroll position drift apart. Especially bad with iOS momentum scrolling. | Set `overflow:hidden` on `<body>` while the overlay is open. |
| **4.1.3 Status Messages** | **P2** | same | 863 / form handler | `#enquirySuccess` has no `role="status"` and no `aria-live`. Verified `role: null`, `aria-live: null`. | The success message is never announced. A screen-reader user gets no confirmation that their enquiry was sent. | Add `role="status"` (or `aria-live="polite"`). |
| **2.4.11 Focus Appearance** | **P2** | same | 542 | `.enquiry-form input:focus` sets `outline:none` and changes only the 1 px bottom border colour. Verified: `outlineStyle: "none"`, `borderBottomWidth: "1px"`. | The focus indicator is a 1 px colour change on an already-bordered control, below the WCAG 2.2 threshold. Applies to every form field, and to the admin password field. | Use a 2 px outline with an offset, or a clearly thicker/high-contrast border change. |
| **2.2.2 Pause, Stop, Hide** | **P2** | same | 671 | **Cross-reference of §9.2 row 5.** The intro band autoplays and loops for 61 s with no pause control and is not focusable. | No way to stop it. The other three films all have toggles. | Add a visible pause control. |
| **1.4.2 Audio Control / reduced motion** | **P1** | same | 1409 (deployed) | **Cross-reference of §9.2 row 3.** `force: true` from the observer bypasses the reduced-motion guard. | Under `prefers-reduced-motion: reduce`, Gallery still downloads and autoplays a 50.6 MB video. Verified. | Check reduced motion independently of `force`. |
| **4.1.1 Parsing** | P3 | same | 830–869 | A `<div role="button" tabindex="0">` contains a `<button>` and an `<a>`. | Interactive descendants inside a `role="button"` are an ARIA violation; the accessibility tree will be inconsistent. | Use a non-button container with `aria-expanded`, and keep the close button and CTA outside the button role. |
| **4.1.2 Name, Role, Value** | P3 | same | 792–796 | Gallery filters use `aria-pressed` on a mutually exclusive set. | `aria-pressed` describes toggles, not a single-select group. `aria-current` or a tablist is more accurate. | Use `aria-pressed` only if multi-select is intended, otherwise `aria-current="true"`. |
| **1.3.1 Info and Relationships** | P3 | same | 213 | `.page:focus { outline:none }` removes the focus indicator from the skip-link target. | Sighted keyboard users get no feedback when the skip link moves focus into the content. | Keep a subtle outline on the programmatic target. |
| **4.1.2** | P3 | same | 1561–1571 | Lightbox caption renders `"wedding, Wedding"` because category and location carry the same value. | Redundant, confusing announcement for screen-reader users. | De-duplicate, or drop `location` from the caption. |
| **1.4.10 Reflow** | P3 | same | 1305 | `.svc .cap p` sets `max-width:34ch` and the media query reduces it to `11.5px` at ≤760 px. | Passes at all tested widths, but the 34ch cap plus 2-column layout leaves narrow measure on small tablets. | Verified no reflow failure; monitor. |

### 16.2 Verified passes

- Skip link is present, becomes visible on focus, and correctly moves focus to `.page.active` (verified `focused: true`).
- All 41 catalogue images have meaningful, human-written `alt` text describing the subject rather than the filename; the lightbox `alt` is set dynamically from the title.
- All icon-only buttons have `aria-label`: lightbox close/prev/next, video modal close, service detail close.
- Video elements carry `aria-label` stating the film is silent, plus `tabindex="-1"` so they are not focus traps; `disablepictureinpicture` and `disableremoteplayback` are set.
- Per-field validation is correct: `aria-invalid`, `aria-describedby`, `aria-required`, and `aria-live="polite"` on the error spans; the first invalid field receives focus (verified `focused: "enquiryName"`).
- The form is `novalidate` with a custom validator, and the validator works for the two required fields.
- Tap targets on the hero band were measured at ≥49.7 px **during earlier work on the cinematic band, not re-measured in this audit**; `.motion-toggle` is ≥37 px tall, `.btn-sm` 9 px vertical padding + 12.5 px text.
- `lang="en"`, correct landmarks within each active route, `viewport-fit=cover` with safe-area insets on the fixed header.
- The services feature added in the last ten commits is a genuine accessibility improvement: `tabindex="0"`, `role="button"`, `aria-expanded`, Enter/Space/Escape handling, and a visible `:focus-visible` outline. Verified working.

---

## 17. SEO

**Positives**
- Unique, descriptive `<title>` and `<meta name="description">` for the site.
- Full Open Graph and Twitter card metadata, with `og:image:alt`, explicit `og:image:width/height/type`, and `summary_large_image`.
- JSON-LD `ProfessionalService` with name, description, `foundingDate: 1972`, telephone, email, `PostalAddress`, `sameAs` and image. Verified live output: 469 bytes of valid JSON with all fields correctly populated and `undefined` keys stripped. The `{}` placeholder in the source is correctly replaced at runtime.
- Semantic heading hierarchy, descriptive `alt` text, `lang`, canonicalisable single-page routes.
- Brotli enabled, HSTS set, HTTP/2, `content-language` served correctly.

**Negatives**

| Category | Sev | File | Line | Issue | Impact | Fix |
|---|---|---|---|---|---|---|
| SEO | **P1** | `Swaroop Studios (2).html` | whole document | The entire site is client-rendered. With JS disabled, verified: 0 visible `<main>` elements, empty hero, 0 gallery tiles. | Crawlers that do not execute JavaScript — and any crawler that times out — see a page with only navigation and footer text. This is the single largest SEO risk in the codebase. | Server-render or pre-render the routes. |
| SEO | P2 | same | — | No `<link rel="canonical">` on any route. Verified `canonical: null`. | Six routes all share one canonical-less URL set; duplicate-content ambiguity between `/#/gallery`, `/Swaroop%20Studios%20(2).html#/gallery` and the un-hashed HTML path. | Add a canonical per route, and redirect the raw HTML filename. |
| SEO | P2 | — | — | No `robots.txt` and no `sitemap.xml`. Both return 404. | No crawl directives, no disallow for `/admin`, no sitemap for a multi-route site. | Add both, and disallow `/admin` in `robots.txt`. |
| SEO | P2 | same | 12, 1010 | *(Canonical row — cross-referenced by §13 row 4.)* `og:image` and the JSON-LD `image` are root-relative paths, not absolute URLs. | Facebook, LinkedIn, WhatsApp and several crawlers require absolute URLs; relative ones are frequently dropped. | Prefix with `location.origin`. |
| SEO | P2 | `vercel.json` | 3–7 | The real document is `/Swaroop Studios (2).html`, which is publicly reachable at `/Swaroop%20Studios%20(2).html` (verified 200) as well as at `/`. | Three URLs serve identical content with no canonical and no redirect. Split link equity and create a near-duplicate URL. | Redirect the raw filename to `/`, and canonicalise to `/`. |
| SEO | P3 | same | 6–7, 22 | One static title/description for all six routes. | Every route competes with the same metadata; the Contact and Services pages cannot target their own queries. | Update `document.title` and the meta tags per route in `render_route()`. |
| SEO | P3 | same | — | No `hreflang`, no `og:locale`. | Not required for a single-locale site; noted for completeness. | None required. |
| SEO | P3 | same | 693–694, 710 | Placeholder bracketed text ships in the About page body copy. | Visible to crawlers and users as unfinished editorial. | Replace. |
| SEO | P3 | `vercel.json` | — | **Cross-reference of §10 row 3.** `Content-Disposition: inline; filename="Swaroop Studios (2).html"` on the root document. | Reveals the internal filename; harmless but untidy for a production site. | Set an explicit disposition or omit it. |

---

## 18. Forms & UX

**Verified working:**
- Contact values resolve correctly at runtime from the single `CONTACT` object: `tel:+919900486574`, `mailto:swaroopstudios@gmail.com`, `https://wa.me/919036055099`, and the footer Instagram link. Placeholder fallback logic (`isPlaceholder`) works.
- Empty submit shows the correct per-field message, sets `aria-invalid="true"`, adds the `shown` class, and focuses the first invalid field.
- `window.open` for WhatsApp is called synchronously before any `await`, so it is not popup-blocked.
- Service cards: exclusive open/close, Escape to close, Enter to open, `aria-expanded` maintained, and the enquiry CTA correctly hands the selected service to the contact form via `sessionStorage` → `applySelectedService()`. Verified working end to end.
- Gallery filters correctly re-render the grid, show/hide the category video figures, and re-sync videos.
- The service detail panels fit without clipping at ≤760 px and ≥861 px (verified at 23 widths).

**Negatives**

| Category | Sev | File | Line | Issue | Impact | Fix |
|---|---|---|---|---|---|---|
| UX | **P1** | `Swaroop Studios (2).html` | 1900–1910 (deployed) | *(Canonical row — cross-referenced by §14 row 1.)* The enquiry form has no working server-side submission and reports success regardless. | **Confirmed:** a visitor who closes the WhatsApp tab is told "your enquiry has been received" and the lead is lost. The studio has no other channel through the site. | Implement a serverless submit action with a stored record, and show success only on a real response. |
| UX | P2 | same | 842–864 | The form is `novalidate` and the custom validator only checks `name` and `phone`. Verified: an email of `not-an-email` yields `validity.valid === false` yet submission proceeds. | Malformed email addresses are accepted and forwarded to WhatsApp, and there is no way for the studio to reply by email. | Validate `email` when non-empty using `input.checkValidity()`. |
| UX | P2 | same | 863 | `#enquirySuccess` is never hidden again after the first successful submit. | On a second submission the stale success message is still on screen while the new request is in flight. | Hide it at the start of each submit. |
| UX | P2 | same | 842–864 | No honeypot, no rate limiting, no CSRF token, no submission timestamp. | The form opens a WhatsApp link, so spam risk is limited, but there is no protection if a real endpoint is added. | Add a honeypot and a server-side rate limit. |
| UX | P2 | same | 1123–1125 | `prompt("New gallery category name")` and `confirm("Delete this image?")` are used in the admin. | Browser-modal prompts are unstyled, blocking, and cannot show which gallery the action affects. | Replace with an inline form and a styled confirm. |
| UX | P3 | — | 404 | **Cross-reference of §20 row 7.** Vercel's plain-text `The page could not be found / NOT_FOUND` is served for every bad URL. | Any broken internal link, mistyped URL or stale bookmark lands on an unbranded plain-text page. | Add a branded 404 document. |
| UX | P3 | same | 860 | `Message` textarea has a placeholder but no label text. | The label is the word "Message" above the field, which is present, so this passes — noted only because the `label` has no `.label-text` span like the other fields. | For markup consistency. |
| UX | P3 | same | 1191 (`applySelectedService`) | The selected service is handed over via `sessionStorage` and consumed on the contact route. | Works, but if the visitor edits the hash instead of navigating, the value is never consumed and is silently overwritten on the next service click. | Also apply on `hashchange`. |

---

## 19. Code Quality Checklist

| Check | Status | Notes |
|---|---|---|
| `node --check` on all JS | **Pass** | `api/gallery.js` and both inline blocks compile |
| Dangling `getElementById` references | **Pass** | 0 unresolved |
| Duplicate `id` attributes | **Pass** | 73 ids, 73 unique |
| Duplicate `label for` targets | **Pass** | 0 duplicates |
| Referenced assets exist | **Pass** | 186/186 expected AVIF variants, 41/41 JPEG, 4/4 posters, 8/8 videos all referenced by `LOCAL_IMAGES` / markup |
| Unused assets | 2 found | `assets/images/dsc04330a-2400.avif`, `assets/images/studio-story-replacement.svg` |
| Placeholder copy in production | **Fail** | 2 instances in About page copy |
| Dead code identified | **Fail** | See below |
| `innerHTML` with untrusted data | **Fail** | 4 sinks |
| Unused variables | **Fail** | `adminInited`, `shouldConserveVideoData`, `revealNew` |
| Dead ternary | **Fail** | `action==="login" ? "POST" : "POST"` |
| Lint / format config | **Absent** | No ESLint, Prettier, or `.editorconfig` |
| Type checking | **Absent** | No TypeScript, no JSDoc types |
| Tests | **Absent** | No unit, integration, or e2e tests |
| CI/CD workflow | **Absent** | No `.github/workflows` |
| Package manifest | **Absent** | No `package.json` or lockfile |
| Comment accuracy | Partial | Comments are high quality; `preload` attributes and `revealNew` comments are misleading |
| Magic numbers | **Fail** | 23+ unnamed constants |
| `window` globals | Warn | 5 `__`-prefixed globals with no namespace |

**Confirmed dead code in production:**

| Dead item | Location | Why it is dead |
|---|---|---|
| `initCaps`, `dbCap`, `assetsCap`, `userCap`, `canEdit` | 1444–1453 | Requires `window.claude.use`, absent on Vercel |
| `loadSiteImages`, `paintSlot` (DB path) | 1666–1690 | Returns early: `initCaps()` → `false` |
| `loadFilm`, `openVideo`, `#filmSection` | 1825–1845, 640–651 | `display:none`, never unhidden; section always `display:block` only if `dbCap` exists |
| `renderEnquiries` | 1737–1753 | `dbCap` is `null` → always "Couldn't load enquiries." |
| `renderFilmAdmin`, `renderSlotGrid` | 1754–1798 | No `dbCap`; `canEdit` always `false` so no buttons render |
| Cropper: `openCropper`, `buildCropFields`, `setupCropBox`, `clampAndPaint`, `#cropModal` | 1872–1992, 910–923 | Gated on `canEdit` |
| `#videoModal`, `#vmVideo`, `#videoInput` | 937–941, 925 | Only reachable from the dead film section |
| `saveGalleryCategories`, `loadGalleryCategories` | 1361–1380 | Gated on `dbCap` |
| `galleryApi("delete-category")` | API 41 | No client caller |
| `shouldConserveVideoData` | 1276–1278 | No caller |
| `revealNew` | 1271 | Explicit no-op, still called twice |
| `adminInited` | 1916, 1963 | Written, never read |
| `setOgImage` | 1113–1119 | Only called from the dead `loadSiteImages` |

**Estimated dead weight:** ~200 lines of JS, ~15 CSS rules, ~55 lines of markup, and 2 unreferenced image files.

---

## 20. Deployment & Infrastructure

**Verified live configuration** (from response headers and `.vercel/project.json`):

| Setting | Value | Note |
|---|---|---|
| Project | `swaroop-studios` (`prj_9XE8JNW89opBtyMyBo7E0Hge6TCw`) | — |
| Framework preset | `null` | Static + one serverless function |
| Build / dev / install command | `null` | No build step |
| Output directory | `null` | Repo root is served as-is |
| Directory listing | `false` | Correct |
| Node runtime | `24.x` | Matches the CommonJS function |
| Protocol | HTTP/2 | — |
| TLS / HSTS | `max-age=63072000; includeSubDomains; preload` | Good, via Vercel default |
| Compression | Brotli | Good |
| Range requests | `accept-ranges: bytes` on all media | Required for video seeking — present |
| CDN | `x-vercel-cache: HIT`, `age: 8949` | Working |
| `Content-Disposition` | `inline; filename="Swaroop Studios (2).html"` | Leaks internal filename |

**Negatives**

| Category | Sev | File | Line | Issue | Impact | Fix |
|---|---|---|---|---|---|---|
| Deployment | **P1** | git | — | The local working tree is **10 commits behind `origin/main`** (`bf877fa` vs `9d0ded1`). Production matches `origin/main` byte-for-byte (md5 `9a7c225a6778ab9e32cfe11807059332`). | Anyone auditing, editing, or planning work from the local checkout is looking at **stale code**. The 10 missing commits include the mobile hero redesign, the interactive service cards, the VIP CTA and the two video-autoplay commits that caused the §9 regressions. | Fast-forward the local branch and adopt a rule that `origin/main` is the source of truth. |
| Deployment | P2 | `vercel.json` | 3–12 | The canonical document path is a filename with a space, a parenthetical and a version suffix, exposed via two rewrites. | Fragile URLs, awkward escaping (`%20`, `%28`, `%29`), leaked internal naming, and a duplicate-content URL. | Move to a clean entry point such as `index.html` and rewrite `/admin` to it. |
| Deployment | P2 | git / `vercel.json` | — | 362.5 MB of assets committed to git, `.git` at 369 MB, working tree ~1.0 GB, and a 604 MB `.vercel/` directory. Vercel uploads the full repository on every deploy. | Build and deploy times scale with total repo size; approaching platform limits as the archive grows. | Externalise media, or use LFS. |
| Deployment | P2 | `api/gallery.js` | 24, 25 | **Cross-reference of §14 row 4.** Admin writes commit to `main`, which triggers a Vercel redeploy, but the API serves the **previous** deployment's `data/gallery.json`. | Every admin edit is invisible until the deploy lands, and the API's own read path means a second edit before the deploy overwrites the first. | Read GitHub at request time, or make writes independent of the deploy. |
| Deployment | P3 | `.vercel/hero-staged/` | — | A 269 MB stale duplicate of the site (HTML from 25 Sep) sits in an ignored directory. | Deploying the wrong tree would silently publish an old site. | Delete it. |
| Deployment | P3 | `.vercel/.env.preview.local` | — | **SECRET DETECTED** — live `VERCEL_OIDC_TOKEN` on disk. | Not committed, not deployed. Rotational risk only. | Rotate and restrict permissions. |
| Deployment | P3 | git | — | No CI, no preview URLs enforced, no automated deploy checks. | Every change ships straight to production with only manual verification. | Add a minimal workflow: syntax check + the browser checks in this report as a gate. |
| Deployment | P3 | — | — | *(Canonical row — cross-referenced by §18 row 6.)* No custom 404 document. | Plain-text Vercel error page. | Add one. |
| Deployment | P3 | git | — | `main` is the deployment branch and also the branch the admin API writes to. | An admin write triggers a production deploy. There is no staging path. | Target a `content` branch and promote via PR. |

---

## Prioritised Fix Order

### Fix first — highest impact, lowest risk (reverts and one-liners)

1. **Restore the video lazy-load gate** (§9.2, first row). Revert `syncEditorialVideos()` to the `if(!video.dataset.sourceLoaded && !editorialVideoObserver)` guard and set `preload` back to `"metadata"`. **Removes 94 MB from the first homepage load.** Touches ~4 lines.
2. **Restore the `shouldConserveVideoData()` call sites** (§9.2, second row). **Protects metered and 2G users.** ~3 lines.
3. **Stop `force: true` from bypassing reduced motion** (§9.2, third row). **Fixes a WCAG failure on Gallery.** 1 line.
4. **Gate `initIntroBandVideo()` on the active route and call `play()`** (§9.2, fourth row). **Removes 21 MB from every non-home route.** ~4 lines.
5. **Fix the `/admin` route lock** (§8). `if (directAdmin && !location.hash)`. **1 line, restores all navigation on the admin page.**
6. **Make the gallery keyboard accessible** (§16.1). **Highest-impact a11y fix.** Add `role`, `tabindex`, and key handling in `renderFullGallery`.
7. **Fix the stale read-before-write in `api/gallery.js`** (§8 P0). **Prevents silent gallery data loss.** Read GitHub first.
8. **Add the missing security headers** (§15). CSP, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors`, `Permissions-Policy`. **~15 lines in `vercel.json`.**

### Fix next — user-visible quality

9. Fix the service-card clipping at 761–860 px (§7, §11). **Currently hides an enquiry CTA on iPad.**
10. Give the enquiry form a real server-side submission, or stop showing false success (§14, §18). **Business-critical.**
11. Fix the contrast failures: `--grey`, `.heritage__eyebrow`, placeholder (§7).
12. Strengthen the `.svc .cap` gradient so card titles are legible (§7).
13. Make `#mobileNav` inert when closed and add `aria-expanded` (§16.1).
14. Make the lightbox a proper dialog: `role="dialog"`, `aria-modal`, focus trap, focus restore, scroll lock (§16.1).
15. Add `role="status"` to the enquiry success message and strengthen the form focus indicator (§16.1).
16. Add a pause control to the intro band (§9.2, §16.1).
17. Validate the email field (§18).
18. Reduce CLS by rendering the first screenful in HTML (§13). **Best structural fix for Core Web Vitals** and the first step toward resolving the P0.

### Fix when convenient

19. Add `rel="canonical"`, `robots.txt`, `sitemap.xml`, absolute `og:image`, and per-route titles (§17).
20. Redirect the raw HTML filename to `/` and add a branded 404 (§17, §18).
21. Replace the four `innerHTML` sinks with `textContent`/`createElement` (§8, §15).
22. Add login rate limiting and a real expiring session token (§15).
23. Validate upload magic bytes (§15).
24. Add `__Host-` to the admin cookie and stop leaking `error.message` and env var names (§15, §14).
25. Delete the dead code listed in §19 (~200 lines of JS, ~15 CSS rules, ~55 lines of markup) and the two unreferenced image files.
26. Externalise media from git, or adopt LFS (§10, §20).
27. Add hashed asset filenames with `immutable` caching (§10).
28. Add a minimal CI gate running the checks in this report (§20).
29. Replace the About page placeholder copy (§6, §17).
30. Fast-forward the local branch and delete `.vercel/hero-staged`; rotate the OIDC token (§20).

---

## What Was NOT Verified

This audit is honest about its limits. The following were **not** tested and are reported as `UNKNOWN` rather than assumed to pass:

**Devices and browsers**
- **Desktop Safari on macOS** — not tested. No Mac browser available.
- **iPhone Safari (real device)** — not tested. This is the single most important gap: the site is mobile-first, uses `100svh`, `env(safe-area-inset-*)`, `-webkit-backdrop-filter`, and a `position:fixed` header inside a `100svh` section, all of which are known iOS trouble spots.
- **iOS Chrome (CriOS)** — not tested. WebKit engine, same risk profile.
- **Android Chrome (real device)** — not tested. Only desktop Chromium at mobile widths was used.
- **Firefox** — not tested.
- **Any real touch interaction.** Mobile tests used Chromium with `isMobile`/`hasTouch` emulation, which does not reproduce iOS momentum scrolling, Safari's dynamic toolbar, or real gesture handling.
- **Physical safe-area insets.** The notched-device layout (`viewport-fit=cover` + `env()`) was evaluated at zero inset only.
- **200% browser zoom and text-only zoom** (WCAG 1.4.4/1.4.10) — not tested.
- **High-contrast / forced-colors mode** on Windows or macOS — not tested.
- **Screen-reader testing** with VoiceOver, NVDA, or TalkBack — not performed. All accessibility findings are from DOM/ARIA inspection and automated measurement only.

**Performance**
- **Lighthouse scores** were not run. LCP, CLS and transfer weight come from `PerformanceObserver` and Playwright network interception, which is a different methodology and not directly comparable to Lighthouse's field-lab hybrid.
- **Field data (CrUX / RUM)** — no real-user metrics were available.
- **Throttled-network testing.** All measurements were on an unthrottled connection. The *impact* of the 94 MB video finding on a 3G connection is calculated, not measured.
- **CPU throttling** and long-task profiling were not performed.
- **Cache hit/miss behaviour across repeat visits** was not measured.

**Infrastructure**
- **Vercel dashboard access** was not available. Build logs, function invocation logs, error rates, and the actual configured environment variables were not inspected. The only evidence is the presence of `configured: true` in the public session response and the behaviour of the endpoints.
- **Actual `ADMIN_PASSWORD` and `GITHUB_TOKEN` values, scopes and rotation state** were not inspected, and no authenticated admin flow was exercised.
- **GitHub repository state** beyond the `main` branch contents was not inspected (branch protection, Actions, webhooks, secret scanning, token permissions).
- **Automatic Vercel redeploy on the admin API's commits** was not confirmed. The claim that uploads become visible only after a deploy is inferred from the code and from `assets/images/gallery/` being empty — it was not observed end to end.
- **`vercel build` and `vercel dev` were not run.** The build has no step, so this is low risk, but it was not executed.
- **Domain configuration, DNS, subdomains, email deliverability, and any other Vercel domains** attached to the project were not inspected.

**Content and data**
- **The GitHub API path was never exercised**, because that requires valid credentials. All findings about the stale read-before-write (§8 P0) and the upload/delete flows are from code reading plus the observed production response, not from a live write.
- **No data was uploaded, deleted, or modified** during this audit. Every API probe was non-destructive and used deliberately wrong credentials or unauthenticated requests.
- **Photograph quality, colour accuracy, and print output** were not assessed. This is a design review of code, not of the photography.
- **Copy accuracy, factual claims, and brand/legal text** (including the "NDAs signed on request" and "Password-protected galleries" claims on the Services page) were not verified against actual studio practice.

**Method**
- **Headless Chromium does not composite `<video>` frames into screenshots.** No video-frame contrast or legibility claim in this report is based on a screenshot. The frame-accurate contrast results for the cinematic band that shipped in `bf877fa` (desktop lede 6.63:1, mobile lede 7.18:1) come from source-frame analysis performed in earlier work, **not** from this audit, and are quoted only as background.
- **Service-card and lightbox contrast over photography** could not be measured by DOM colour sampling, because those backgrounds are CSS gradients and images rather than `backgroundColor`. Only `.svc .cap` was resolved, via pixel sampling of a screenshot; the other gradient-backed text was left unmeasured rather than guessed.
- **Automated accessibility scanning (axe, Lighthouse a11y) was not run** — no scanner was available in the environment. Findings are from manual DOM inspection and scripted measurement, which will miss issues a scanner would catch.
- **No load testing, no concurrency testing, and no API rate-limit testing** were performed.

---

## Final Counts

### Files inspected

| Category | Count |
|---|---|
| Tracked source and configuration files read in full | **6** |
| Tracked media assets inspected (229 images, 8 videos, 4 posters) | **241** |
| Untracked local-only files inspected (`.vercel/` metadata + secret scan) | **4** |
| **Total files inspected** | **251** |
| Tracked files in repository (all inventoried) | 247 |
| Unused assets identified | 2 |
| Broken or missing asset references | **0** |

### Checks and tests performed

| Check | Count |
|---|---|
| `node --check` syntax validations | 1 (API) + 2 (inline blocks) = **3** |
| Non-destructive live HTTP probes (`curl`) | **14** |
| Non-destructive live API probes | **8** |
| Response-header inspections | **5** resource groups |
| `ffprobe` media validations | **8** videos (codec, resolution, fps, duration, bitrate, profile, pix_fmt) |
| MP4 box-structure parses (faststart verification) | **8** |
| Keyframe / GOP counts | 4 |
| Asset-reference resolution | **239** paths (186 AVIF + 41 JPEG + 4 posters + 8 videos), all resolving to tracked files |
| Browser route × viewport combinations for overflow | **45** (5 routes × 9 widths) |
| Browser console / page-error / failed-request captures | 6 contexts |
| Video loading and autoplay state captures | 6 route/viewport combinations |
| Service-card clipping width sweep | **23** widths |
| Service-card fit measurements | 5 cards × 4 viewports = **20** |
| Keyboard tab-order traces | 3 (gallery, mobile, lightbox) |
| Live contrast measurements (computed styles) | **~60** pairs across 5 routes × 2 viewports |
| Analytic contrast computations | **42** token pairs |
| Pixel-sampled legibility analyses | **2** regions |
| CLS measurements | 2 (mobile 0.577, desktop 0.404) |
| LCP / transfer-weight measurements | 2 |
| `load`-event timing measurements | 4 |
| Reduced-motion behaviour verifications | 2 (home, gallery) |
| No-JavaScript render verification | 1 |
| Focus-indicator computation | 1 |
| Form validation and value-resolution verifications | 4 |
| Lightbox semantics, focus, and scroll-lock verifications | 3 |
| Secret-pattern scans over tracked files | **9** patterns |
| Local secret key inventory (values not read) | 23 keys |
| Duplicate-ID and dangling-reference scans | 73 ids, 0 duplicates, 0 dangling |
| **Total discrete checks performed** | **~600** |

### Counting rules

The severity tables in each section are self-contained, so a defect that spans two disciplines (a video-loading bug that is also a Core Web Vitals problem, an `innerHTML` sink that is also a stored-XSS risk) is tagged in both sections. To keep the totals honest:

- **Severity-tagged rows** — every row that carries a `P0`–`P3` cell. These are counted in the per-section tables.
- **Cross-references** — a row whose issue is an explicit restatement of a row in another section, marked `Cross-reference of §…` or `*(Canonical row …)*`. Each defect is counted **once**, in its canonical section.
- **Non-findings** — rows that record a verified pass. There is exactly one (the HSTS check in §15) and it carries `—` instead of a severity.

### Cross-reference index

| Cross-reference | Severity | Canonical location |
|---|---|---|
| §6 row 2 — `DOMContentLoaded` init order | P2 | §8 row 4 |
| §11 row 2 — `.svc-detail` clipping | P2 | §7 row 1 |
| §11 row 3 — `svh`/`dvh` without `vh` fallback | P3 | §7 row 6 |
| §13 row 1 — 94 MB video on first load | P1 | §9.2 row 1 |
| §13 row 3 — intro band on every route | P1 | §9.2 row 4 |
| §13 row 4 — relative `og:image` / JSON-LD image | P2 | §17 row 4 |
| §13 row 6 — 8-day cache window | P2 | §10 row 1 |
| §14 row 1 — enquiry has no server submission | P1 | §18 row 1 |
| §14 row 3 — stale read-before-write | P0 | §8 row 1 |
| §15 row 6 — `innerHTML` sinks | P2 | §8 row 5 |
| §16.1 row 3 — eyebrow/placeholder contrast | P2 | §7 row 2 |
| §16.1 row 4 — `.svc .cap` title contrast | P2 | §7 row 3 |
| §16.1 row 9 — 2.2.2 Pause/Stop/Hide | P2 | §9.2 row 5 |
| §16.1 row 10 — reduced motion bypassed by `force` | P1 | §9.2 row 3 |
| §17 row 9 — `Content-Disposition` filename | P3 | §10 row 3 |
| §18 row 6 — no branded 404 | P3 | §20 row 7 |
| §20 row 4 — admin write invisible until deploy | P2 | §14 row 4 |

### Findings by severity

| Severity | Severity-tagged rows | Cross-references | **Distinct findings** |
|---|---|---|---|
| **P0 — Critical** | 3 | 1 | **2** |
| **P1 — High** | 17 | 4 | **13** |
| **P2 — Medium** | 41 | 9 | **32** |
| **P3 — Low / Minor** | 50 | 3 | **47** |
| **Total** | **111** | **17** | **94** |

*Memo: one further row (§15, the HSTS check) carries `—` instead of a severity because it records a verified pass, so it appears in 111+1 table rows but in no severity bucket.*

The two P0s are: the site renders nothing without JavaScript (§6) and the gallery API's stale read-before-write (§8).

### Findings by category

`P0`–`P3` are distinct findings; **Rows** is the number of severity-tagged table rows, including cross-references.

| Category | P0 | P1 | P2 | P3 | Rows | Cross-refs | **Distinct** |
|---|---|---|---|---|---|---|---|
| HTML & Semantic Markup | 1 | 0 | 2 | 2 | 6 | 1 | **5** |
| CSS Analysis | 0 | 0 | 3 | 5 | 8 | 0 | **8** |
| JavaScript | 1 | 1 | 3 | 7 | 12 | 0 | **12** |
| Video & Motion | 0 | 4 | 1 | 4 | 9 | 0 | **9** |
| Image & Asset Optimization | 0 | 0 | 2 | 2 | 4 | 0 | **4** |
| Responsive & Mobile | 0 | 0 | 1 | 3 | 6 | 2 | **4** |
| Performance & Core Web Vitals | 0 | 1 | 0 | 2 | 7 | 4 | **3** |
| Network & API | 0 | 0 | 3 | 3 | 8 | 2 | **6** |
| Security | 0 | 2 | 3 | 4 | 10 | 1 | **9** |
| Accessibility | 0 | 2 | 4 | 5 | 15 | 4 | **11** |
| SEO | 0 | 1 | 4 | 3 | 9 | 1 | **8** |
| Forms & UX | 0 | 1 | 4 | 2 | 8 | 1 | **7** |
| Deployment & Infrastructure | 0 | 1 | 2 | 5 | 9 | 1 | **8** |
| **Total** | **2** | **13** | **32** | **47** | **111** | **17** | **94** |

**Both P0 rows, in full:**
1. **§6 — the site is blank without JavaScript.** All six `<main>` regions are `display:none` until JS adds `.active`, and every photograph is injected by script. *Confirmed with JavaScript disabled.*
2. **§8 — the gallery API reads a deploy-time snapshot before GitHub,** then `PUT`s that snapshot wholesale, so two admin edits before a redeploy silently overwrite each other. *Confirmed by code reading; requires credentials to reproduce live.*

### What passed cleanly

- **No horizontal overflow at any of 45 route/width combinations.**
- **Zero console errors, zero uncaught exceptions, zero failed requests** in every browser configuration tested.
- **Zero broken asset references** — 186/186 expected AVIF variants, 41/41 JPEG, 4/4 posters, 8/8 videos all resolve to tracked files.
- **Zero duplicate IDs, zero dangling `getElementById` targets, zero syntax errors.**
- **All 8 videos are correctly encoded** — `moov` before `mdat` in all 8, correct level per rendition, `yuv420p` throughout, no audio tracks.
- **No live secrets in version control.**
- **Reduced motion works correctly on the homepage.**
- **Video toggles, scroll-pause, `visibilitychange`, `pageshow` and rendition selection all work correctly.**
- **Service cards are fully keyboard operable** — a genuine accessibility improvement in the last ten commits.
- **HSTS, Brotli, HTTP/2, range requests and CDN caching are all correctly configured.**
- **The API's authentication boundary is correct** — every mutating action returns 401 unauthenticated, and the password comparison is timing-safe.
- **Per-field form validation with `aria-invalid`, `aria-describedby` and focus management is correctly implemented.**
