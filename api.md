# Expendifii Loyalty API

Digital stamp-card backend for **lol.expendifii.com** — three consumers of this API:

- **Admin panel** — Expendifii staff, manage all businesses (`/api/admin/*`)
- **Business panel** — a café/restaurant owner manages their own loyalty program (`/api/business/*`)
- **Customer page** — public, no login, phone-number based (`/api/public/*`)

Base URL (production): `https://lol-api.expendifii.com/api`
Base URL (local dev, fallback): `http://localhost:5001/api`

## Setup

```bash
cp .env.example .env   # fill in MONGODB_URI, JWT_SECRET, etc. (a working .env is already checked in for local dev)
npm install
npm run seed:admin     # creates the first super admin from ADMIN_EMAIL / ADMIN_PASSWORD in .env
npm run dev             # nodemon, http://localhost:5001
```

Default seeded admin (change the password after first login): `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`.

> macOS note: port `5000` is claimed by AirPlay Receiver, so the API defaults to **5001** (`PORT` in `.env`).

## Health checks

| Method | Path | Description |
|---|---|---|
| GET | `/` | Root health check — `{ success, status: "ok", message, docs, uptime, time }`. Never touches the DB, safe for uptime monitors / Vercel. |
| GET | `/api/health` | Same idea, scoped under `/api` — `{ success, status: "ok", time }`. |

## Deployment (Vercel)

The app is packaged as a single serverless function:

- [`api/index.js`](api/index.js) exports the Express app (`module.exports = app`) — Vercel's Node runtime detects an Express instance and drives it directly.
- [`vercel.json`](vercel.json) rewrites every path (`/(.*)`) to that function, so `/`, `/api/health` and every `/api/*` route are all served by the same app instance.
- [`src/config/db.js`](src/config/db.js) caches the Mongoose connection promise so a warm Lambda reuses it instead of reconnecting per-request; [`src/app.js`](src/app.js) awaits it on every `/api` request before hitting a route (cheap no-op once connected).
- `server.js` (with `app.listen`) is only used for local dev / non-serverless hosting — Vercel never runs it.

**Required environment variables on Vercel** (Project Settings → Environment Variables): `MONGODB_URI`, `MONGODB_DB_NAME`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PIN_ENCRYPTION_KEY` (used to reversibly encrypt the business PIN for display in the panel; falls back to `JWT_SECRET` if unset, but set a dedicated value in production), `FRONTEND_URL` (the deployed frontend's origin, e.g. `https://lol.expendifii.com` — CORS is locked to this; comma-separate multiple origins if needed, a trailing slash is stripped automatically so it's safe either way), `API_BASE_URL` (set to `https://lol-api.expendifii.com` — this backend's own public URL once the custom domain is attached in Vercel; falls back to `http://localhost:$PORT` if unset, which is only correct for local dev), `ADMIN_NAME`/`ADMIN_EMAIL`/`ADMIN_PASSWORD` (only needed to run `npm run seed:admin` once, e.g. via `vercel env pull` + local run against the prod DB), `NODE_ENV=production`.

```bash
npm i -g vercel   # if not already installed
vercel link
vercel env add MONGODB_URI production
# ...repeat for the other required vars...
vercel --prod
```

