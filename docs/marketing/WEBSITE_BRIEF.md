# Trailblazer PMS — Marketing Website Build Brief

**Audience:** Website developer / designer (built in Claude Design)
**Product:** Trailblazer PMS — the agentic property management system for modern RV resorts, campgrounds, and glamping destinations
**Positioning:** *The first agentic-first PMS built for the modern RV resort.*
**Tone:** Confident. Premium. A little rebellious. Think Ritz-Carlton hospitality meets a Sierra sunrise — with an AI concierge riding shotgun.

---

## 1. Brand Foundation

### 1.1 The one-liner
> **Trailblazer is the agentic PMS that runs your resort while you run the campfire.**

### 1.2 Elevator pitch (60 words)
Trailblazer is the first property management system built agent-first for high-end RV resorts, campgrounds, and glamping destinations. Instead of clicking through 40 screens a day, your team talks to TrailGuide — an on-property AI operator that books, checks in, posts revenue, runs night audit, texts guests, and files work orders. Less software. More hospitality.

### 1.3 Brand pillars
1. **Agentic-first, not AI-sprinkled.** Every workflow has an agent behind it — booking, folio, housekeeping, reporting, guest messaging.
2. **Built for the modern resort.** Full-hookup RV, luxury glamping, cabins, group blocks, F&B POS — one clean stack.
3. **Hospitality-grade.** PCI SAQ A, MFA, night audit, real accounting. Not a spreadsheet with a login.
4. **Owner-obsessed.** Real-time revenue, guest LTV, occupancy — surfaced by your AI, not buried in a report.

### 1.4 What we're NOT
- Not a booking widget bolted onto a WordPress site.
- Not a legacy Windows PMS with a web wrapper.
- Not "AI-powered" as a marketing checkbox — the agent is the product.

---

## 2. Visual Identity

### 2.1 Logo
- **Primary logo:** `/src/assets/trailblazer-logo-main.png` (full mark)
- **Light variant:** `/src/assets/trailblazer-logo-light.png` (for dark backgrounds)
- **Dark variant:** `/src/assets/trailblazer-logo-dark.png` (for light backgrounds)
- **Shield only:** `/src/assets/trailblazer-shield.png` (favicon, avatars, app icons)
- **Wordmark:** `/src/assets/trailblazer-wordmark-dark.png`

**Clear space:** Minimum padding = height of the "T" in Trailblazer.
**Minimum size:** 32px shield, 120px full lockup.
**Never:** recolor, add drop shadow, place on busy imagery without a scrim.

### 2.2 Color palette — "Emerald Prestige"
Lock these exact tokens. They match the app so the marketing site feels like a natural front door.

| Token | Hex | HSL | Usage |
|---|---|---|---|
| **Deep Emerald** (primary) | `#064E3B` | `162 78% 17%` | Primary buttons, headings, nav, brand |
| **Forest Glow** | `#178A5E` | `162 65% 32%` | Gradient partner, hover states |
| **Aged Gold** (accent) | `#C9A84C` | `43 56% 54%` | CTAs, highlights, premium accents |
| **Warm Gold** | `#E0C476` | `43 70% 68%` | Gold gradient partner, hover |
| **Parchment** (canvas) | `#F7F4EC` | `40 38% 97%` | Page background |
| **Cream Card** | `#FFFFFF` | `0 0% 100%` | Card surfaces on parchment |
| **Ink** (text) | `#0C1F17` | `165 60% 8%` | Body, headings |
| **Muted Ink** | `#5C6660` | `165 15% 35%` | Sub-copy, meta |
| **Border** | `#E5DFD1` | `40 18% 86%` | Dividers, card borders |

**Signature gradients**
- **Primary:** `linear-gradient(135deg, #064E3B 0%, #178A5E 100%)`
- **Gold:** `linear-gradient(135deg, #C9A84C 0%, #E0C476 100%)`
- **Hero ambient:** radial emerald top-left + radial gold bottom-right at 10–14% opacity over parchment.

**Dark mode (optional)** matches the app's dusk palette: `#19171C` background, orange `#F97316` accent instead of gold.

