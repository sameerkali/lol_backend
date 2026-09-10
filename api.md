# Expendifii Loyalty API

Digital stamp-card backend for **lol.expendifii.com** — three consumers of this API:

- **Admin panel** — Expendifii staff, manage all businesses (`/api/admin/*`)
- **Business panel** — a café/restaurant owner manages their own loyalty program (`/api/business/*`)
- **Customer page** — public, no login, phone-number based (`/api/public/*`)

Base URL (local dev): `http://localhost:5001/api`

## Setup

```bash
cp .env.example .env   # fill in MONGODB_URI, JWT_SECRET, etc. (a working .env is already checked in for local dev)
npm install
npm run seed:admin     # creates the first super admin from ADMIN_EMAIL / ADMIN_PASSWORD in .env
npm run dev             # nodemon, http://localhost:5001
```

Default seeded admin (change the password after first login): `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`.

> macOS note: port `5000` is claimed by AirPlay Receiver, so the API defaults to **5001** (`PORT` in `.env`).

## Conventions

- All responses: `{ "success": true, "data": ... }` or `{ "success": false, "message": "...", "details": [...] }`.
- List endpoints add `"meta": { page, limit, total, pages }`.
- Auth: `Authorization: Bearer <token>` (JWT, 7 day expiry by default). Two roles: `admin` and `business`, issued by their respective `/auth/login`. The customer page needs no token — it's scoped by the business's `slug` in the URL and, for visit/redeem actions, the business's own PIN.
- Validation errors → `400` with a `details` array of `{ field, message }`.
- Rate limits: general API `300 req / 15 min / IP`; `*/auth/login` `20 req / 15 min / IP`; public `.../visits` and `.../redeem` (PIN entry points) `15 req / 10 min / IP+slug`.

## Data model (Mongo/Mongoose)

- **Admin** — `name, email, passwordHash`
- **Business** — program config: `slug`, `owner {email, passwordHash}`, `pinHash`, `earningMode`, `amountPerPoint`, `minBillAmount`, `milestones[]`, `afterFinalMilestone`, `tiers[]`, `headStart`, `signupFields`, `birthdayReward`, `checkInMode`, `billAmountFieldEnabled`, `stampLimitPerDay`, `lapsedAfterDays`, `branding`, `plan`, `status`
- **Customer** — one per `(business, phone)`: `count` (progress on the *current* card), `cardCycle`, `ruleSnapshot` (see below), `milestonesUnlocked[]`, `totalVisits`, `totalPoints`, `totalRedemptions`, `lastVisitAt`
- **Visit** — an immutable log row per visit or redemption event: `type`, `billAmount`, `pointsEarned`, `confirmedBy`, `milestonesReached`, etc.

### Business rule: mid-card rule changes

Per the BRD: *"When a business changes its rules, customers already mid-card finish on the old rules; new rules apply from their next card."* Each `Customer` stores a **`ruleSnapshot`** — the earning mode, milestone ladder and (if applicable) tier — captured at signup and re-captured only when their card resets or advances a tier. Live edits to the business's settings never retroactively change an in-progress card. Rewards already pushed into `milestonesUnlocked` keep their own copy of `rewardType/rewardValue/label`, so they also stay valid after a rule change, per the BRD.

---

## Admin API — `/api/admin`

Requires `Authorization: Bearer <admin token>` unless noted.

| Method | Path | Description |
|---|---|---|
| POST | `/auth/login` | `{ email, password }` → `{ token, admin }`. Public. |
| GET | `/auth/me` | Current admin. |
| POST | `/auth/admins` | Create another admin. `{ name, email, password }`. |
| GET | `/templates` | List business setup templates (`cafe`, `restaurant`, `blank`). |
| GET | `/stats` | Platform-wide stats: businesses, customers, visits, redemptions, by plan. |
| GET | `/businesses` | List/search businesses. Query: `search, status, plan, page, limit`. |
| POST | `/businesses` | Create a business. `multipart/form-data` (for the optional `logo` file ≤2MB) or JSON. Body: `name, template, ownerEmail, ownerPassword, pin?, plan?, overrides?` (`overrides` = JSON object of any Business field to deviate from the template). |
| GET | `/businesses/:id` | Get one business (full settings). |
| PUT | `/businesses/:id` | Override **any** business field (admin has full override power per BRD), incl. `ownerPassword`, `pin`, and a new `logo` file. |
| PATCH | `/businesses/:id/plan` | `{ plan }` → `trial \| basic \| pro`. |
| PATCH | `/businesses/:id/status` | `{ status }` → `active \| inactive`. |
| DELETE | `/businesses/:id` | Deletes the business and cascades to its customers + visit history. |
| GET | `/businesses/:id/qr` | `{ link, qrCodeDataUrl, nfcLink }` — QR/NFC link to the customer page. |

**Create business example**

```bash
curl -X POST /api/admin/businesses \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Java Hut","template":"cafe","ownerEmail":"owner@javahut.com","ownerPassword":"OwnerPass123","pin":"1234"}'
```

---

## Business panel API — `/api/business`

Requires `Authorization: Bearer <business token>` unless noted. Every route is implicitly scoped to the logged-in business — there is no cross-business access.

