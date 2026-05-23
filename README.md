# Axis — Intelligent Room Booking for QSTP

Axis is an AI-powered event & room booking system for **Qatar Science & Technology Park (QSTP)**.
Users describe what they need in natural language (English or Arabic), an LLM extracts structured
requirements, a smart-matching engine ranks the best available rooms, and operators approve or
reject requests from a dedicated console. A 3D building view shows room availability in real time.

Built as a single **Next.js 14** full-stack app — deployable to **Vercel** in one click.

---

## Features

- **AI chat booking** — natural-language → structured requirements via OpenRouter (Claude), with a
  built-in deterministic fallback parser so the demo works even with no API key.
- **Smart room matching** — capacity/availability hard filters + weighted scoring (mandatory,
  important, nice-to-have attributes, floor & accessibility bonuses) returning the top 3 rooms.
- **3D building visualization** — interactive Three.js / React Three Fiber building with clickable
  rooms, status colors (available / reserved / maintenance), floor toggle, and an automatic 2D SVG
  floor-plan fallback when WebGL is unavailable.
- **Operator workflow** — pending-approval queue, approve/reject with notes, double-booking
  protection, audit log, and in-app notifications.
- **User dashboard** — upcoming/past bookings, pending requests, and personal statistics.
- **Auth & RBAC** — email + password (bcrypt), JWT in HTTP-only cookies, login rate limiting,
  role-based access (user / operator / admin).
- **Bilingual (EN + AR)** — full i18n with right-to-left (RTL) layout support, plus dark mode.
- **Email bookings** — webhook endpoint to parse booking requests emailed by approved outsiders.

## Tech stack

| Layer    | Choice                                            |
| -------- | ------------------------------------------------- |
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS   |
| 3D       | Three.js + @react-three/fiber + @react-three/drei |
| Backend  | Next.js Route Handlers (`/app/api/v1/...`)        |
| Auth     | `jose` (JWT) + `bcryptjs`                          |
| Database | PostgreSQL via Prisma ORM                         |
| LLM      | OpenRouter (Claude 3.5 Sonnet) + mock fallback    |
| State    | Zustand                                           |

---

## Getting started (local)

### 1. Prerequisites
- Node.js **18.17+** (Node 22 recommended)
- A PostgreSQL database. Easiest free option: [Neon](https://neon.tech) (serverless Postgres).

### 2. Install
```bash
npm install
```

### 3. Configure environment
Copy the example env file and fill in values:
```bash
cp .env.example .env.local
```
Required:
- `DATABASE_URL` — your Postgres connection string.
- `JWT_SECRET_KEY`, `JWT_REFRESH_SECRET_KEY` — generate with `openssl rand -base64 48`.
- `OPENROUTER_API_KEY` — optional. Leave blank to use the offline mock parser.

### 4. Create schema + seed demo data
```bash
npm run db:push     # create tables from the Prisma schema
npm run db:seed     # seed 15 rooms across 3 floors, demo users & bookings
```

### 5. Run
```bash
npm run dev
```
Open http://localhost:3000.

### Demo accounts (password: `Passw0rd!`)
| Email              | Role     |
| ------------------ | -------- |
| `user@qstp.qa`     | user     |
| `operator@qstp.qa` | operator |
| `admin@qstp.qa`    | admin    |

---

## Deploy to Vercel

1. Push this repo to GitHub (already done for the hackathon).
2. In Vercel, **New Project → Import** this repository. Vercel auto-detects Next.js.
3. Add a Postgres database (Vercel Postgres or Neon) and set environment variables in
   **Project → Settings → Environment Variables**:
   - `DATABASE_URL`
   - `JWT_SECRET_KEY`, `JWT_REFRESH_SECRET_KEY`
   - `OPENROUTER_API_KEY` (optional), `OPENROUTER_MODEL`
4. Deploy. The build runs `prisma generate && next build` automatically.
5. After the first deploy, push the schema and seed against the production DB (run locally with the
   production `DATABASE_URL`):
   ```bash
   DATABASE_URL="<prod-url>" npm run db:push
   DATABASE_URL="<prod-url>" npm run db:seed
   ```

> The build does **not** require a database connection, so deploys succeed before the DB is seeded.

---

## API overview (`/api/v1`)

| Method | Path                                     | Purpose                              |
| ------ | ---------------------------------------- | ------------------------------------ |
| POST   | `/auth/login`                            | Email/password login (rate limited)  |
| POST   | `/auth/refresh`                          | Refresh access token                 |
| POST   | `/auth/logout`                           | Clear session                        |
| GET    | `/auth/me`                               | Current user                         |
| POST   | `/chat/message`                          | Extract booking requirements (LLM)   |
| POST   | `/bookings/recommendations`              | Top-3 matching rooms                 |
| POST   | `/bookings/submit`                       | Submit selection for approval        |
| GET    | `/rooms?date=`                           | Building + per-room availability     |
| GET    | `/rooms/{id}/availability?date=`         | Hourly availability slots            |
| GET    | `/operator/pending-bookings`             | Approval queue (paginated)           |
| GET    | `/operator/dashboard`                    | Operator overview                    |
| POST   | `/operator/bookings/{id}/approve`        | Approve → creates booking            |
| POST   | `/operator/bookings/{id}/reject`         | Reject with reason                   |
| GET    | `/user/dashboard`                        | User bookings + stats                |
| POST   | `/email/parse-booking`                   | Webhook for outsider email bookings  |

## Project structure
```
app/
  (app)/            authenticated pages: book, building, dashboard, operator
  api/v1/           backend route handlers
  login/            login page
components/
  building/         3D scene, 2D fallback, viewer
  booking/          requirement summary, recommendation cards
lib/
  matching.ts       smart room-matching algorithm
  llm.ts            OpenRouter + mock extraction
  auth.ts           JWT + bcrypt + session
  i18n.ts           EN/AR translations
prisma/
  schema.prisma     database schema
  seed.ts           demo data
scripts/
  test-matching.ts  algorithm unit tests (run: npx tsx scripts/test-matching.ts)
```

## Notes & limitations (PoC)
- Rate limiting and recommendation caching are in-memory (per serverless instance). Use Redis/Upstash
  for production.
- Email sending is stubbed (logged, not delivered) — wire Postmark/SendGrid for real notifications.
- The 3D building is generated procedurally from room coordinates/dimensions (no external glTF asset).