### 2.3 Typography
- **Display / headings:** *Fraunces* (700, optical size tuned) — serif with just enough personality to feel resort, not corporate.
- **Body:** *Inter Variable* (400/500/600) — the app font, keeps continuity.
- **Numeric / stats:** *Inter* tabular-nums.
- **Sizing scale:** 12 / 14 / 16 / 18 / 22 / 28 / 36 / 48 / 64 / 84.
- **Tracking:** headings `-0.02em`, body default, all-caps eyebrows `+0.12em`.

### 2.4 Motion & feel
- Fades, gentle slide-ups (14px, cubic-bezier(.22,1,.36,1), 400ms).
- Parallax on hero imagery — subtle, 8–12% depth max.
- Cursor-follow glow on primary CTA.
- Never bounce, never spin. This is a resort, not a startup.

### 2.5 Photography direction
- Golden-hour RV resorts, luxury Airstreams, safari tents, cedar bathhouses, string lights, campfires.
- Real people: multigenerational families, remote workers on decks, couples with morning coffee.
- Aerial drone shots of well-lit loops at dusk.
- **Avoid:** stock rusty campers, sad KOA signage, empty pull-throughs at noon.

Suggested sources: Unsplash collections "luxury glamping", "airstream sunset", "colorado camping"; commission 6–10 hero shots if budget allows.

---

## 3. Site Architecture

```
/                     Home
/product              Product overview (the agentic story)
/product/trailguide   The AI operator — deep dive
/product/booking      Booking engine + direct-book widget
/product/front-desk   Reservations, folio, check-in
/product/accounting   Night audit, PCI, city ledger
/product/messaging    Two-way SMS, AI reply agent
/product/reporting    Reports + agentic scheduled jobs
/solutions/rv-resorts
/solutions/glamping
/solutions/campgrounds
/solutions/multi-property
/pricing
/customers            Case studies + logos
/customers/[slug]     Individual story
/resources            Blog / guides / calculators
/resources/blog/[slug]
/resources/roi-calculator
/resources/pms-buyers-guide
/about
/security             PCI SAQ A, MFA, uptime
/demo                 Book a demo (form + Calendly)
/login                → app.trailblazerpms.com
/legal/terms
/legal/privacy
/legal/dpa
```

**Global nav:** Product ▾ · Solutions ▾ · Pricing · Customers · Resources ▾ · **Book a demo** (gold) · Sign in
**Footer:** 4 columns (Product / Solutions / Company / Resources) + trust row (PCI SAQ A, SOC 2 in progress, 99.9% uptime) + newsletter.

---

## 4. Home Page — Section-by-Section

### 4.1 Hero
**Layout:** Full-viewport, split 60/40. Left = copy. Right = a live-looking product frame showing TrailGuide chat ("Text me today's arrivals" → assistant response with 12 names, sites, ETAs). Ambient emerald→gold gradient wash. Faint topographic map SVG in background.

**Eyebrow:** `THE AGENTIC PMS FOR MODERN RV RESORTS`

**H1 (pick one; A/B test the top two):**
1. **Run the resort. Not the software.**
2. **Your PMS just learned to talk back.**
3. **The first agentic PMS built for high-end RV resorts.**

**Sub-headline:**
> Trailblazer replaces 40 clicks a day with one conversation. Ask TrailGuide to check guests in, post folios, run night audit, or text tomorrow's arrivals — and it just does it.

**Primary CTA:** `Book a 20-min demo` (gold, glowing)
**Secondary CTA:** `See TrailGuide in action ▸` (ghost, opens 90-sec loop)

**Trust strip below CTAs:** *"Trusted by resorts from Sedona to the Smokies"* + 6 grayscale logos (add real ones as they land).

### 4.2 Problem strip (dark emerald band)
**Eyebrow:** `THE OLD WAY IS OVER`
**H2:** Legacy PMS was built for clerks. Modern resorts need an operator.
Three columns, gold icons:
- **40+ screens a day.** Your team is data entry, not hospitality.
- **Reports you never read.** Insights buried three exports deep.
- **Guests who ghost.** No SMS, no proactive service, no memory.