| Method | Path | Description |
|---|---|---|
| POST | `/auth/login` | `{ email, password }` → `{ token, business }`. Public. |
| POST | `/auth/change-password` | `{ currentPassword, newPassword }`. |
| GET | `/me` | Full current settings. |
| PUT | `/me` | Update program settings — any of: `name, earningMode, amountPerPoint, minBillAmount, milestones, afterFinalMilestone, tiers, headStart, signupFields, birthdayReward, checkInMode, billAmountFieldEnabled, stampLimitPerDay, lapsedAfterDays`. |
| PUT | `/me/pin` | `{ pin, currentPin? }` — set/change the 4-6 digit business PIN (`currentPin` required once a PIN already exists). |
| PUT | `/me/branding` | `multipart/form-data`: `logo` file (≤2MB) and/or `primaryColor`, `secondaryColor`. |
| GET | `/me/qr` | `{ link, qrCodeDataUrl, nfcLink }`. |
| GET | `/me/qr/download` | Streams the QR as a PNG (for printing a table poster). |
| GET | `/dashboard` | Query `from, to` (ISO dates, default: last 30 days). Returns `signups, visits, redemptions, totalCustomers, repeatCustomers, repeatVisitRate, lapsedCustomers, visitsByDay[]`. |
| GET | `/customers` | Search/list. Query: `phone, minVisits, maxVisits, hasUnredeemedRewards, lastVisitBefore, lastVisitAfter, sort (newest\|visits\|lastVisit), page, limit`. |
| GET | `/customers/:id` | One customer's full record. |
| GET | `/customers/:id/history` | That customer's visit/redemption log. |
| GET | `/customers/export` | CSV download of the (optionally filtered) customer list — phone + any enabled signup fields + progress stats. |

---

## Public customer API — `/api/public`

No auth. Scoped by the business's `slug` (from the NFC tag / QR code link, e.g. `lol.expendifii.com/b/java-hut`). Phone number is the only identifier — there is no customer login.

| Method | Path | Description |
|---|---|---|
| GET | `/businesses/:slug` | Safe public config for rendering the page: branding, earning mode, signup fields, milestone ladder, etc. `404` if the business is inactive/unknown. |
| POST | `/businesses/:slug/lookup` | `{ phone }` → `{ exists: false, signupFields }` or `{ exists: true, card }`. Used right after phone entry. |
| POST | `/businesses/:slug/signup` | `{ phone, name?, email?, birthday? }` (only fields the business has enabled are stored) → `{ card }`. Applies head-start stamps if enabled. |
| GET | `/businesses/:slug/card/:phone` | Re-fetch the card view. |
| GET | `/businesses/:slug/history/:phone` | Visit + redemption history for that phone. |
| POST | `/businesses/:slug/visits` | **Mark my visit.** `{ phone, billAmount?, pin? }`. `pin` is required only if the business's `checkInMode` is `pin`; ignored (or omit) for `automatic`. Enforces the daily stamp limit and the earning-mode math; returns `{ card, newlyUnlocked[], cardAdvanced, stampAwarded, note }` — `note` explains why 0 stamps were awarded (limit reached / below minimum bill), if applicable. |
| POST | `/businesses/:slug/redeem` | **Redeem a reward.** `{ phone, milestoneUnlockedId, pin }` — PIN is **always** required here regardless of check-in mode, per the BRD. → `{ card, redeemedReward }`. |

**Customer flow example**

```bash
curl -X POST /api/public/businesses/java-hut/lookup -d '{"phone":"9999900001"}'
curl -X POST /api/public/businesses/java-hut/signup -d '{"phone":"9999900001","name":"Riya"}'
curl -X POST /api/public/businesses/java-hut/visits -d '{"phone":"9999900001"}'
curl -X POST /api/public/businesses/java-hut/redeem -d '{"phone":"9999900001","milestoneUnlockedId":"...","pin":"1234"}'
```

## Earning modes

- **`visits`** — every marked visit (within the daily limit) = 1 stamp.
- **`bill_amount`** — `stamps = floor(billAmount / amountPerPoint)`, e.g. `amountPerPoint=200` → ₹200 spent = 1 point.
- **`visits_with_min_bill`** — 1 stamp if `billAmount >= minBillAmount`, else the visit is logged but earns nothing.

## Milestones, tiers & resets

- `milestones[]` (or each tier's `milestones[]`) each have `count, rewardType (free_item|percent_off|flat_off|custom), rewardValue, label`.
- On reaching the highest milestone count: if `afterFinalMilestone = "reset"`, the card resets to 0 and re-snapshots current business rules; if `"next_tier"`, the customer advances to the next entry in `tiers[]` (or stays maxed out on the last tier, if there is none further).
- Unlocked-but-unredeemed rewards persist across resets/tier changes until redeemed.

## Security notes

- Passwords and PINs are bcrypt-hashed; never returned by the API (stripped in `toJSON`).
- Public visit/redeem endpoints are rate-limited per IP+business to slow PIN brute-forcing.
- Uploaded logos: image mimetypes only, 2MB max, served from `/uploads`.
- CORS is locked to `FRONTEND_URL`.
