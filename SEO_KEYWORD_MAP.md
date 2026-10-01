# Swaroop Studios — Keyword Map

A map of local and service intent to the page that should satisfy it. Not a
list of terms to force into copy — the site serves one page per intent, and
every term below is either already supported by published facts or is explicitly
marked as needing owner confirmation.

**Owner:** studio · **Origin:** `https://www.swaroopstudios.com/` · **Updated:** 1 Oct 2026

## 1. Facts this map may rely on

| Fact | Source of truth |
|---|---|
| Established 1972 | Header/footer lockup, heritage timeline, metadata |
| Based in Bengaluru, India | `CONTACT.location`, contact copy |
| Serves Bengaluru, Hoskote, Karnataka | Owner-supplied; now published on `/about` and `/contact` |
| Phone `+91 99004 86574`, email `swaroopstudios@gmail.com` | `CONTACT` block |
| Instagram `swaroop_studios` | `CONTACT.instagram` |
| Services: wedding, event, corporate, portrait/headshot, complete coverage, private/VIP | Services page markup and service cards |
| Films: silent wedding film, reception film, studio teaser, opening film | `assets/videos/`, verified durations |
| Gallery: wedding + portrait only | `data/gallery.json` + `LOCAL_IMAGES` |

Anything not in this table is off-limits until the owner confirms it.

## 2. Page → intent map

| Page | Primary intent | Secondary terms it can honestly target |
|---|---|---|
| `/` | photography studio Bengaluru | photography studio Bengaluru since 1972, wedding photography Bengaluru, event photographer Bengaluru, studio Bengaluru |
| `/about` | studio background / trust | photography studio history, press photography, since 1972, studio Bengaluru Karnataka |
| `/services` | service-specific intent | wedding photography Bengaluru, wedding photographer Bengaluru, event photography Bengaluru, corporate photography Bengaluru, corporate photographer Bengaluru, portrait studio Bengaluru, headshots Bengaluru, wedding films Bengaluru, photographer Hoskote, photographer Karnataka |
| `/gallery` | proof / visual browsing | wedding photography portfolio, portrait photography Bengaluru, wedding album, candid wedding photography |
| `/contact` | conversion | wedding photography enquiry, book photographer Bengaluru, photography contact Bengaluru, photographer Hoskote |

## 3. Intent deliberately not targeted

| Term | Why not |
|---|---|
| "best", "top", "award-winning", "award-winning photographer" | No awards, rankings or ratings are published. Unverifiable superlatives are the fastest route to a manual action. |
| Any price / package / rate term ("affordable wedding photography", "photography package price") | No pricing is published; quotes are per assignment. |
| "studio address", "near me" with a street address | No street address is published, so no location-page or address term can be served truthfully. |
| Individual photographer or team-member names | No team roster is published. |
| Year-count terms ("30 years of experience", "50 years in Bengaluru") | "Since 1972" is published; a derived year count is an inference. Use 1972. |
| Event- or corporate-*gallery* terms | The public gallery contains no event or corporate images. |

## 4. Vocabulary that is new since the domain migration

Added because it is factual and was missing, not because it is high-volume:

- **Hoskote** — named once on `/about` and once on `/contact`, plus in the `/services` lede, the FAQ answer and `llms-full.txt`.
- **Karnataka** — named on `/about`, `/contact`, `/services` and in `areaServed` / `addressRegion`.
- **cinematography / videography** — deliberately **not** added. The site says "films" and "wedding films"; "cinematography" implies a different service and the studio's own copy does not use it.

## 5. On-page mapping

| Element | Where | Notes |
|---|---|---|
| `<title>` | per route via `ROUTE_SEO` | 50–57 chars; brand + primary term + location |
| Meta description | per route via `ROUTE_SEO` | 127–150 chars; term + fact, no superlatives |
| `og:title` / `og:description` | mirrors `<title>`/description | |
| `og:image` / `twitter:image` | per route via `ROUTE_SEO` | 5 × 1200×630 JPEG in `assets/og/` |
| `Service` nodes | JSON-LD | 5 nodes matching the on-page service cards |
| `areaServed` | JSON-LD `#studio` | Bengaluru, Hoskote, Karnataka |
| `geo.placename`, `geo.region`, `ICBM` | `<head>` | Bengaluru, India / IN-KA |
| Internal links | Home → `/gallery`, `/about`; About → `/gallery` | descriptive anchor text |

## 6. Measurement plan

No analytics or Search Console property is wired up yet, so no query data
exists. Once a property is connected, the review order should be:

1. Impressions and average position per route — `/` and `/services` first.
2. Which queries surface `/about` versus `/` — tells whether the trust copy or
   the service copy is winning the studio's generic brand terms.
3. Branded versus non-branded split — non-branded growth is the only real
   signal that local SEO is working.
4. Search Console image reporting for the AVIF/JPEG gallery — replaces the
   deprecated image sitemap.