### 4.3 The agent, front and center
**H2:** Meet TrailGuide — the AI operator on your team.
**Sub:** *One assistant. Every workflow. Real actions, not chit-chat.*

Tabbed live-demo card cycling through:
- **Front desk** → "Check in the Hendersons on site 42" → done, ID captured, folio opened.
- **Reporting** → "Text me a summary of yesterday's revenue at 8am every day" → scheduled TrailGuide Item created.
- **Guest care** → Inbound SMS: "Can we get a late checkout?" → AI drafts reply, staff approves in one tap.
- **Night audit** → "Post today's room revenue and roll the date" → audit completes with journal preview.

**CTA:** `Explore TrailGuide ▸`

### 4.4 Product pillars (bento grid, 6 tiles)
Each tile: gold icon, H3, one-line, "Learn more ▸".
1. **Direct-book engine** — Branded, mobile-first, zero commission.
2. **Front desk that flies** — Drag-drop tape chart, instant check-in, folio review.
3. **Real accounting** — Double-entry, city ledger, night audit, tax rules that work.
4. **Two-way guest messaging** — SMS + email + AI reply agent.
5. **PCI SAQ A payments** — Adyen Drop-in, MFA on sensitive actions.
6. **TrailGuide Items** — Schedule the agent to run reports, blasts, forecasts.

### 4.5 Solutions row (three cards)
- **RV Resorts** — Full-hookup, premium sites, group blocks, POS.
- **Glamping & Boutique** — Safari tents, cabins, yurts — one inventory model.
- **Multi-property groups** — Shared CoA, cross-property reporting, one login.

### 4.6 Social proof
**H2:** Resorts are already running on Trailblazer.
- 3 customer quote cards (photo, name, resort, role, 1-line quote).
- Metric strip: `$0 in commissions to OTAs` · `–72% front desk clicks` · `+18 min per guest interaction` · `4.9★ guest CSAT`.

### 4.7 Security band (parchment on emerald)
**H2:** Hospitality-grade security by default.
Icons + labels: **PCI SAQ A · MFA everywhere · Row-level tenant isolation · 99.9% uptime · Encrypted at rest & transit · Audit log on every change.**
**CTA:** `Read the security overview ▸`

### 4.8 Pricing preview
Three-tier card teaser (Solo / Resort / Portfolio) with "starts at" pricing and a full comparison on `/pricing`.
**CTA:** `See full pricing ▸`

### 4.9 Final CTA (full-bleed hero image, campfire dusk)
**H2:** Ready to trade clicks for conversations?
**Sub:** Book a 20-minute demo. We'll show TrailGuide running on a resort like yours.
**CTA:** `Book a demo` (gold) + `Talk to sales ▸` (ghost)

### 4.10 Footer
Logo · tagline · newsletter (`Get the Modern Resort Operator — monthly`) · nav columns · legal · social · "SOC 2 in progress" badge.

---

## 5. Copy Bank — reusable snippets

**Eyebrows**
- THE AGENTIC PMS FOR MODERN RV RESORTS
- BUILT FOR RESORT OPERATORS, NOT CLERKS
- ONE ASSISTANT. EVERY WORKFLOW.

**Alt hero H1s** (for solution pages)
- Glamping: *Boutique hospitality, unbelievably simple operations.*
- Multi-property: *One agent. Every property. Every number.*
- RV Resorts: *The PMS your resort deserves. The agent your team will love.*

**CTA labels** (use consistently)
- Primary: **Book a demo** · **Start free trial** · **Talk to sales**
- Secondary: **See TrailGuide** · **Watch the 90s tour** · **Read the story**

**Proof lines**
- "We closed our first night audit in 3 minutes. It used to take 45." — *Ops Director, 220-site RV Resort*
- "TrailGuide texts me arrivals at 7am every day. I fired my morning meeting." — *GM*
- "Direct bookings are up 34% since we launched the Trailblazer engine." — *Owner*

---

## 6. SEO Framework