Deploy checklist:
- [ ] All required env vars set in the Vercel project (missing ones fail fast at cold start — see [Config validation](#config-validation) below).
- [ ] MongoDB Atlas network access allows `0.0.0.0/0` (Vercel's egress IPs aren't static) or the specific Vercel IP ranges.
- [ ] `FRONTEND_URL` matches the deployed frontend's exact origin (scheme + host), or the browser will get CORS errors.
- [ ] `npm run seed:admin` has been run once against the production database.
- [ ] `GET /` and `GET /api/health` both return `200` after deploy.

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
| POST | `/businesses` | Create a business. JSON body: `name, template, ownerEmail, ownerPassword, pin?, plan?, overrides?` (`overrides` = JSON object of any Business field to deviate from the template). |
| GET | `/businesses/:id` | Get one business (full settings). |
| PUT | `/businesses/:id` | Override **any** business field (admin has full override power per BRD), incl. `ownerPassword` and `pin`. |
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
| GET | `/me` | Full current settings, including a decrypted `pin` field (the business's own PIN, reversibly encrypted at rest — never returned to any other consumer). |
| PUT | `/me` | Update program settings — any of: `name, earningMode, amountPerPoint, minBillAmount, milestones, afterFinalMilestone, tiers, headStart, signupFields, birthdayReward, checkInMode, billAmountFieldEnabled, stampLimitPerDay, lapsedAfterDays`. |
| PUT | `/me/pin` | `{ pin }` — set/change the 4-6 digit business PIN. No `currentPin` confirmation: the PIN is always visible to the owner in the panel (`GET /me`'s decrypted `pin` field), and the bearer token already proves account ownership. |
| PUT | `/me/branding` | JSON body: `{ primaryColor?, secondaryColor? }`. There is no logo/image upload in this API — branding is colors only. |
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
- CORS is locked to `FRONTEND_URL` (comma-separated list of exact origins; trailing slashes are stripped before comparison, so `https://lol.expendifii.com` and `https://lol.expendifii.com/` are treated the same). Requests with no `Origin` header (curl, server-to-server) bypass the check — there's nothing for CORS to enforce there. A disallowed origin gets a clean `403`, not a silent browser-side CORS failure.
- There is no image/file upload anywhere in this API — branding is colors only (`primaryColor`/`secondaryColor`). No `multer`, no disk or third-party storage, no `/uploads` static route.

## Config validation

`src/config/env.js` calls a `required()` helper for `MONGODB_URI` and `JWT_SECRET` — if either is missing, the process throws **at require-time** and refuses to start (fails fast rather than serving requests with a broken config). Everything else in `.env` has a default (`PORT=5000`, `NODE_ENV=development`, `FRONTEND_URL=http://localhost:3000`, `API_BASE_URL=http://localhost:$PORT`, `JWT_EXPIRES_IN=7d`).

## Validations & edge cases

Everything below is enforced by the code today — not aspirational.

### Response & error shape

- Success: `{ "success": true, "data": ... }`, optionally with `"meta"` for lists.
- Failure: `{ "success": false, "message": "...", "details"?: [...] }`.
- `express-validator` failures (`validate` middleware) → `400` with `details: [{ field, message }, ...]`, one entry per failing field.
- A thrown `ApiError` → its own `statusCode` (400/401/403/404/409/429) and `message`; `details` only if explicitly passed (used by validation and duplicate-key errors).
- A Mongoose `ValidationError` (e.g. a bad enum value assigned via `overrides` or `PUT /businesses/:id`) → `400` with the raw Mongoose message (no `details` array — this path bypasses `express-validator`).
- A Mongo duplicate-key error (`code 11000`, e.g. racing to create two businesses with the same `owner.email`) → `409` with `details` set to the offending `keyValue`.
- Any unhandled error → `500`; `stack` is included in the body only when `NODE_ENV !== "production"`.
- An unmatched route → `404` with `{ success: false, message: "Route not found: GET /api/whatever" }` (no `data`/`details` key at all).

### Auth (admin & business)

- `Authorization: Bearer <token>` required on every non-public route; missing header → `401 "Missing bearer token"`.
- Malformed/expired JWT → `401 "Invalid or expired token"`. Wrong role's token on the wrong panel (e.g. a business token on an `/admin/*` route) → `403`, not `401` — the token is valid, just for the wrong role.
- Token references a deleted admin/business (`payload.sub` no longer resolves) → `401` — a valid signature doesn't guarantee the account still exists.
- A **business** token additionally requires `business.status === "active"` on every request → `403 "Business account is inactive"` even with a perfectly valid token, if an admin has since deactivated the account. (Admin tokens have no such check — there's no `admin.status`.)
- Login (`POST /auth/login`, both panels): `email` must pass `isEmail()`, `password` must be non-empty — otherwise `400` before any DB lookup. Wrong email or wrong password both return the same generic failure (not distinguished, to avoid user enumeration) — see the controller for the exact message.
- `authLimiter` caps login attempts at `20 / 15 min / IP` — after that, `429` regardless of whether the credentials would've been correct.
- `POST /admin/auth/admins`: `password` must be `≥ 8` chars; no uniqueness check on admin email is enforced at the route level beyond Mongo's own unique index (if any) — a duplicate insert surfaces as the generic `11000` handler above.

### Admin — businesses

- `createBusiness`: `name`, `ownerEmail` (valid email), `ownerPassword` (`≥ 8` chars) are required by route validators; a missing one → `400` with per-field `details`. The controller *also* re-checks `name`/`ownerEmail`/`ownerPassword` truthiness as a defensive second layer.
- Creating a business with an `ownerEmail` that already exists (across the whole platform, not scoped to one business) → `409 "A business with this owner email already exists"` — checked *before* the insert, so it's a clean `409` rather than relying on a Mongo unique-index race (though one can still occur under concurrent requests, in which case the fallback is the generic `11000` → `409` handler).
- `template` must resolve via `getTemplate()` — an unknown template name throws inside that lookup (uncaught specifics depend on `constants/templates.js`; treat any non-`cafe`/`restaurant`/`blank` value as unsupported). Omitting `template` defaults to `"blank"`.
- `overrides` accepts either a JSON object (native JSON body) or a **JSON-encoded string** (for parity with the old multipart flow) — `JSON.parse` on a malformed string throws a raw `SyntaxError`, which is *not* an `ApiError` and surfaces as an unstyled `500`, not a clean `400`. Send `overrides` as a real object in a JSON body to avoid this.
- `overrides` is spread directly onto the new `Business(...)` — it can set **any** schema field, including ones with their own validation (e.g. `milestones[].count`, enum fields like `earningMode`). An invalid value here fails at `business.save()` as a Mongoose `ValidationError` (`400`, no `details` array — see above), not at the route-validator layer.
- `slug` is derived from `name` and de-duplicated automatically (`uniqueSlug`) — callers cannot set or collide on it directly.
- `updateBusiness` (`PUT /businesses/:id`): no route-level `express-validator` rules at all — every field in `rest` (everything except `ownerPassword`/`pin`/`name`, which get special handling) is `Object.assign`'d onto the document as-is. This is intentionally permissive ("admin has full override power per BRD") but means a typo'd field name is silently ignored (unknown Mongoose paths are dropped) while a bad enum value on a *real* field throws a `ValidationError`.
- `pin` on create/update is optional; when set it must still satisfy the `Business` schema's own pin-hash flow — there is no format check (e.g. digit-length) at this layer the way there is on `PUT /me/pin` (see below). If you need the 4–6 digit rule enforced on admin-set PINs too, that would need to be added explicitly.
- `deleteBusiness` cascades to `Customer` and `Visit` — this is **irreversible** and un-guarded by a confirmation step; deleting the wrong `:id` destroys that business's entire customer/visit history in the same request.
- `patchPlan` / `patchStatus`: the route accepts *any* string for `plan`/`status`, not just the enum values in `constants/loyalty.js` (`PLANS`, `BUSINESS_STATUS`) — an invalid value is only caught if the schema itself enforces an enum; otherwise it's stored as-is. Worth tightening with `body(...).isIn([...])` if stricter validation is wanted.

### Business — settings, PIN, branding

- `updateMe` (`PUT /me`) writes only the fields in a fixed allowlist (`EDITABLE_FIELDS`) — anything else in the body is silently ignored, not rejected. There is no schema-shape validation on nested structures like `milestones[]` or `tiers[]` beyond whatever Mongoose enforces — e.g. a milestone list with duplicate `count` values, an empty `milestones[]`, or a non-ascending ladder is accepted and will just produce confusing `nextMilestone`/`progressPercent` output on the customer side.
- `updatePin`: `pin` must match `/^\d{4,6}$/` — non-digits or wrong length → `400`. No `currentPin` confirmation is required — the bearer token already proves this is the account owner, and the current PIN is always visible to them via `GET /me`. An admin can also overwrite it unconditionally via `PUT /admin/businesses/:id`.
- `updateBranding`: `primaryColor`/`secondaryColor` are accepted as **any string**, unvalidated — no hex-format check. Sending `{}` (neither field) is a no-op `200` that just re-saves the document.
- `exportCustomers` streams a CSV built only from the business's *currently enabled* `signupFields` — if a business disables `email` after some customers already have one on file, those emails are simply omitted from future exports (not an error, just a silent column drop).
- `listCustomers` query params (`minVisits`, `maxVisits`, `lastVisitBefore`, `lastVisitAfter`) are not validated as numbers/dates before being passed to `Number(...)`/`new Date(...)` — a garbage value (e.g. `minVisits=abc`) becomes `NaN`/`Invalid Date`, which Mongo will simply match nothing against (an empty-looking result set, not an error).
- `page`/`limit` on any paginated list: `page` is floored to `≥ 1`; `limit` is clamped to `1–100` even if a caller asks for more — no error, just silently capped.

### Public customer flow

- Every public route first calls `loadActiveBusiness(slug)` — an unknown slug *or* a slug belonging to an `inactive` business both return the same `404 "This loyalty page is not available"` (deliberately indistinguishable, so a deactivated business's URL doesn't leak its existence/state).
- `phone` is required and length-checked (`6–20` chars) at the route layer on every endpoint that takes it, but **not** format-checked (no digits-only regex) — `"abcdefg"` is a legal "phone number" today.
- `signup`: creating a second customer with the same `(business, phone)` → `409 "A customer with this phone number already exists for this business"`. Fields not enabled in `business.signupFields` (e.g. `email` when the business only collects `name`) are silently dropped even if sent in the body — never stored, never an error.
- `markVisit` when no customer exists for that phone → `404 "Customer not found — sign up first"` (visits never implicitly create a customer).
- `markVisit` with `checkInMode: "pin"`: missing `pin` → `400`; wrong `pin` → `401`. With `checkInMode: "automatic"`, `pin` is ignored even if sent — no error either way.
- Daily stamp limit (`stampLimitPerDay`) is tracked per calendar day via a `lastVisitDateKey` reset — a visit past the limit still returns `200` (the visit *is* logged, with `stampAwarded: false` and an explanatory `note`), it is not rejected as an error. Same pattern for `bill_amount` mode below the per-point threshold, or `visits_with_min_bill` below `minBillAmount`: `200`, zero stamps, a `note` explaining why.
- `bill_amount` mode: a missing or `≤ 0` `billAmount` → `0` stamps with a note, not a `400` — the visit still gets logged (e.g. useful for a business that wants a record of a customer who didn't buy anything that qualifies).
- Reaching the final milestone triggers `advanceCardIfComplete` in the *same* request that earned the qualifying stamp — a caller can get `cardAdvanced: true` and `newlyUnlocked` for the old card's last milestone in one response; the returned `card` already reflects the *new* cycle (count reset to 0 or moved to the next tier), so don't assume `card.count` still shows the stamp that just triggered the reset.
- On `afterFinalMilestone: "next_tier"` with no further tier configured, the customer simply stays maxed out on the last tier indefinitely — no error, no reset, `cardAdvanced: false` from then on.
- `redeem`: **PIN is always required**, regardless of `checkInMode` — this is different from `markVisit`. Missing `pin` → `400`; wrong `pin` → `401` (both before the reward lookup, so no information about whether `milestoneUnlockedId` is even valid leaks to a PIN-guessing attempt). Unknown `milestoneUnlockedId` → `404`; a reward that's already `redeemed: true` → `409` (redemption is not idempotent — retrying a successful redemption is a hard error, not a no-op).
- `pinLimiter` (`15 req / 10 min / IP+slug`) applies to both `/visits` and `/redeem` — note the key includes the business `slug`, so the same IP hitting *different* businesses' PIN entry points has independent budgets, but hammering one business's PIN from one IP locks out fast.
- All request bodies/params/query are recursively stripped of any key starting with `$` or containing `.` ([`sanitize.js`](src/middleware/sanitize.js)) before touching a controller — this blocks Mongo operator injection (e.g. `{"phone": {"$ne": null}}` has its `$ne` key deleted, leaving `phone: {}`, which then just fails the `notEmpty()`/length validators normally) but does **not** validate types beyond that.

### Rate limits (recap)

| Limiter | Scope | Budget |
|---|---|---|
| `apiLimiter` | All of `/api/*` | 300 req / 15 min / IP |
| `authLimiter` | `*/auth/login` | 20 req / 15 min / IP |
| `pinLimiter` | public `/visits`, `/redeem` | 15 req / 10 min / IP + business `slug` |

All three respond `429` with `standardHeaders` (`RateLimit-*`) once exceeded; `authLimiter` and `pinLimiter` also override the default body with a human-readable `message`.
