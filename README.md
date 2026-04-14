# Kedco FX — Staff Operations Platform

Web-based POS and operations dashboard for Kedco Foreign Exchange Services.
Replaces the manual CSV workflow with real-time transaction entry, live capital tracking, and daily reports.

## Tech stack

- **Frontend**: Next.js 15 (App Router), TypeScript, inline styles — no CSS framework
- **Backend**: FastAPI (Python) on port 8000, PostgreSQL
- **Auth**: JWT in `httpOnly` cookie (`kedco_token`), role-based routing
- **Deployment**: Vercel (frontend) + Railway/VPS (backend)

---

## Local development

### Prerequisites

- Node.js 20+
- Backend API running on `http://localhost:8000` (or set `API_URL` env var)

### Install and run

```bash
npm install
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000).

### Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```
API_URL=http://localhost:8000          # Backend API base URL
BRANCH_LOCATION=Pusok, Lapu-Lapu City  # Shown on receipts and the staff guide footer
```

`BRANCH_LOCATION` is the only per-branch config — each branch deployment sets this once in Vercel.

---

## Roles and routing

| Role        | Lands on      | Access                                  |
|-------------|---------------|-----------------------------------------|
| admin       | /dashboard    | Everything                              |
| supervisor  | /dashboard    | Dashboard (read-only)                   |
| cashier     | /counter      | Counter only                            |
| rider       | /rider        | Rider field screen only                 |

---

## Key routes

| Route              | Purpose                                      |
|--------------------|----------------------------------------------|
| `/`                | Public landing page                          |
| `/login`           | Staff login                                  |
| `/dashboard`       | Live capital, positions, transactions, riders |
| `/counter`         | Cashier transaction entry                    |
| `/rider`           | Rider field screen (mobile-optimised)        |
| `/guide`           | Staff operations guide (this is the Day 1 reference) |
| `/admin/rates`     | Set today's buy/sell rates                   |
| `/admin/positions` | Opening stock positions (Day 1 only)         |
| `/admin/eod`       | End of day — closes day, carries stock       |
| `/admin/report`    | Daily report — printable PDF                 |
| `/admin/users`     | Manage staff accounts                        |

---

## E2E tests (Playwright)

Tests run against a **mock API server** — no real backend needed.

### Install Playwright browsers (first time only)

```bash
npx playwright install chromium
```

### Run all tests

```bash
npm run test:e2e
```

### Run with UI (visual trace viewer)

```bash
npm run test:e2e:ui
```

### View last run's report

```bash
npm run test:e2e:report
```

### How it works

1. `tests/setup/mock-api.mjs` — a plain Node.js HTTP server on port 9999 that returns
   fixture data for all API endpoints (login, currencies, transactions, dispatches, etc.)
2. `playwright.config.ts` starts the mock API first, then Next.js on port 3001 with
   `API_URL=http://localhost:9999` so all server-side fetches hit the mock.
3. `tests/setup/global-setup.ts` logs in as each role and saves cookie state to
   `tests/.auth/` so tests start pre-authenticated.

### Test files

| File                      | Covers                                      |
|---------------------------|---------------------------------------------|
| `tests/auth.spec.ts`      | Login redirects, unauthenticated blocks     |
| `tests/counter.spec.ts`   | Counter form, currencies, submit, receipt   |
| `tests/rider.spec.ts`     | Rider screen, dispatch warning, log tab     |
| `tests/dashboard.spec.ts` | All dashboard tabs, rider dispatch flow     |

---

## Deployment (Vercel)

One Vercel project per branch location. The only difference between deployments is `BRANCH_LOCATION`.

Set in Vercel → Project → Settings → Environment Variables:

```
API_URL=https://api.kedcofx.com
BRANCH_LOCATION=Pusok, Lapu-Lapu City
```

---

## Development test accounts

These accounts exist in the mock API for local/E2E testing:

| Username    | Password    | Role       |
|-------------|-------------|------------|
| admin       | admin       | Admin      |
| supervisor1 | supervisor1 | Supervisor |
| cashier1    | cashier1    | Cashier    |
| rider01     | rider01     | Rider      |

Production passwords are set via `/admin/users`.