### 6.1 Target keyword clusters
| Cluster | Primary | Supporting |
|---|---|---|
| Category | *RV park management software*, *campground management software* | *RV resort PMS*, *glamping PMS*, *campground booking system* |
| Agentic | *AI campground software*, *AI PMS*, *AI RV park software* | *agentic PMS*, *campground automation* |
| Alternative | *[competitor] alternative* | Campspot / Newbook / RMS / ResNexus alternative pages |
| Job-to-be-done | *campground booking engine*, *campground night audit*, *RV park accounting software* | *two-way SMS campground*, *campground housekeeping software* |
| Persona | *software for RV resort owners*, *multi-property campground software* | *glamping site management* |

### 6.2 Page-level SEO targets
Each page ships with:
- Unique `<title>` (≤60 chars), `<meta description>` (≤160)
- Canonical + `og:*` + `twitter:card=summary_large_image`
- H1 = single, keyword-led, human
- JSON-LD: `Organization` sitewide; `Product` on product pages; `FAQPage` on pricing + solutions; `Article` on blog; `BreadcrumbList` on nested routes
- Named anchor IDs on every section for share-links

**Home**
- Title: `Trailblazer — The Agentic PMS for RV Resorts & Campgrounds`
- Desc: `Trailblazer is the AI-first property management system for modern RV resorts, campgrounds, and glamping. Bookings, folio, night audit, and guest messaging — run by one assistant.`

**Product / TrailGuide**
- Title: `TrailGuide — The AI Operator for Your Resort | Trailblazer`
- Desc: `Meet TrailGuide: the agentic assistant that checks guests in, posts folios, runs reports, and texts your team — all from one chat.`

**Solutions / RV Resorts**
- Title: `RV Resort Management Software Built for 2026 | Trailblazer`
- Desc: `Purpose-built for high-end RV resorts: direct booking, PCI-compliant payments, night audit, and an AI operator that runs the busywork.`

**Pricing**
- Title: `Pricing — Simple, Site-Based, No Booking Fees | Trailblazer`

### 6.3 Content engine (launch with these 12 posts)
1. *The Modern Resort Operator's Playbook (2026)* — pillar
2. *What "Agentic PMS" Actually Means (and Why It Matters for RV Parks)*
3. *Direct Bookings vs. OTAs: The Real Math for RV Resorts*
4. *Night Audit, Explained — Without the Jargon*
5. *PCI SAQ A for Campground Operators: A Plain-English Guide*
6. *How to Cut Front-Desk Time by 70% (Case Study)*
7. *SMS Guest Messaging: 12 Templates That Convert*
8. *Building a Luxury Glamping Brand: The Tech Stack*
9. *Multi-Property Reporting Without the Spreadsheets*
10. *Campspot vs Newbook vs Trailblazer: Honest Comparison*
11. *The 2026 RV Resort Tech Stack*
12. *Interview: Inside a $4M/yr Resort Running on Trailblazer*

### 6.4 Technical SEO checklist
- `sitemap.xml` auto-generated, submitted to GSC + Bing
- `robots.txt` allows all, blocks `/app`, `/admin`
- Core Web Vitals: LCP <2.0s, INP <150ms, CLS <0.05 (image budget: hero ≤180KB AVIF)
- Fonts: self-host Fraunces + Inter, `font-display: swap`, preload display cut
- Every image: descriptive alt, lazy-load below fold, AVIF + WebP fallback
- Internal linking: every product page links to TrailGuide + Pricing + Demo

---

## 7. Conversion & CTAs

### 7.1 CTA hierarchy
1. **Primary (gold, glowing):** `Book a demo` — appears in nav, hero, mid-page, footer.
2. **Secondary (ghost emerald):** `See TrailGuide` / `Watch the tour`.
3. **Tertiary (text link + arrow):** `Read the story ▸`, `Explore pricing ▸`.

### 7.2 Demo form (short is better)
Fields: Name · Work email · Resort/company · Number of sites · Current PMS (dropdown incl. "None / spreadsheet"). Submit → Calendly embed with 20-min slots.

### 7.3 Micro-conversions to instrument
- Newsletter signup (footer + blog inline)
- ROI calculator completion
- Buyer's guide PDF download (gated: email only)
- 90-sec product video plays >50%

