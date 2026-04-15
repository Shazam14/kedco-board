# Kedco FX — Staff Operations Platform

Web-based POS and operations dashboard for Kedco Foreign Exchange Services.
Replaces the manual CSV workflow with real-time transaction entry, live capital tracking, and daily reports.

## Tech stack

- **Frontend**: Next.js 16 (App Router), TypeScript, inline styles — no CSS framework
- **Backend**: FastAPI (Python), PostgreSQL
- **Auth**: JWT in `httpOnly` cookie (`kedco_token`), role-based routing
- **Deployment**: Vercel (frontend) + Railway/VPS (backend)

---

## Local development

### Prerequisites

- Node.js 20+
- Backend API running (or use the built-in mock — see E2E Tests below)

### Install and run

```bash
npm install
npm run dev        # dev server on http://localhost:3000
```

### Environment variables

```
API_URL=http://localhost:8000          # Backend API base URL
AUTH_COOKIE=kedco_token                # Cookie name for JWT
BRANCH_LOCATION=Pusok, Lapu-Lapu City  # Shown on receipts and the staff guide footer
```

`BRANCH_LOCATION` is the only per-branch config — each branch deployment sets this once.

---

## Roles and routing

| Role        | Lands on      | Access                                  |
|-------------|---------------|-----------------------------------------|
| admin       | /dashboard    | Everything                              |
| supervisor  | /dashboard    | Dashboard + shifts (read-only)          |
| cashier     | /counter      | Counter only                            |
| rider       | /rider        | Rider field screen only                 |

---

## Routes

| Route               | Purpose                                                  |
|---------------------|----------------------------------------------------------|
| `/`                 | Public landing page                                      |
| `/login`            | Staff login                                              |
| `/dashboard`        | Live capital, positions, transactions, riders            |
| `/counter`          | Cashier transaction entry (shift open/close + BUY/SELL)  |
| `/rider`            | Rider field screen (mobile-optimised)                    |
| `/guide`            | Staff operations guide + demo videos                     |
| `/admin`            | Admin panel — "What do you need to do?"                  |
| `/admin/rates`      | Set today's buy/sell rates for all currencies            |
| `/admin/positions`  | Opening stock positions (Day 1 setup; EOD auto-carries after) |
| `/admin/eod`        | End of day — closes day, rolls stock forward             |
| `/admin/report`     | Daily report — printable PDF replacing 6 manual CSVs    |
| `/admin/shifts`     | Teller shift log — open/closed, variance per cashier     |
| `/admin/riders`     | Rider dispatch management — dispatch, track, return      |
| `/admin/users`      | Manage staff accounts — name, branch, password reset     |
| `/admin/banks`      | Manage banks and e-wallets used for payment modes        |
| `/admin/audit`      | Audit trail — every create/update/delete with diffs      |

---

## E2E tests (Playwright)

Tests run against a **mock API server** — no real backend needed.

### First-time setup

```bash
npx playwright install chromium
sh scripts/install-hooks.sh          # installs pre-push hook
```

The pre-push hook runs all E2E tests before every `git push`. Push is blocked on failure.
To skip in an emergency: `git push --no-verify`.

### Run tests

```bash
npm run test:e2e           # run all (headless)
npm run test:e2e:ui        # visual trace viewer
npm run test:e2e:report    # open last HTML report
```

### How it works

1. `tests/setup/mock-api.mjs` — Node.js HTTP server on port 9999 that returns fixture
   data for all API endpoints. Handles auth, currencies, transactions, shifts, dispatches,
   banks, positions, rates, audit log, daily report, and EOD.
2. `playwright.config.ts` starts the mock API, then Next.js on port 3001 with
   `API_URL=http://localhost:9999`.
3. `tests/setup/global-setup.ts` logs in as each role and saves cookie state to
   `tests/.auth/` so tests start pre-authenticated.

### Test files

| File                        | Covers                                        |
|-----------------------------|-----------------------------------------------|
| `tests/auth.spec.ts`        | Login, role redirects, unauthenticated blocks |
| `tests/counter.spec.ts`     | Counter form, currencies, BUY/SELL, receipt   |
| `tests/rider.spec.ts`       | Rider screen, dispatch card, log tab          |
| `tests/dashboard.spec.ts`   | All tabs, capital cards, rider dispatch flow  |
| `tests/shifts.spec.ts`      | Open shift, close shift, variance, admin view |
| `tests/audit.spec.ts`       | Audit log load, filters, entry rendering      |
| `tests/responsive.spec.ts`  | Mobile/tablet/desktop layout breakpoints      |

> Demo specs (`tests/demo/`) are excluded from the pre-push hook — they use a separate
> config with a 10-minute timeout and `slowMo` for recording. See **Demo Videos** below.

---

## Demo videos

Screen recordings of the real system, served from `/guide` for staff onboarding.

### Record (or re-record)

```bash
# 1. Build the app once (only needed if code changed)
API_URL=http://localhost:9999 AUTH_COOKIE=kedco_token npx next build

# 2. Record all four demos
npm run record:demo

# 3. Copy videos to public/ so the guide page can serve them
npm run copy-videos
```

Videos land in `test-results/` and are copied to `public/videos/`:

| File                              | Demo                                        |
|-----------------------------------|---------------------------------------------|
| `public/videos/admin-daily.webm`  | Admin daily workflow — all 9 admin tools    |
| `public/videos/admin.webm`        | Admin full walkthrough                      |
| `public/videos/cashier.webm`      | Cashier: open shift → BUY/SELL → close      |
| `public/videos/rider.webm`        | Rider: login → BUY → SELL                   |

---

## Demo / test accounts

These accounts exist in both the mock API and the real database (`is_demo = true`).
They are excluded from all reports, EOD aggregates, and shift logs — safe to use
for recording or live demos without polluting real data.

| Username     | Password    | Role    |
|--------------|-------------|---------|
| admintest    | Demo@2026!  | admin   |
| cashiertest  | Demo@2026!  | cashier |
| ridertest    | Demo@2026!  | rider   |
| devtest      | Demo@2026!  | admin   |

Regular E2E test accounts (mock API only, not in production DB):

| Username    | Role       |
|-------------|------------|
| admin       | admin      |
| supervisor1 | supervisor |
| cashier1    | cashier    |
| rider01     | rider      |

---

## Deployment

One Vercel project per branch location. Set in Vercel → Settings → Environment Variables:

```
API_URL=https://api.kedcofx.com
AUTH_COOKIE=kedco_token
BRANCH_LOCATION=Pusok, Lapu-Lapu City
```

After deploying the backend, run the Alembic migrations:

```bash
cd api
alembic upgrade head
```

Current migrations (in order):

| Revision       | Description                                              |
|----------------|----------------------------------------------------------|
| `9240981df8ac` | Initial tables                                           |
| `5424903a1a35` | Supervisor/rider roles, branch field                     |
| `8b21747c27c4` | Teller shifts table                                      |
| `a1b2c3d4e5f6` | is_demo flag + seed demo accounts                        |
| `60c4ce04fda4` | Composite indexes on transactions(date,type/cashier)     |
