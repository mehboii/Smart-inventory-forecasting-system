# Smart Inventory Forecasting System

A full-stack university project for small-business inventory tracking and explainable demand forecasting.

## Tech Stack

- Frontend: React, Vite, Tailwind CSS, Recharts
- Backend: Node.js, Express
- Database: local SQLite through `better-sqlite3`
- Auth: JWT plus bcrypt password hashing
- Forecasting: Simple Moving Average and Exponential Smoothing

## Project Structure

```text
backend/   Express API, SQLite schema, auth, inventory, sales, forecasts, reports
frontend/  React application with protected routes and Tailwind UI
docs/      User-facing guide
```

## Setup

### 1. Backend

```bash
cd backend
npm install
npm run seed
npm run dev
```

The backend creates `backend/data/inventory.db` automatically. No external database account or API key is required for local development. Optionally copy `.env.example` to `.env` to set a custom database path or JWT secret.

The API runs at `http://localhost:4000`.

### 2. Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

During local development, frontend requests use `/api` and Vite proxies them
to `http://127.0.0.1:4000`. This keeps the React UI wired to Express without
hard-coding a browser-visible backend origin. Only set `VITE_API_URL` when the
frontend and API are deployed on different hosts.

## Main Features

- The first account becomes the database administrator. Administrators invite team members and assign their roles; subsequent registrations require a valid invitation.
- View dashboard summary cards for total products, low-stock items, reorder items, and inventory value.
- Create, update, and delete products.
- Enter dated sales history manually or paste CSV rows.
- Generate forecasts for the next N days.
- Compare actual sales and forecasted demand in a line chart.
- Display stockout risk, reorder-by date, and suggested reorder quantity.
- Export current inventory and saved forecast rows as CSV.
- Use the in-app Help page and first-login walkthrough.

## Deployed database update

Before deploying the Worker, apply
`supabase/migrations/20260802000000_add_invitations.sql` in the Supabase SQL
Editor. It creates the table used to store admin-issued invitations.

## Forecasting Methods

### Simple Moving Average

The default method averages the most recent sales values from a configurable window, such as 7, 14, or 30 days. Each predicted value is rolled forward into the next forecast step. This is simple to explain and works well for a classroom demo.

### Exponential Smoothing

Exponential smoothing uses an alpha value between 0 and 1. Higher alpha values react more strongly to recent sales. Lower alpha values produce a smoother forecast that changes more slowly.

## CSV Sales Import Format

Paste rows in the Forecasting page:

```csv
2026-01-01,12
2026-01-02,9
2026-01-03,15
```

The first value is the sale date in `YYYY-MM-DD` format. The second value is quantity sold.

## API Overview

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET|POST /api/auth/admin/invitations`
- `GET /api/auth/admin/users`
- `PATCH /api/auth/admin/users/:id/role`
- `GET /api/products`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`
- `GET /api/sales/:productId`
- `POST /api/sales/:productId`
- `POST /api/sales/:productId/bulk`
- `POST /api/forecasts/:productId`
- `GET /api/reports/inventory-forecast.csv`

## Notes for Review

- Forecasting logic lives in `backend/src/services/forecastService.js`, not inside the route handler.
- Data is stored in Supabase Postgres and survives closing or restarting the app.
- The development reset script clears local data and does not insert demo records.