### 7.4 Trust signals to place near every CTA
- "20-min demo · no card required"
- "PCI SAQ A · MFA · 99.9% uptime"
- Small customer logo strip

---

## 8. Imagery Shot List
Deliver these to the photographer / stock curator:
1. **Hero:** Airstream + string lights at golden hour, family around fire, soft focus.
2. **Product frame:** Laptop on a cedar picnic table showing the app.
3. **TrailGuide:** Phone in-hand with the SMS conversation visible.
4. **Front desk:** Barista-style check-in counter, iPad, warm wood.
5. **Aerial:** Well-lit RV loops at dusk, drone shot.
6. **Glamping:** Safari tent interior, linen bed, lantern.
7. **Team:** Two staff members laughing, radios on hip.
8. **Guest moment:** Couple with coffee on a deck at sunrise.
9. **Security:** Abstract emerald + gold data visualization (illustrated, not stock).
10. **Community:** Group event under bistro lights, s'mores.

Every image: 16:9 hero crop + 4:5 mobile crop + AVIF export.

---

## 9. Components to Build

Reusable design system for the site:
- `HeroSplit` — copy left, media right, gradient background
- `EyebrowH2Sub` — section header pattern
- `BentoGrid` — 6-tile product grid
- `TabbedDemoCard` — cycling AI conversation demo (animated typing)
- `LogoCloud` — grayscale, hover-color
- `StatStrip` — 4 metrics, tabular nums
- `QuoteCard` — headshot + quote + attribution
- `PricingTable` — 3-tier, hover-lift on featured
- `CTABand` — full-bleed image + emerald scrim + gold CTA
- `TrustBadges` — PCI, MFA, uptime, SOC 2
- `NewsletterInline` — 1-field, gold submit
- `FAQAccordion` — schema-marked

All components: honor the design tokens (no hardcoded colors), 8px spacing grid, 12px card radius, `hover-lift` utility on interactive tiles.

---

## 10. Accessibility & Quality Bar
- WCAG 2.2 AA. Emerald on parchment passes AAA for body.
- Every interactive: 44px min tap target, visible focus ring in gold.
- Motion respects `prefers-reduced-motion`.
- Alt text on every image (no "image of…").
- Forms: real labels, inline validation, error summary at top.
- Lighthouse: Perf ≥95 mobile, A11y = 100, SEO = 100, Best Practices ≥95.

---

## 11. Launch Checklist
- [ ] Domain: `trailblazerpms.com` (302 `www` → apex)
- [ ] App on `app.trailblazerpms.com`
- [ ] `sitemap.xml` + `robots.txt` + GSC + Bing verified
- [ ] GA4 + PostHog (event: demo_booked, roi_calculator_completed, video_50)
- [ ] Cookie banner (GDPR/CCPA), DPA page live
- [ ] OG images per top-level route (1200×630, gold accent + section title)
- [ ] Favicon set from shield mark
- [ ] 404 + 500 pages on-brand
- [ ] Status page linked in footer
- [ ] All CTAs point to `/demo`
- [ ] Newsletter connected to ESP
- [ ] Load test hero at 3G — LCP <2.5s

---

## 12. Deliverables to Claude Design

Ask Claude Design to output:
1. **Home page** — full-fidelity Tailwind + React, mobile-first, using the tokens in §2.2.
2. **Product / TrailGuide page** — hero + 4 capability sections + demo card + CTA band.
3. **Pricing page** — 3-tier table + FAQ (schema-marked).
4. **Solutions / RV Resorts page** — as home template but resort-specific copy.
5. **Component library** in `/components/site/*` per §9.
6. **Design tokens file** — CSS variables mirroring §2.2 exactly.

**Non-negotiables to pass into the prompt:**
- Use ONLY the tokens in §2.2 — no purple, no indigo, no generic SaaS gradients.
- Fraunces for display, Inter for body. No Poppins.
- Every CTA labeled per §7.1. Primary is gold.
- Every section anchored with `id="..."` for share-links.
- Ship semantic HTML — `<header> <nav> <main> <section> <article> <footer>` — single H1 per page.

---

*Written for the Trailblazer team. Ship it beautiful. Ship it fast. Then let TrailGuide book the demos.*
