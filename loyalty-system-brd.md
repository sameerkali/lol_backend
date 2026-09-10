# lol.expendifii.com — Business Requirements Document

**Summary:** A web-based digital stamp card for restaurants and cafés. Customers tap an NFC tag or scan a QR at the counter, enter their phone number, and track visits toward milestone rewards. Visits are marked automatically or confirmed with the business PIN, and each business decides how its rewards work.

## Problem
- Paper stamp cards get lost, are easy to fake, and give the owner zero data.
- Owners don't know who their regulars are or who has stopped coming.
- Existing loyalty platforms are expensive (~₹39,000/outlet/year) and too heavy for small restaurants.
- App-based loyalty gets few signups because customers won't download an app for one restaurant.

## Goal
Bring customers back more often with a loyalty card that takes seconds to join, can't be easily faked, and can be shaped by each business to fit its menu and margins.

## Users
- **Customer** — diner who taps the NFC tag or scans the QR at the counter
- **Business owner** — sets up rewards, confirms visits/redemptions with the PIN, and sees customer data in the business panel
- **Expendifii admin** — creates and manages all businesses from the admin panel

## Key Features

### Customer page (mobile web, no app, no login)
- Tap the NFC tag or scan the QR at the counter → opens that business's branded loyalty page (QR is for phones without NFC)
- Enter phone number → returning customer sees their card; new customer sees signup
- Lookup is by phone number only (no name search, to avoid mix-ups and showing one person's data to another)
- Signup: phone always; name, email and birthday only if the business has turned them on
- New members can start with head-start stamps (if the business enables it)
- See progress: current visits/points, progress bar, next milestone, full milestone ladder
- Tap **Mark my visit** → visit is marked automatically, or the business enters its PIN (based on the business setting); bill amount is entered at this step only if the business has turned the bill amount field on
- Celebration screen when a milestone unlocks
- See unlocked rewards; tap **Redeem** → business enters PIN → reward marked as used
- Visit and reward history

### Visit confirmation
- Two check-in modes, business turns one on in the panel:
  - **Automatic** — visit is marked right after tap/scan
  - **Business PIN** — business enters its PIN to confirm
- One PIN per business, set by the owner (no multiple PINs or staff accounts)
- Every visit and redemption is logged
- Stamp limit per phone number per day (default 1, business can change)
- Bill amount field: off by default; business can turn it on

### Business panel
- Account setup starts from a template (e.g. "Café", "Restaurant") that the owner can tweak
- **Earning mode** (changeable anytime):
  - Visits only — 1 visit = 1 stamp
  - Bill amount — points per ₹ spent (needs bill amount field on)
  - Visits with a minimum bill — visit counts only above a set amount (needs bill amount field on)
- **Milestones:** set a target, add any number of milestones; each has a count, reward type (free item, % off, flat ₹ off, custom text) and a label — e.g. visit 5 = free coffee, visit 10 = 20% off
- **After final milestone:** reset the card, or move the customer to the next tier (Silver, Gold, etc.), each tier with its own milestones
- Head-start stamps on signup: on/off and how many
- Signup fields: turn name, email and birthday on or off (phone always on)
- Birthday reward: set the reward (available only when the birthday field is on)
- Check-in mode: automatic or business PIN
- Bill amount field: on/off (off by default)
- Business PIN: set and change
- Customer list: search by phone, visits, last visit, rewards unlocked and redeemed
- View and download all customer data (phone and any enabled fields) to contact customers manually
- Dashboard: signups, visits, repeat-visit rate, redemptions, lapsed customers
- Branding on customer page: logo and colors
- Generate and download the QR code / table poster

### Admin panel
- Create businesses, including logo upload (max 2 MB), and manage their plans
- Generate each business's QR code and NFC link
- View and override any business's settings
- Platform-wide stats

### Business rules
- When a business changes its rules, customers already mid-card finish on the old rules; new rules apply from their next card
- Rewards already unlocked stay valid after any rule change
- Visits count automatically or after business PIN, based on the business setting; redemptions always need the business PIN

## Must-Have
- Customer page: phone lookup, signup, progress, milestone ladder
- NFC tag + QR check-in at the counter
- Automatic or business PIN check-in (toggle); business PIN for redemptions
- All three earning modes, configurable; bill amount field toggle (off by default)
- Configurable milestones, reset or tiers
- Templates at business setup
- Signup field toggles (name, email, birthday) + birthday reward
- Business panel: customer list, customer data download, dashboard, business PIN, QR generation
- Admin panel: business creation with logo upload, QR/NFC link generation, override

## Out of Scope
- WhatsApp and SMS messages or any messaging automation
- Multiple PINs or staff accounts
- Multiple outlets per business
- Online payment for subscriptions
- POS integration
- Native mobile app
- Customer passwords / login
- Looking up customers by name

## Constraints
- Separate Expendifii product with three parts: admin panel, business panel, customer page
- Web only; customer page designed mobile-first
- NFC tag installed at the counter; QR for the same link for phones without NFC
- Logo upload max 2 MB
- Timeline: to be estimated by the dev team

## Success Metrics
- More repeat visits: higher share of customers with 2+ visits, and more average visits per customer per month
