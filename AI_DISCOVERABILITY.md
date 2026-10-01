# Swaroop Studios — AI Discoverability

## 1. Strategy

Normal SEO remains the foundation (crawlable path routes, sitemap, robots,
JSON-LD, semantic HTML, metadata). `llms.txt` and `llms-full.txt` are a
thin complementary layer: short, factual, stable files that let AI assistants
and answer engines describe the studio accurately without scraping UI copy.

## 2. Files

- `/llms.txt` — concise: who, services, locations, page list, contact.
- `/llms-full.txt` — full reference: entity facts, exact service list,
  site structure, non-public areas, and an explicit claims policy.
- Both served as `text/plain`, cached 1h + SWR, listed for crawlers via
  normal site crawling (referenced here and in `SEO_AUDIT.md`).

## 3. Crawler strategy

- `robots.txt` allows all legitimate crawlers (search + AI) across public
  paths; it does not name AI bots individually — public content is public to
  every honest crawler, and allow-listing bot names would rot.
- Disallowed: `/admin`, `/admin/`, `/api/`. Private client galleries and
  enquiries are never linked publicly and never appear in the sitemap or the
  llms files.

## 4. Structured data

Static `ProfessionalService` + `WebSite` `@graph` in `<head>` (see
`SEO_AUDIT.md` §11): name, URL, description, foundingDate, phone, email,
Bengaluru locality, Instagram `sameAs`, absolute image. Runtime JS only
refreshes the image URL. No reviews, ratings, awards, or prices — none are
published, so none are claimed.

## 5. Semantic content

One `h1` per view; fixed heading order; real `header`/`nav`/`main`/`section`/
`figure`/`footer`; descriptive alt text; `<noscript>` summary with NAP and
crawlable links; per-route titles/descriptions/canonicals via `ROUTE_SEO`.

## 6. Machine-readable business facts (single source of truth)

Swaroop Studios · established 1972 · Bengaluru, India ·
+91 99004 86574 · swaroopstudios@gmail.com · WhatsApp +91 90360 55099 ·
https://www.instagram.com/swaroop_studios ·
https://www.swaroopstudios.com/ (+ `/about`, `/services`, `/gallery`, `/contact`).

## 7. What AI systems can safely infer

- It is a photography studio (weddings, events, corporate, portraits) that
  also shows silent cinematic films.
- Quotes are per-assignment; no pricing is published.
- Private/VIP work is confidential and never published without approval.

## 8. Intentionally excluded (do not infer or state)

Awards, rankings ("best/top"), reviews/ratings, years-of-experience figures,
team members, pricing, street address, service areas beyond Bengaluru,
testimonials, press features. The About page still carries two bracketed
placeholders (exact press years / founding details) — these are gaps, not facts.
