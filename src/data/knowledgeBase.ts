export interface KnowledgeBaseArticle {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  /** Legacy field. All articles are now campground-focused. */
  propertyType?: 'hotel' | 'campground' | 'both';
  keywords: string[];
}

export interface KnowledgeBaseCategory {
  id: string;
  name: string;
  icon: string;
  articles: KnowledgeBaseArticle[];
}

// -----------------------------------------------------------------------------
// Trailblazer Campground PMS — Knowledge Base
// Rewritten for campgrounds only. Every article is task-oriented and detailed
// enough that a new operator can self-serve.
// -----------------------------------------------------------------------------

const A = (a: KnowledgeBaseArticle): KnowledgeBaseArticle => ({ propertyType: 'campground', ...a });

export const knowledgeBaseData: KnowledgeBaseCategory[] = [
  {
    id: 'getting-started',
    name: 'Getting Started',
    icon: 'Rocket',
    articles: [
      A({
        id: 'welcome',
        title: 'Welcome to Trailblazer',
        description: 'What Trailblazer is, how it is organized, and where to begin.',
        category: 'getting-started',
        keywords: ['welcome', 'overview', 'trailblazer', 'campground', 'pms'],
        content: `# Welcome to Trailblazer

Trailblazer is a purpose-built Campground Property Management System (PMS). It handles the entire operational lifecycle: reservations, arrivals, in-park guests, folios, payments, night audit, accounting, group blocks, CRM/marketing, POS, a public booking engine, and reporting.

## How the app is organized

- **Dashboard** — today at a glance: arrivals, in-park, departures, occupancy, revenue.
- **Map** — visual site plan with color-coded status.
- **Booking Chart** — Gantt-style stay grid across all sites and dates.
- **In Park Guests** — currently checked-in stays and same-day checkouts, with a folio you can expand inline.
- **Reservations** — every reservation regardless of status.
- **Group Blocks** — multi-site holds for tours, rallies, weddings.
- **Guest Profiles / Guest History** — CRM records and historic folios.
- **CRM** — Registration Card, Confirmation Letter, and Campaigns (email + SMS).
- **Point of Sale** — camp store / F&B; charges can post to a guest's folio.
- **Accounting** — Chart of Accounts, taxes, guest ledger, city ledger, journal entries, trial balance.
- **Day-End Close / Night Audit** — the operational roll-over of the business day.
- **Settings** — property configuration, site types, rates, booking engine, POS, users, integrations.

## Where to start

1. Run the **AI Onboarding Agent** (Help → Onboarding Agent). It walks you through the nine foundational setup steps and can create the config for you.
2. If you prefer to self-serve, follow the articles in **Getting Started** and then **Foundational Setup**.

## Multi-tenant reminder

Every screen is scoped to the property you've selected in the header. Changing the property switches every list, every report, and every setting to that property's data.`,
      }),
      A({
        id: 'onboarding-agent',
        title: 'AI Onboarding Agent',
        description: 'Let the AI walk you through the nine foundational setup steps and write the config for you.',
        category: 'getting-started',
        keywords: ['onboarding', 'ai', 'setup', 'wizard', 'agent'],
        content: `# AI Onboarding Agent

The **Onboarding Agent** is a chat-based guide that lives at **Help → Onboarding Agent**. It takes you through the nine foundational setup steps and — when you approve — writes the configuration directly into your property.

## What it can do

For each step, the agent will:

1. Ask you a few plain-English questions.
2. Show you a **proposed action** (e.g. "Create these 12 accounts", "Create three site types", "Create a Registration Card template").
3. Wait for you to **Approve** or **Reject** before writing anything.
4. Mark the step complete and move on.

## The nine steps

1. **Chart of Accounts** — a campground-tailored CoA aligned to QuickBooks-style GL numbering.
2. **Taxes** — per revenue stream (lodging, add-ons, POS, adjustments), with compound tax support.
3. **Roles & Users** — invite your first admin, manager, and front-desk staff.
4. **Site Types** — Back-in 30A, Pull-thru 50A, Tent, Cabin, etc.
5. **Sites & Map** — bulk-create sites from a range spec ("A1–A20 as Back-in 50A").
6. **Rates** — daily, weekly, monthly, seasons, and packages.
7. **Reservation Settings** — deposit policies, guarantees, source of business.
8. **Booking Engine** — turn on the public booking site.
9. **CRM** — Registration Card, Confirmation Letter, and a starter "OTA → Direct" campaign.

## Safety

The agent never writes anything without your approval. Every write is scoped to the currently selected property.

## Tips

- Have your accountant's Chart of Accounts handy for Step 1 if you already have one.
- Have your local tax rates handy for Step 2.
- If POS applies to you, run the optional POS step at the end.`,
      }),
      A({
        id: 'ask-the-kb',
        title: 'Ask the Knowledge Base',
        description: 'Get direct answers from the KB — the AI reads every article and can also see your property config.',
        category: 'getting-started',
        keywords: ['search', 'ai', 'ask', 'help', 'chat'],
        content: `# Ask the Knowledge Base

The **Ask the KB** tab (top of the Knowledge Base page) lets you ask questions in plain English. The AI answers using:

- Every article in this Knowledge Base.
- A summary of your **current property configuration** (counts of sites, rates, accounts, active integrations).

## Good things to ask

- "How do I refund a guest who cancelled after their deposit was captured?"
- "What GL account should late-checkout fees post to?"
- "Why can't I check a guest in when their site is Dirty?"
- "How do I convert an Expedia booking into a direct booking?"
- "Show me every step to configure the public booking engine."

## What it will not do

- Change any data. For that, use the **Onboarding Agent** or the relevant settings page.
- Answer about other properties you don't have access to.`,
      }),
    ],
  },

  {
    id: 'foundational-setup',
    name: 'Foundational Setup',
    icon: 'Cog',
    articles: [
      A({
        id: 'chart-of-accounts',
        title: 'Chart of Accounts (CoA)',
        description: 'Design a GL that will reconcile cleanly with your external accounting system.',
        category: 'foundational-setup',
        keywords: ['coa', 'gl', 'accounts', 'quickbooks', 'accounting', 'general ledger'],
        content: `# Chart of Accounts

Your Chart of Accounts is the backbone of every financial number in the system. Every posting (room revenue, tax, payment, refund, adjustment) hits at least two accounts.

## Recommended structure

Use a numeric structure that matches your external accounting system (QuickBooks, Xero, Sage, etc.) so exports reconcile cleanly.

| Range | Type | Examples |
|-------|------|----------|
| 1000–1999 | Assets | Cash, Guest Ledger, City Ledger, Advance Deposits |
| 2000–2999 | Liabilities | Sales Tax Payable, Occupancy Tax Payable, Deposits Held |
| 3000–3999 | Equity | Retained Earnings, Owner's Capital |
| 4000–4999 | Revenue | Site Revenue, Cabin Revenue, Add-On Revenue, POS Revenue |
| 5000–5999 | COGS | Store Cost of Goods Sold |
| 6000–7999 | Expenses | Utilities, Labor, Marketing, Repairs |

## Required accounts

At minimum, you need:

- **Cash / Bank** clearing accounts for each payment type (Cash, Visa, MC, Amex, ACH).
- **Guest Ledger** (asset).
- **City Ledger** (asset) if you extend direct-bill credit to companies or OTAs.
- **Advance Deposits** (liability).
- **Sales Tax Payable** and any local **Occupancy / Lodging Tax Payable**.
- Revenue accounts, split at least by: Site Revenue, Cabin Revenue, Add-On Revenue, POS Revenue.
- Adjustment / Comp accounts for discounts and write-offs.

## External account mapping

On each account you can store an **External Account Code** that mirrors your accounting system's account number. Reports and integration exports (QuickBooks) use this field for the round-trip.

## Where to configure

Accounting → Chart of Accounts.

## Fast path

Use the **Onboarding Agent, Step 1** — it will propose a complete campground CoA and, on approval, create every account with the correct type and GL number.`,
      }),
      A({
        id: 'taxes',
        title: 'Taxes & Revenue Streams',
        description: 'Configure sales, occupancy, and compound taxes and attach them to the right revenue accounts.',
        category: 'foundational-setup',
        keywords: ['tax', 'sales tax', 'occupancy tax', 'compound tax', 'vat'],
        content: `# Taxes

Every revenue stream needs one or more taxes attached so the system posts the right amount to the right liability account.

## Common campground taxes

- **State/Provincial Sales Tax** — flat percent on lodging + add-ons.
- **Local Occupancy / Lodging Tax** — additional percent on lodging only.
- **Tourism / Improvement District Tax** — sometimes compound on top of sales tax.
- **POS Sales Tax** — for the camp store, often different from lodging tax.

## Compound vs. additive

- **Additive**: Base × (rate1 + rate2). Most common.
- **Compound**: Base × rate1, then that result × rate2. Used when a tax applies "on top of" another tax.

Configure the calculation method per tax; Trailblazer computes each in the correct order and posts each to its own liability account.

## Attaching taxes to revenue

Open the revenue account (Accounting → Chart of Accounts → *account*) and add one or more taxes. From that moment on, every posting to that revenue account automatically generates its tax lines.

## Fast path

Use the **Onboarding Agent, Step 2**. It will ask for your rates, whether any tax is compound, and which revenue streams each tax applies to — then create the whole set.`,
      }),
      A({
        id: 'roles-users',
        title: 'Roles & Users',
        description: 'Invite staff, assign roles, and understand what each role can do.',
        category: 'foundational-setup',
        keywords: ['users', 'roles', 'permissions', 'admin', 'front desk', 'manager'],
        content: `# Roles & Users

## Built-in roles

- **Super Admin** (internal Trailblazer staff only — not customer-assignable).
- **Admin** — full access to the property, including settings, accounting, and users.
- **Manager** — day-to-day operations plus reporting; cannot manage users or billing.
- **Front Desk** — reservations, check-in / out, folios, payments.

## Custom roles

Under Users → Custom Roles you can create additional roles with granular JSONB permissions (per-module read/write/none).

## Property access

Access is *per property*. A user can be granted access to one property, several, or (via the "org admin" flag) every property in the organization.

## Inviting users

Users → New User. An invite email is sent; the user sets their own password on first login and is required to enroll in MFA when accessing sensitive financial data.

## Fast path

Use the **Onboarding Agent, Step 3**. Give it the names, emails, and desired roles of your first team and it will send the invites.`,
      }),
      A({
        id: 'site-types',
        title: 'Site Types',
        description: 'Define the categories of sites you rent so rates, availability, and the booking engine work correctly.',
        category: 'foundational-setup',
        keywords: ['site types', 'back-in', 'pull-thru', 'tent', 'cabin', 'rv'],
        content: `# Site Types

A **Site Type** is a category of site with a shared set of amenities and a shared base price.

## Typical campground site types

| Site Type | Hookups | Notes |
|-----------|---------|-------|
| Back-in 30A | Water, 30A, Sewer | Standard RV |
| Back-in 50A | Water, 50A, Sewer | Larger rigs |
| Pull-thru 50A | Water, 50A, Sewer | Big rigs, easy in/out |
| Premium Waterfront | 50A, Full | Priced higher |
| Tent | None or Water only | Non-motorized |
| Cabin | N/A | Rented as accommodation |

## Why site types matter

- Rates are set per site type (see the **Rates** article).
- The booking engine sells by site type first, then optionally by specific site.
- Availability and yield reports are grouped by site type.

## Where to configure

Settings → Site Types.

## Fast path

Use the **Onboarding Agent, Step 4**. Tell it the mix of sites you have and it will create the site type records with hookups and default sort order.`,
      }),
      A({
        id: 'sites-and-map',
        title: 'Sites & Map',
        description: 'Bulk-create sites and lay them out on the visual campground map.',
        category: 'foundational-setup',
        keywords: ['sites', 'map', 'bulk', 'campground map', 'site build'],
        content: `# Sites & Map

Once site types exist, you create the individual **sites** (A1, A2, B7, Cabin-3, etc.).

## Bulk create

From the Onboarding Agent (Step 5) or Settings → Sites you can give a range spec and a site type:

- "A1–A20 as Back-in 30A"
- "B1–B15 as Pull-thru 50A"
- "Cabin-1 to Cabin-6 as Cabin"

The system creates one row per site with the given site type.

## Site limits

Your subscription includes a site count cap. Attempts to exceed the cap surface a friendly error; contact Trailblazer support to raise it.

## Custom attributes

Each property can define up to five custom attributes per site (e.g. "Shade level", "Fire ring", "Pet-friendly"). These appear on the site card, the booking engine, and can drive search filters.

## The Map

**Map Editor** lets you drag-drop sites onto an uploaded satellite image or diagram. The **Map** page renders the finished layout with color-coded status per site (available, occupied, dirty, inspection, out of order).

## Fast path

Use the **Onboarding Agent, Step 5**, then open **Map Editor** to visually place the sites.`,
      }),
      A({
        id: 'rates',
        title: 'Rates — Daily, Weekly, Monthly, Packages',
        description: 'Build base rates, derived rates, seasons, packages, and length-of-stay discounts.',
        category: 'foundational-setup',
        keywords: ['rates', 'daily', 'weekly', 'monthly', 'seasons', 'packages', 'los discount'],
        content: `# Rates

Rates control what a guest pays for a given site type on a given date.

## Rate types

- **Daily** — nightly rate, most common.
- **Weekly** — 7-night flat rate; overrides nightly when stay length ≥ 7.
- **Monthly** — 28/30-day flat rate; overrides when stay length ≥ configured threshold.
- **Package** — bundles nights + add-ons (e.g. "Fall Foliage Weekend: 2 nights + firewood + welcome basket").

## Base vs. derived

- **Base rate** stands on its own.
- **Derived rate** (e.g. AAA, Government, Senior) is defined as a percent or fixed adjustment off a base rate — change the base and derived rates follow.

## Seasons

Inside a rate plan you can add seasons (e.g. Summer Peak, Winter Off-Peak) with a multiplier or a fixed adjustment. Non-overlapping only.

## Site-type pricing

Every rate plan has a **price per site type**. You can also add a per-site-type adjustment on top.

## LOS discounts and dynamic rules

- **LOS discount rules**: e.g. "10% off for 7+ nights".
- **Rate rules**: JSON conditions like weekend premium or booking-window discounts.

## Revenue account

Every rate is tied to a **Revenue Account** on the CoA. That's how nightly postings hit the GL.

## Fast path

Use the **Onboarding Agent, Step 6**. It will build daily / weekly / monthly base rates, seasons, and one or two starter packages.`,
      }),
      A({
        id: 'reservation-settings',
        title: 'Reservation Settings',
        description: 'Deposit policies, guarantees, source of business, and cancellation rules.',
        category: 'foundational-setup',
        keywords: ['reservation settings', 'deposit', 'guarantee', 'source of business', 'cancellation'],
        content: `# Reservation Settings

## Deposit policies

Configure per-property or per-rate:

- **None** — pay at arrival.
- **First night** — most common.
- **Full stay** — required for peak dates or long stays.
- **Percentage** — e.g. 25% at booking, balance on arrival.

## Guarantee options

Every reservation needs a guarantee. Typical options:

- Credit Card Guarantee
- Advance Deposit
- Company Direct Bill (City Ledger)
- Travel Agent Voucher

**Card guarantee** requires a payment card be attached to the reservation. This is enforced at booking time; PCI compliance (Adyen tokenization) is handled automatically.

## Source of business

Track where each reservation came from (Direct, Expedia, Booking.com, Google, Repeat Guest, Referral). Feeds the marketing reports and drives the "OTA → Direct" CRM campaign.

## Cancellation windows

Set how many days before arrival a cancellation avoids forfeiting the deposit. Affects the mandatory workflow that runs when a reservation is cancelled after the window.

## Where to configure

Settings → Reservations.

## Fast path

**Onboarding Agent, Step 7**.`,
      }),
      A({
        id: 'booking-engine',
        title: 'Booking Engine',
        description: 'Configure and launch the public direct-booking website.',
        category: 'foundational-setup',
        keywords: ['booking engine', 'direct booking', 'public site', 'widget'],
        content: `# Booking Engine

Trailblazer includes a hosted, branded booking engine your guests can book on directly — no OTA commission.

## What it does

- Searches availability by dates + party size.
- Shows a photo gallery, amenities, and prices for each site type.
- Optionally lets the guest pick a specific site on your live map.
- Captures deposit via Adyen and creates the reservation.
- Sends the Confirmation Letter automatically.

## Configuration

Settings → Booking Engine:

- **Public slug** — the URL becomes \`/b/<slug>\`.
- **Brand** — logo, colors, fonts, hero image (auto-synced from your property brand).
- **Gallery** — upload the assets guests will see per site type.
- **Payment gateway** — Adyen (see Payments section).
- **Terms & policies** — shown on the checkout step.
- **Custom CSS assistant** — the AI can tailor the look to match your existing website.

## Embedding

You can also embed the widget on an existing website: copy the snippet from Settings → Booking Engine → Embed.

## Fast path

**Onboarding Agent, Step 8** enables the engine, generates a public slug, syncs your brand, and seeds gallery placeholders.`,
      }),
      A({
        id: 'crm-setup',
        title: 'CRM — Registration Card, Confirmation Letter, First Campaign',
        description: 'Set up the guest communications that make you look professional and win back direct bookings.',
        category: 'foundational-setup',
        keywords: ['crm', 'registration card', 'confirmation letter', 'campaign', 'ota', 'direct booking'],
        content: `# CRM Setup

## Registration Card

Used at check-in. The card can be:

- **Printed** — guest signs with a pen.
- **Signed on screen** — with a finger on a tablet or touchscreen PC.
- **Emailed** — for contactless self-check-in.

Design it once in CRM → Templates. Fields autofill from the reservation and guest profile.

## Confirmation Letter

Auto-sent when a reservation is created (both from the booking engine and from the front desk). Also available as a manual Send at any stage in the reservation lifecycle.

Both templates support Email and SMS variants.

## The "OTA → Direct" starter campaign

Every booking captured via Expedia or Booking.com costs you 15–25% in commission. Trailblazer ships a starter campaign that:

1. Segments guests whose **source of business** is Expedia or Booking.com.
2. Sends a personalized "Book direct next time and save" message.
3. Includes a promo code good for a discount only when booking through your booking engine.
4. Tracks conversions via the source-of-business field on the resulting reservation.

## Fast path

**Onboarding Agent, Step 9** creates a Registration Card template, a Confirmation Letter template, and the OTA → Direct campaign (email + SMS variants).`,
      }),
      A({
        id: 'pos-setup',
        title: 'Point of Sale (POS) — Optional',
        description: 'Set up the camp store or F&B outlet, including CSV import for items.',
        category: 'foundational-setup',
        keywords: ['pos', 'point of sale', 'store', 'items', 'import'],
        content: `# POS Setup

If you run a camp store, snack bar, or restaurant, POS lets you ring up sales and — for in-park guests — post the charge directly to their folio.

## Structure

- **Outlets** — physical locations (e.g. "Camp Store", "Snack Bar").
- **Categories** — e.g. "Firewood", "Snacks", "Beverages", "Ice".
- **Items** — SKU, name, price, revenue account, tax, optional variants (size, flavor).

## Bulk import

Settings → POS → Import lets you upload a CSV of items. The importer maps CSV columns to the item fields and validates before inserting.

## Charge to room

The POS Terminal has a "Bill to Room" button that looks up an in-park guest by name or site and posts the sale as a folio charge (revenue + tax lines) instead of taking payment.

## API

If you use an external POS, our POS Integration API accepts room lookups and folio charge postings — see the **Integrations** article.

## Fast path

**Onboarding Agent, Step 10** creates outlets, categories, and a starter item set. Skip it if POS doesn't apply to you.`,
      }),
    ],
  },

  {
    id: 'daily-operations',
    name: 'Daily Operations',
    icon: 'Calendar',
    articles: [
      A({
        id: 'dashboard-overview',
        title: 'Dashboard Overview',
        description: 'What every card on the dashboard means and where it links to.',
        category: 'daily-operations',
        keywords: ['dashboard', 'arrivals', 'departures', 'in park', 'occupancy'],
        content: `# Dashboard Overview

The dashboard is scoped to today's **audit date** (see the Night Audit article — this is not always today's calendar date).

## Cards

- **Arrivals** — reservations expected in today. Click a row to open the reservation.
- **In Park Guests** — currently checked-in stays. Rows link straight to the reservation with the folio expanded.
- **Departures** — stays checking out today. Rows link to the reservation with the folio expanded so you can settle balances.
- **Occupancy** — sites occupied / sellable sites for today.
- **Revenue** — posted revenue for the audit day.
- **Folio balance** — total outstanding on in-park folios.

## Tips

- Every list card scrolls internally — designed for hundreds of entries.
- Row density is tuned so a typical park can see 15+ rows without scrolling.
- The "Departures with balance" number in the header tells you how much money must be collected before Day-End Close.`,
      }),
      A({
        id: 'creating-a-reservation',
        title: 'Creating a Reservation',
        description: 'Front-desk booking flow from search to confirmation.',
        category: 'daily-operations',
        keywords: ['reservation', 'booking', 'front desk', 'new booking'],
        content: `# Creating a Reservation

## From the front desk

1. Click **New Reservation** on the dashboard or Reservations page.
2. Enter dates, party size, and (optional) site type filter.
3. Pick a site — or leave it unassigned to auto-assign at check-in.
4. Choose a rate. The quote panel updates in real time (base + seasons + LOS + add-ons + tax).
5. Attach a guest profile (search first — never duplicate) or create a new one.
6. Select a **Source of Business** and **Guarantee**.
7. If Card Guarantee, attach a payment card via the Adyen capture widget.
8. Optionally take a deposit now.
9. Save → the reservation is created with a unique confirmation number and the Confirmation Letter is queued.

## From the map or booking chart

Click an empty cell on the Booking Chart, or an available site on the Map. Dates/site are pre-filled; the rest of the flow is identical.

## Editing

Open the reservation and edit any field. Every change is written to the **Change Journal** for audit.`,
      }),
      A({
        id: 'check-in',
        title: 'Check-In & Registration',
        description: 'Physical or digital registration card capture, signature, and assigning a site.',
        category: 'daily-operations',
        keywords: ['check in', 'registration card', 'signature', 'arrival'],
        content: `# Check-In

## Workflow

1. Guest arrives. Search by name, confirmation, or license plate.
2. Verify or update the guest profile (address, phone, vehicle).
3. **Registration Card**:
   - **Print** for a pen signature, or
   - **Show on screen** and capture the signature with a finger on a tablet, or
   - **Email** for the guest to sign later.
4. Confirm the site assignment (or let auto-assign pick).
5. Take any remaining deposit or full prepayment.
6. Click **Check In**. Reservation status becomes IN_HOUSE. Site status becomes Occupied.

## Constraints

- A site marked **Dirty** cannot be checked into. Send it to Turnover first.
- A **Card Guarantee** reservation cannot be checked in without a valid attached card.`,
      }),
      A({
        id: 'in-park-guests',
        title: 'Managing In-Park Guests',
        description: 'Everything you can do while the guest is on site.',
        category: 'daily-operations',
        keywords: ['in park guests', 'folio', 'charges', 'extend stay'],
        content: `# In-Park Guests

The **In Park Guests** page shows every reservation that's currently in-house or that checked out today. Row click opens the reservation with the folio expanded inline — no navigation needed.

## Filters and search

- **Arrivals / In-House / Departures** tabs, all scoped to the property's **audit date** (never the calendar date).
- Search by guest name, confirmation number, or site.
- Group filter to isolate a Group Block master and its rooming list.

## Common tasks

- **Add charges** — folio posting: pick an account, enter amount, save. The account dropdown blocks default/hallucinated accounts and only shows revenue accounts you're allowed to post to.
- **Take a payment** — the Payment Dropdown auto-matches accepted cards to their clearing account and only lists asset/liability accounts.
- **Move site** — change the site on the reservation. History is preserved in the Change Journal.
- **Extend stay** — change the checkout date; the system re-quotes and posts additional nightly charges.
- **Add a rental** — attach a golf cart, bike, kayak, or other rental. Availability is checked live against inventory on hand (see the Rentals article).
- **Message the guest** — jump straight to the Guest Messaging thread for this reservation.
- **Transfer balance** — move a balance to another folio or the City Ledger (creates an AR invoice automatically).
- **Folio summary vs detail** — toggle between the itemized detail view and the grouped summary view.
- **Print / email folio** at any point.

## Same-day checkout

If a guest checks out and you need to reverse or adjust, the folio remains editable for the rest of the audit day. After Day-End Close, adjustments must go through the accounting adjustment workflow.`,
      }),
      A({
        id: 'checkout',
        title: 'Checkout & Balance Handling',
        description: 'Settle the folio, handle deposits, and close the stay.',
        category: 'daily-operations',
        keywords: ['checkout', 'balance', 'settlement', 'departure'],
        content: `# Checkout

## Standard flow

1. Open the reservation from the Departures list or In-Park Guests.
2. The folio is fetched fresh from the database at open (not cached) so the balance is always current.
3. Settle any outstanding balance:
   - Card on file → single click.
   - New card → Adyen capture inline.
   - Cash / other → pick the payment account.
   - Direct bill → Transfer to City Ledger (creates an AR invoice).
4. Click **Check Out**. Status becomes CHECKED_OUT, site status becomes Inspection.

## Cancellation with deposit

If a reservation is cancelled after the deposit was captured, the mandatory workflow requires you to:

- Refund the deposit, or
- Convert it to a cancellation fee (posted to a designated adjustment account), or
- Forfeit it as revenue.

The system will not let the reservation close without one of those actions.`,
      }),
      A({
        id: 'night-audit',
        title: 'Night Audit & Day-End Close',
        description: 'The nightly roll-over that posts room revenue, taxes, and moves the business date forward.',
        category: 'daily-operations',
        keywords: ['night audit', 'day end close', 'audit date', 'closing'],
        content: `# Night Audit & Day-End Close

The night audit closes the business day. It's the single most important operational routine.

## What it does

1. Posts room revenue and tax for every in-house guest for the night.
2. Runs nightly-charge add-ons (e.g. pet fee per night).
3. Reconciles the guest ledger, city ledger, and advance-deposit ledger.
4. Produces a Trial Balance.
5. Advances the **Audit Date** to the next business day.

## Audit Date vs Calendar Date

Every operational date in the system is the **audit date**, not the calendar date. If you haven't run Day-End Close yet at 11pm, the audit date is still today; at 2am, it's still today. This prevents late-night bookings from being counted on the wrong day.

## Advancing to a future date

If you try to advance the audit date past tomorrow, you'll get a warning — this is almost always a mistake.

## Where

Day-End Close page. Manager or Admin can run it manually. An auto-close job can be enabled per property (Night Audit Settings).`,
      }),
      A({
        id: 'online-check-in',
        title: 'Online Guest Check-In',
        description: 'Mobile self-service check-in from the booking site, with card auth, signature, and site-hold triage.',
        category: 'daily-operations',
        keywords: ['online check-in', 'mobile check-in', 'self service', 'check in hold', 'signature', 'registration card', 'adyen', 'my trip'],
        content: `# Online Guest Check-In

Guests can complete a fully remote arrival from any phone on your booking engine — no line at the front desk.

## Guest experience

1. From your booking site header, guests tap **My trip** and sign in with:
   - Confirmation number
   - Last name
   - ZIP / postal code

   All three must match. After 5 failed attempts in 15 minutes the login is rate-limited for that confirmation number.

2. On the **My trip** page they see upcoming reservations. On arrival day a prominent **Check in online** button appears.

3. The wizard walks them through:
   - Review & correct guest details (address, phone, party size)
   - Read the on-screen **Registration Card**
   - **Card on file**: Adyen Drop-in authorizes an incidentals hold (raw card data never touches Trailblazer — PCI SAQ A)
   - **Signature**: touch/stylus signature captured and stored privately
   - **Confirm**

## Check-In Hold

If the assigned site isn't ready when a guest completes check-in — either it's flagged for **inspection/unavailable** in Maintenance, or no site has been assigned yet — the reservation moves to a new **CHECK_IN_HOLD** status.

A guest on hold:
- Has a **guest folio** open and can charge to their room from POS outlets
- Can use park facilities (pool, wifi, laundry) that are gated by "in-park" status
- Does NOT yet have a site assigned to walk to

The hold reason is stored on the reservation (e.g. \`no_site_assigned\`, \`site_inspection\`).

## Staff triage

- The **Dashboard** shows a **Mobile check-ins need triage** card whenever any reservation is in \`CHECK_IN_HOLD\` or flagged \`needs_staff_review\`. Each row has:
  - **Open** — jumps to the reservation in Check-In
  - **Release to site** — appears when the site is available; flips the status to CHECKED_IN
- The **Check-In** page lists hold reservations alongside CONFIRMED arrivals. Selecting a hold shows a **Release to site** button and a banner explaining the hold reason.
- The **In-Park Guests** list includes hold guests with an amber Hold badge.

## Front desk equivalent

The same online wizard also runs at the front desk when staff hand a tablet to a guest — nothing to install. Any check-in path (online or front desk) that meets a not-ready site follows the same Hold rules.

## POS + Hold

The POS integration accepts room lookups against both CHECKED_IN and CHECK_IN_HOLD statuses, so bill-to-room works the moment the guest completes online check-in even before their site is released.

## Security notes

- Guest sessions are short-lived (2 hours) tokens stored in the browser tab only — closing the tab signs the guest out.
- Card capture is Adyen Drop-in — PAN and CVV never enter the app.
- Signatures are stored in a private storage bucket and only surfaced to the property via signed URLs.
- Rate limiting throttles brute-force attempts on the login form.`,
      }),
    ],
  },


  {
    id: 'accounting',
    name: 'Accounting',
    icon: 'Calculator',
    articles: [
      A({
        id: 'ledgers',
        title: 'The Three Ledgers',
        description: 'Guest Ledger, City Ledger, and Advance Deposit Ledger — what belongs where.',
        category: 'accounting',
        keywords: ['guest ledger', 'city ledger', 'advance deposit', 'ledger'],
        content: `# The Three Ledgers

Trailblazer uses double-entry accounting with three operational sub-ledgers:

## Guest Ledger

The live folio of every in-house guest. Balance = charges − payments while the guest is on property. Zeroes out on checkout.

## City Ledger

**Accounts Receivable**. Balances owed by third parties (companies, OTAs, tour operators) after the guest has left. Supports aging analysis, statement runs, and payment application against specific invoices.

## Advance Deposit Ledger

Deposits taken before arrival are a **liability**, not revenue, until the guest checks in. This ledger tracks the balance. Cancelled / no-show deposits must be resolved through the mandatory workflow (see Checkout article).`,
      }),
      A({
        id: 'trial-balance',
        title: 'Trial Balance & Journal Entries',
        description: 'Reconcile the books after every night audit.',
        category: 'accounting',
        keywords: ['trial balance', 'journal', 'reconcile', 'gl'],
        content: `# Trial Balance

Produced automatically at Night Audit. Lists every GL account with its debit and credit totals for the audit day and running balances.

Trial Balance must **balance to zero**. If it doesn't, the night audit surfaces the discrepancy and prevents close until resolved.

## Journal Entries

Manual journal entries (Accounting → Journal Entries) let you correct entries that need to hit specific accounts outside the automated posting paths. Every JE must balance and captures who posted it and why.`,
      }),
      A({
        id: 'city-ledger-workflow',
        title: 'City Ledger Workflow',
        description: 'Invoicing companies, applying payments, aging, and statements.',
        category: 'accounting',
        keywords: ['city ledger', 'invoice', 'ar', 'aging', 'statement'],
        content: `# City Ledger Workflow

## Creating an invoice

Invoices are created automatically when you **Transfer a folio balance** to the City Ledger at checkout for a company-billed guest. You can also create invoices manually.

## Applying a payment

Payments applied on the City Ledger must be allocated against specific invoices (FIFO by default, but overridable per invoice).

## Aging analysis

City Ledger → Aging shows 0–30 / 31–60 / 61–90 / 90+ buckets per account, plus a chart.

## Statements

Send statements as PDF via email — one account at a time or as a batch run.`,
      }),
    ],
  },

  {
    id: 'payments-pci',
    name: 'Payments & PCI',
    icon: 'DollarSign',
    articles: [
      A({
        id: 'adyen-payments',
        title: 'Payments (Adyen) & PCI',
        description: 'How card capture, authorizations, and PCI compliance work.',
        category: 'payments-pci',
        keywords: ['payments', 'adyen', 'pci', 'card', 'authorization', 'saq-a'],
        content: `# Payments & PCI

Trailblazer uses **Adyen Drop-in** for all card capture. This gives us **PCI SAQ A** scope — the lightest level — because raw PAN and CVV never touch our servers or database.

## What's stored

Only Adyen's **network token** for the card, plus display metadata (last-4, brand, cardholder name, expiry MM/YY). Everything else lives at Adyen.

## Multi-card

A reservation can hold multiple cards (guarantee + incidentals + accompanying guest). Each card has its own sequence number and can be used independently.

## Authorizations

For hold / pre-auth flows, we call Adyen Auth then Capture (or Reverse). The AuthorizationManager on the reservation shows every open authorization.

## Retention

The PCI retention sweep (nightly cron) purges expired authorizations, aged transactions, and cardholder metadata after 24 months. This is required for SAQ A.

## MFA

Any user viewing bulk financial exports must have MFA enabled.`,
      }),
    ],
  },

  {
    id: 'group-blocks',
    name: 'Group Blocks',
    icon: 'Users',
    articles: [
      A({
        id: 'group-blocks-overview',
        title: 'Group Blocks Overview',
        description: 'Hold multiple sites for tours, rallies, weddings, and events.',
        category: 'group-blocks',
        keywords: ['group blocks', 'block', 'rally', 'tour', 'wedding'],
        content: `# Group Blocks

A **Group Block** holds multiple sites for the same date range under one master account. Guests can book against the block by picking up a slot, or the group organizer can pre-assign.

## Key concepts

- **Block dates** — arrival + departure for the block.
- **Allocations** — how many of each site type are being held.
- **Cut-off date** — after this, unpicked-up sites are released.
- **Master account** — deposit and shared charges live here.
- **Group rate** — often a special negotiated rate active only for the block.

## Payment cards

You can attach one or more group-level cards for master charges. Individual guests still get their own folios for incidentals unless configured "all charges to master".`,
      }),
    ],
  },

  {
    id: 'crm-marketing',
    name: 'CRM & Marketing',
    icon: 'Mail',
    articles: [
      A({
        id: 'campaigns',
        title: 'Campaigns (Email + SMS)',
        description: 'Segment guests, design a message, schedule, and measure conversion.',
        category: 'crm-marketing',
        keywords: ['campaign', 'email', 'sms', 'marketing', 'segment'],
        content: `# Campaigns

## Segments

Filter guests by source of business, last-stay date, LTV, birthday/anniversary month, tags, and more.

## Channels

Every campaign supports **Email** and **SMS** variants. Both are sent through the platform's transactional infrastructure; no external provider setup is required.

## Templating

Rich-text editor with merge tags (\`{{first_name}}\`, \`{{last_stay_date}}\`, \`{{promo_code}}\`). Preview against a real guest before send.

## Scheduling

Send now, schedule for later, or run recurring (e.g. every quarter to lapsed guests).

## Measurement

Each send is tracked in **Campaign Sends**. Conversions are measured against subsequent reservations whose source of business matches the campaign.`,
      }),
      A({
        id: 'ota-to-direct-campaign',
        title: 'The OTA → Direct Playbook',
        description: 'A standing campaign to convert Expedia and Booking.com guests into direct-book repeat customers.',
        category: 'crm-marketing',
        keywords: ['ota', 'expedia', 'booking.com', 'direct booking', 'commission'],
        content: `# OTA → Direct Playbook

OTAs charge 15–25% commission. Every repeat guest you convert to a direct booking is pure margin.

## The starter campaign

Shipped by the Onboarding Agent, Step 9:

1. **Segment**: guests whose most recent stay's source of business is Expedia or Booking.com.
2. **Trigger**: 3 days after checkout.
3. **Message**: "Thanks for staying with us — book direct next time and save 10%. Use code DIRECT10 at [booking URL]."
4. **Channels**: Email + SMS.
5. **Promo code**: DIRECT10, valid only on the booking engine.

## What to measure

- Open / click rates on the campaign.
- Reservations using promo code DIRECT10.
- Change in the "OTA" share of your source-of-business mix over 6 months.`,
      }),
    ],
  },

  {
    id: 'integrations',
    name: 'Integrations',
    icon: 'Settings',
    articles: [
      A({
        id: 'quickbooks',
        title: 'QuickBooks Online Sync',
        description: 'Connect Trailblazer to QuickBooks Online and push GL activity automatically or on demand.',
        category: 'integrations',
        keywords: ['quickbooks', 'qbo', 'qb', 'gl sync', 'export', 'accounting integration', 'intuit'],
        content: `# QuickBooks Online Sync

The QuickBooks integration is managed from **Accounting → Integrations** (the tab to the right of Journal). Additional accounting interfaces will appear on the same tab as they are released.

## Connect

1. Go to **Accounting → Integrations**.
2. Click **Connect to QuickBooks**. You'll be redirected to Intuit's OAuth screen.
3. Approve access to your QuickBooks Online company. You return to Trailblazer with a connected status and your company name displayed.

Sandbox vs Production is controlled by the \`QUICKBOOKS_ENVIRONMENT\` backend setting.

## Account mapping

Trailblazer posts journal entries by GL account. Map each Trailblazer account to a QuickBooks account either by:

- Setting the **External Account Code** on each Chart of Accounts entry to the matching QuickBooks account, or
- Using the manual mapping table on the Integrations tab.

Unmapped accounts are skipped and logged as a warning on the sync.

## Sync frequency

Set on the Integrations tab:

- **Manual only** — nothing runs automatically; use **Sync Now**.
- **On Day-End Close** — a journal entry is pushed the moment night audit finalizes each business day.
- **Daily** — a scheduled push at your local property time.
- **Weekly** — a scheduled push once per week.

**Sync Now** processes every pending day-end close that has not yet been sent, oldest first.

## What gets sent

One journal entry per business day, summarized by GL account. Debits and credits mirror the Trailblazer trial balance for that audit date, so QuickBooks stays in lock-step with the property books.

## Sync activity log

The Integrations tab shows every push with timestamp, business date, status, and — on failure — the exact Intuit error message. Fix the underlying issue (usually a missing account mapping) and click **Sync Now** to retry.`,
      }),
      A({
        id: 'pos-api',
        title: 'POS Integration API',
        description: 'Let an external POS look up guests and post charges to their folio.',
        category: 'integrations',
        keywords: ['pos api', 'integration', 'external pos', 'api key'],
        content: `# POS Integration API

## Endpoints

- \`GET /pos-api/rooms/:query\` — look up in-park guests by site number or name. Returns reservation ID, guest name, site, folio balance.
- \`POST /pos-api/charge\` — post a charge to a folio. Body: reservation ID, revenue account, amount, description, optional item lines.

## Auth

Property-scoped API keys created in Settings → API Keys. Send as \`Authorization: Bearer <key>\`.

## Errors

Standard HTTP: 401 unauthorized, 404 reservation not found, 422 validation, 429 rate-limited.

See \`docs/POS_INTEGRATION_API.md\` for the full reference.`,
      }),
      A({
        id: 'ota-api',
        title: 'OTA / Channel Manager API',
        description: 'Push availability and receive reservations from external channels.',
        category: 'integrations',
        keywords: ['ota', 'channel manager', 'availability', 'inventory'],
        content: `# OTA / Channel Manager API

Trailblazer exposes an OTA-compatible endpoint for availability sync and reservation delivery. Typical use is behind a channel manager (SiteMinder, Cloudbeds, Nightsbridge, etc.).

## What's synced

- Availability by site type by date.
- Rates by site type by date.
- Restrictions (min LOS, closed-to-arrival, closed-to-departure).

## Reservations from OTAs

Land in Trailblazer with source of business set to the OTA. They flow into the same reservation table, so all downstream reporting (and the "OTA → Direct" campaign) works automatically.`,
      }),
    ],
  },

  {
    id: 'work-orders',
    name: 'Work Orders',
    icon: 'Wrench',
    articles: [
      A({
        id: 'work-orders-overview',
        title: 'Work Orders — Full Reference',
        description: 'Track issues around the park, assign to staff, capture costs, and report on hotspots.',
        category: 'work-orders',
        keywords: ['work orders', 'maintenance', 'wo', 'repairs', 'issues', 'tickets', 'site turnover'],
        content: `# Work Orders

Work Orders are a sub-feature of **Maintenance**. Use them to track any issue around the park — a leaking spigot, a downed branch on a site, a broken breaker at the pedestal, a torn cabin screen. They can be assigned to any user with property access, tracked to completion, and rolled into reporting.

## Concepts

### Numbering
Every work order gets an auto-generated number in the format \`WO-XXXXXX\` (e.g. \`WO-000142\`). The sequence is per-property and never reused. Reference this number in radio calls, guest complaints, and hand-offs.

### Categories
Every WO belongs to one of five categories:

| Category | Typical work |
|----------|--------------|
| **Plumbing** | Leaks, low pressure, sewer, water hookups |
| **Electrical** | Pedestal breakers, lighting, wiring, generators |
| **Grounds / Landscaping** | Mowing issues, tree limbs, debris, landscaping |
| **Structural / Facilities** | Buildings, restrooms, pool house, cabin repairs |
| **Other: Site Specific** | Anything else tied to a specific site |

### Status
- **Open** — reported, not yet started
- **In Progress** — assignee is actively working it
- **On Hold** — blocked (waiting on parts, weather, permits)
- **Completed** — work done and verified
- **Cancelled** — no longer needed / duplicate

### Priority
Low, Medium, High, Urgent. Urgent WOs are surfaced on the dashboard and default sort order.

### Location: site or free-text
A WO can be attached to a specific **Site** (picks from your sites list) OR to a free-text **Location** (e.g. "Bathhouse B", "Front gate", "Main road pothole near loop C"). Site-scoped WOs show up on the Maintenance card for that site.

## Creating a work order

**Maintenance → Report Issue** (or the "+" on the Work Orders dashboard). Fields:

- **Title** *(required)* — short, scannable ("Site A12 pedestal 50A tripping").
- **Category** *(required)* — one of the five above.
- **Priority** — defaults Medium.
- **Site** — pick from active sites; leave blank for park-wide.
- **Location text** — required when no site is picked.
- **Description** — long-form details, symptoms, guest quotes.
- **Assign to** — any user with access to this property. Leave unassigned and a manager can triage.
- **Photos** — attach one or more images (stored in the private \`work-order-photos\` bucket; loaded via short-lived signed URLs).

On save, the WO is created with status **Open**, tagged with the current property, the current user (reporter), and the current audit date.

## Assigning and reassigning

Any user with property access can be assigned to a WO. Reassignment is logged in the activity feed. The assignee sees their WOs first when they open the dashboard.

## Cost tracking

Under a WO's **Costs** tab you can add line items in four categories:

- **Parts**
- **Labor**
- **External Vendor**
- **Other**

Each line has description, quantity, unit cost, and an auto-computed total (\`qty × unit_cost\`). The WO's grand total is the sum across categories. Costs feed the "Cost by Category" and "Site Hotspots" reports.

## Photo attachments

- Stored in the private \`work-order-photos\` storage bucket, folder-scoped by property.
- Loaded in the UI as **signed URLs** (short-lived); no photo is ever publicly readable.
- Any user with property access can upload/view/delete photos on WOs in that property.

## Comments & activity log

The **Activity** tab captures:

- Free-text comments from any user with access.
- Status transitions (with actor + timestamp).
- Assignment changes.
- Cost line additions.

This becomes the audit trail if a guest disputes a repair or a claim needs documentation.

## Dashboard

**Maintenance → Work Orders → Dashboard tab** shows:

- **Status tiles** — Open, In Progress, On Hold, Completed (last 30 days), Cancelled.
- **Category frequency (last 90 days)** — bar chart of most common issue types, so you can spot patterns ("Plumbing is 40% of our WOs — time to inspect the main").
- **Aging buckets** — Open WOs by age: <24h, 1–3d, 3–7d, 7–14d, >14d. Anything sitting in the >7d bucket is a red flag.
- **Urgent open** — surface any Urgent-priority open WOs.

## Reports

**Work Orders → Reports tab**:

- **Cost by Category** — spend across Parts / Labor / Vendor / Other over a chosen date range.
- **Site Hotspots** — sites with the most WOs, ordered by count and total cost. Use to identify sites that need capital investment vs. constant repair.
- **Assignee Performance** — WOs closed per assignee, average time-to-close, and open backlog.

Filter every report by category, priority, date range, and site.

## Maintenance integration

- Site cards and rows show a **"Report Issue"** button that pre-fills the site ID when opening a new WO.
- Site cards display a small **chip with the count of open WOs** for that site.
- Opening a WO does **not** change the site's turnover status (Clean / Dirty / Inspection / Out of Order). If the site should be marked Out of Order, that's a separate action on the site.

## Permissions & RLS

- All work order tables (\`work_orders\`, \`work_order_cost_items\`, \`work_order_attachments\`, \`work_order_comments\`) are scoped by \`property_id\`.
- RLS policies restrict every read/write to users who pass \`user_has_property_access(property_id)\` — the same gate as reservations, sites, and folios.
- Storage bucket \`work-order-photos\` is private with folder-scoped policies matching the same access rules.

## Troubleshooting

**"I can't see WOs from my other property."**
Switch properties in the header — WOs are strictly per-property.

**"My WO disappeared from Open."**
It was probably moved to Completed or Cancelled. Check the "All" tab and the activity log for the status change.

**"Photos won't load."**
Signed URLs expire after a short window. Reload the page to regenerate them.

**"I want a Category we don't have."**
The five categories are fixed for reporting consistency. Use "Other: Site Specific" and put the sub-type in the title.

## FAQ

**Can a WO span multiple sites?**
No — one WO, one location. Create a WO per site and reference the shared parent in the description if needed.

**Can guests create work orders?**
Not directly. Staff create WOs; the description can quote the guest.

**Does TrailGuide know about work orders?**
Yes — ask TrailGuide "show open work orders in plumbing" or "create a work order for site A12 electrical". See the **TrailGuide AI Agent** article.`,
      }),
    ],
  },

  {
    id: 'trailguide',
    name: 'TrailGuide AI Agent',
    icon: 'Compass',
    articles: [
      A({
        id: 'trailguide-overview',
        title: 'TrailGuide AI Agent — Full Reference',
        description: 'The all-encompassing AI agent for reporting, lookups, actions, and onboarding.',
        category: 'trailguide',
        keywords: ['trailguide', 'ai', 'agent', 'assistant', 'chat', 'voice', 'onboarding'],
        content: `# TrailGuide AI Agent

**TrailGuide** is the AI agent built into Trailblazer. It answers questions, runs reports, looks up guests and reservations, takes safe actions (with your approval), and guides you through onboarding — all from a single conversational surface.

## Two modes

TrailGuide has **one identity, two modes**. The mode toggle sits at the top of the panel.

### Operate mode (default)
Everyday running of the park. Use it to:
- Ask for reports and KPIs
- Look up guests, reservations, sites, work orders
- Perform actions: check in / check out, update site status, update work order status, open a work order
- Get how-to answers from the Knowledge Base

Look & feel: **emerald primary accent**, compass icon, tagline *"Ask, report, act."*

### Set up mode
Configuring a new property (or filling gaps in an existing one). Use it to:
- Walk the 10 onboarding steps
- Propose and create Chart of Accounts, taxes, site types, sites, rates, guarantee options, sources of business, booking engine, campaigns, POS outlet, and custom roles

Look & feel: **amber accent**, flag icon, tagline *"Let's configure your park."* On the dedicated **Setup Guide** page the mode toggle is hidden and a per-step checklist sits alongside the chat.

## Launching TrailGuide

- **Floating compass button** (bottom-right, every page after login) — opens the side-sheet in **Operate** mode. Use the toggle to switch to **Set up**.
- **Setup Guide page** — the same TrailGuide, locked to **Set up** mode, with the onboarding checklist beside it.
- **Keyboard** — the panel autofocuses the textarea on open; Enter sends, Shift-Enter adds a newline.

## Text & voice input

Type into the composer, or click the **microphone** to record a voice note. Voice is transcribed by the Lovable AI Gateway (\`openai/gpt-4o-transcribe\`) and appended to the input box — you still hit Send. Audio is streamed to the transcription endpoint and never stored.

Mic states: **idle** (mic icon), **recording** (red square, click to stop), **transcribing** (spinner).

## Action approval model

TrailGuide is deliberately safe:

- **Read-only tools run automatically** inside the same turn — the model sees the results and folds them into the reply. You never approve a read.
- **Writes are proposed, not executed.** The model calls a write tool, TrailGuide surfaces a **"Confirm to run"** card with a plain-English summary and full argument details. Nothing happens until you click **Confirm**.
- **Rejecting** an action simply dismisses the card. Ask a follow-up question and TrailGuide will propose a new action.

Every approved action runs against the backend under your JWT, so RLS + property access + role permissions apply exactly as they would if you clicked the button yourself in the UI.

## Operate-mode tool catalog

### Read tools (auto-run)
- **get_property_snapshot** — arrivals, departures, in-house, occupancy %, revenue posted today, open work orders — all for the current **audit date**.
- **search_reservations** — by name, confirmation, or site number (optional status filter).
- **search_guests** — by name, email, or phone.
- **list_work_orders** — filter by status and/or category.
- **get_site_status_overview** — sites grouped by maintenance status.
- **get_financial_summary** — revenue, payments, charges, posting counts over the last N days.
- **search_knowledge_base** — full-text search across every KB article (returns article body).

### Write tools (require Confirm)
- **check_in_reservation** — move a reservation to \`checked_in\`.
- **check_out_reservation** — move a reservation to \`checked_out\`.
- **update_work_order_status** — Open / In Progress / On Hold / Completed / Cancelled.
- **update_site_status** — change a site's maintenance status.
- **create_work_order** — open a new WO with title, category, priority, site or location text.

## Setup-mode tool catalog

Setup mode swaps in the onboarding write tools (still Confirm-to-run):

- **create_accounts** — bulk-create GL accounts on the Chart of Accounts.
- **create_taxes** — sales, occupancy, compound taxes.
- **create_site_types** — Back-in 30A, Pull-thru 50A, Tent, Cabin, etc.
- **bulk_create_sites** — a numbered range (\`A001\`–\`A020\`) of one site type.
- **create_rate** — a base or derived rate plan.
- **create_guarantee_options** — Credit Card, Advance Deposit, City Ledger, etc.
- **create_source_of_business** — Direct, Expedia, Booking.com, Referral, etc.
- **enable_booking_engine** — turn on the public booking site with a slug.
- **create_campaign** — starter email/SMS campaign (draft).
- **create_pos_outlet** — a Point-of-Sale outlet (store, restaurant).
- **create_custom_role** — role scaffolds; permissions granted in the Users page.
- **mark_step_done** — mark the current onboarding step complete.

Setup mode also has all the Operate **read** tools available, so it can look at what's already configured before proposing new writes.

## Conversation model

- **One rolling conversation.** No history is saved. Closing the panel resets state on the next open. Switching modes also resets the transcript so context is clean.
- **Property-scoped.** The current property from the header is passed on every turn. Switching properties starts a fresh conversation for that property.
- **Audit-date aware.** "Today" always means the property's audit date, not the calendar date. Ask "what's today's occupancy?" the day before you run night audit and TrailGuide answers for the audit date, not the wall-clock date.

## Property scoping & RLS

Every read and write goes through your Supabase JWT. That means:

- TrailGuide cannot see or touch data in properties you don't have access to.
- Role-based restrictions in the app apply to TrailGuide actions (a Front Desk user cannot ask TrailGuide to do something a Front Desk user cannot do in the UI).
- Every action is written to the Change Journal with your user as the actor.

## Limits

TrailGuide cannot:

- **Invite users.** For security, user invites happen from the Users page.
- **Handle raw card data.** PCI (SAQ A) requires payment capture through Adyen Drop-in; TrailGuide never accepts PAN/CVV.
- **Cross properties.** Every conversation is scoped to the selected property.
- **Persist history.** Nothing you or TrailGuide say is stored after the session ends.
- **Run destructive bulk updates.** No "delete all X" tools are exposed; do those in the UI where the confirmation is stronger.

## Troubleshooting

**"AI gateway 402" / credits exhausted.**
Your workspace has run out of Lovable AI credits. Add credits in Settings → Plans & Credits and retry.

**"AI gateway 429" / rate limited.**
Too many requests too quickly. Wait a few seconds and retry.

**"Microphone access needed."**
The browser blocked mic access. Allow it in the site permissions and try again.

**Action fails after Confirm.**
TrailGuide surfaces the exact database error. Common causes: missing permission, referenced record not found (e.g. reservation was already checked out), validation error. Fix the input and ask again.

**The action card describes something wrong.**
Click **Cancel**, then correct the ask in a follow-up message ("no, that's the wrong reservation — use confirmation ABC123").

## Tips & example prompts

### Operate mode
- "What's the arrival count for today and how many are unassigned?"
- "Find reservations for Anderson checking in this week."
- "Show open work orders in electrical, urgent priority."
- "Check in confirmation TB-000212 for the Smith family."
- "Mark site A12 out of order — the pedestal is dead."
- "Open a plumbing work order for cabin 3 — guest reports no hot water."
- "How does the OTA → Direct campaign work?"
- "Revenue trend for the last 14 days."

### Setup mode
- "Propose a standard campground Chart of Accounts."
- "Create sales tax at 7.5% additive and lodging tax at 3% compound."
- "Create site types: Back-in 30A, Back-in 50A, Pull-thru 50A, Premium Waterfront, Tent, Cabin."
- "Bulk create sites A001–A020 as Back-in 30A."
- "Turn on the booking engine with slug 'trailblazer-rv'."
- "Create a draft OTA → Direct email campaign."
- "Mark the site_types step complete and move to sites."

## Related

- **Work Orders** — everything TrailGuide can do with work orders is documented in the Work Orders article.
- **AI Onboarding Agent** — legacy article; TrailGuide Setup mode is the current onboarding surface.`,
      }),
    ],
  },

  {
    id: 'security',
    name: 'Security & Access',
    icon: 'FileText',
    articles: [
      A({
        id: 'mfa',
        title: 'Multi-Factor Authentication (MFA)',
        description: 'When MFA is required and how to enroll.',
        category: 'security',
        keywords: ['mfa', '2fa', 'totp', 'authenticator', 'security'],
        content: `# MFA

## When required

MFA (TOTP via any authenticator app) is **required** for:

- Viewing sensitive financial exports (accounting reports, city ledger exports, guest ledger exports).
- Bulk PII exports.
- Admin operations that mutate roles or user access.

## Enrollment

Profile → Security → Enroll MFA. Scan the QR with Google Authenticator, 1Password, Authy, etc. Save the recovery code.

## Losing your device

An Admin can reset MFA for another user. If you're the only Admin, contact Trailblazer support.`,
      }),
      A({
        id: 'change-journal',
        title: 'Change Journal',
        description: 'Every mutation is audited — how to search and use the journal.',
        category: 'security',
        keywords: ['audit', 'change journal', 'log', 'history', 'compliance'],
        content: `# Change Journal

Every change to reservations, folios, rates, accounts, and permissions is written to the Change Journal with:

- Timestamp
- Actor (user)
- Entity + entity ID
- Field-level before / after
- Correlated reservation / property

## Where

Reports → Change Journal. Filter by user, entity, date range, or free text.

## Retention

Retained indefinitely (subject to legal-hold and export requirements).`,
      }),
    ],
  },
  {
    id: 'guest-messaging',
    name: 'Guest Messaging',
    icon: 'MessageSquare',
    articles: [
      A({
        id: 'guest-messaging-overview',
        title: 'Guest Messaging (SMS + Email + AI)',
        description: 'Two-way guest conversations with an optional AI concierge that can propose real actions.',
        category: 'guest-messaging',
        keywords: ['messaging', 'sms', 'twilio', 'email', 'ai concierge', 'chat', 'guest chat'],
        content: `# Guest Messaging

**Guest Messaging** is the two-way conversation surface for pre-arrival, in-stay, and post-stay guest communication. It lives at **Messaging** in the sidebar and is also reachable directly from any reservation.

## Channels

- **SMS** — via Twilio. Configure your Twilio number in **Settings → Guest Messaging**. Inbound messages arrive at the \`messaging-twilio-webhook\` endpoint.
- **Email** — via the same transactional email domain used for confirmations and folios.

Each thread is bound to a reservation (or a guest profile if no active reservation exists) and is scoped to the current property.

## Thread inbox

- Unified inbox across SMS and email with unread badges.
- Filter by status (Open, Waiting on Guest, Closed) and by role visibility (Front Desk, Manager, Admin).
- Full message history is retained; every send is logged with actor + channel + status.

## AI Concierge

Every thread has an **AI Concierge** side panel. It:

1. Reads the guest's message plus the reservation context (arrival, site, add-ons, folio balance, available rentals, KB articles).
2. Proposes a **reply draft**, and optionally an **action** (e.g. reserve a golf cart, add a late-checkout add-on, extend the stay by one night, send a payment link).
3. Never sends or writes anything without staff approval.

### Approval model

- **Draft reply** → click **Send** to send as-is, or edit first.
- **Proposed action** → shows a plain-English "Confirm to run" card. Approving it calls \`messaging-execute-action\` which performs the write under staff credentials so RLS and property scoping apply.
- **Rejecting** dismisses the card; the AI will propose something different on the next turn.

### Available AI actions

- Propose rental reservation (golf cart, bike, kayak, etc.) — inventory-checked live.
- Add reservation add-on.
- Extend or shorten stay.
- Send a secure payment link.
- Answer from the Knowledge Base (read-only — no approval needed).

## Property Knowledge for the AI

The AI concierge answers guest questions using **Property Knowledge** managed at **Settings → Guest Messaging → Knowledge**. You can:

- Enter Q&A manually.
- **Paste a website URL** — the importer crawls it via Firecrawl and adds the content.
- **Upload PDFs, DOCX, and other documents** — text is extracted and embedded.
- **Ask an LLM to research the property** and generate a starter knowledge set for you to review.

Nothing is exposed to guests directly — the AI only uses this content when composing a reply, and every reply is staff-approved.

## Role visibility

Which staff roles see which threads is configured per-property in **Settings → Guest Messaging → Role Visibility**. Sensitive threads (billing disputes, complaints) can be scoped to Manager+ only.

## Privacy & retention

- No card data ever transits messaging (PCI SAQ A).
- Guest phone numbers and emails are stored on the guest profile only.
- Message content is retained on the thread; deletion follows the property's retention policy.`,
      }),
    ],
  },

  {
    id: 'rentals',
    name: 'Rentals',
    icon: 'Bike',
    articles: [
      A({
        id: 'rentals-overview',
        title: 'Rental Inventory (Golf Carts, Bikes, Kayaks…)',
        description: 'Manage a catalog of rentable items with live inventory, pricing, and reservation-linked bookings.',
        category: 'rentals',
        keywords: ['rentals', 'golf cart', 'bike', 'bicycle', 'kayak', 'inventory', 'add-on', 'package'],
        content: `# Rental Inventory Management

The **Rentals** page (sidebar → Point of Sale group → Rentals) manages any physical item you rent to guests: golf carts, bikes, kayaks, paddleboards, fire pits, cabanas, and so on.

## Concepts

### Catalog vs Units

- **Catalog item** (\`rental_items\`) — the product you rent (e.g. "6-seater Golf Cart"). Defines pricing, deposit, revenue account, and whether it's offerable via the AI concierge.
- **Tracking mode**:
  - **Quantity** — you just care that there are 12 bikes on hand. No serial-level detail.
  - **Individual** — each unit is tracked separately (Cart #1, Cart #2, …) with asset tag, status, and notes. Use this when you need to know exactly which unit went out.

### Pricing modes

Configured per item:

- **Hourly** — per-hour rate.
- **Daily** — per-24-hour rate.
- **Stay** — flat rate for the length of the guest's stay.

Deposits (refundable) are optional per item.

## Availability & overbooking protection

Availability is calculated live via the \`get_rental_availability\` database function:

- Sums bookings that overlap the requested window.
- Excludes cancelled/returned rentals.
- Uses a per-item advisory lock (\`enforce_rental_availability\` trigger) so two concurrent bookings can never oversell.

If a booking attempt exceeds available inventory, the database rejects it with an explicit "not enough inventory" error — this applies to manual bookings, add-ons, packages, and the AI concierge alike.

## Integration with Add-ons & Packages

Add-ons and package items can link to a \`rental_item\`. When the guest books a package that includes "1 kayak per day," the rental inventory decrements for the stay window automatically, and the package won't be bookable if inventory isn't available.

## Booking a rental

From a reservation → **Rentals** section:

1. Pick a catalog item; the picker shows live availability for the reservation's stay window.
2. Choose quantity (or a specific unit, if the item uses individual tracking).
3. Confirm pricing mode; the total charge and deposit preview populate.
4. Save. A folio posting is created against the item's revenue account; the deposit posts to the deposit liability account.

## Check-out and return

The Rentals page → **Bookings** tab tracks lifecycle:

- **Reserved** — booked, not yet handed out.
- **Checked out** — physically with the guest.
- **Returned** — released back to inventory.
- **Cancelled** — inventory released, folio posting reversed.

## AI Concierge

Items flagged **messaging_offerable** appear to the AI concierge in Guest Messaging. When a guest asks "can we get a golf cart for tomorrow afternoon?" the concierge can propose a rental reservation for staff to approve. Availability is checked at proposal time and re-checked at approval time.

## Reporting

Rental revenue rolls into the standard revenue reporting via the item's revenue account (Chart of Accounts). Utilization can be pulled from the Bookings tab filtered by date range.`,
      }),
    ],
  },
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export const getAllArticles = (): KnowledgeBaseArticle[] =>
  knowledgeBaseData.flatMap((c) => c.articles);

export const searchArticles = (query: string): KnowledgeBaseArticle[] => {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return [];
  return getAllArticles().filter((article) => {
    const searchableText = [
      article.title,
      article.description,
      article.content,
      ...article.keywords,
    ]
      .join(' ')
      .toLowerCase();
    return searchableText.includes(normalizedQuery);
  });
};

export const getArticleById = (id: string): KnowledgeBaseArticle | undefined =>
  getAllArticles().find((article) => article.id === id);

export const getCategoryById = (id: string): KnowledgeBaseCategory | undefined =>
  knowledgeBaseData.find((category) => category.id === id);

/** Compact JSON form used as context for the Ask-the-KB AI. */
export const getKbCorpusForAi = () =>
  getAllArticles().map((a) => ({
    id: a.id,
    title: a.title,
    category: a.category,
    description: a.description,
    content: a.content,
  }));
