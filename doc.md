# Smart Inventory Forecasting System.

## Purpose

This system helps a small business manage inventory, record sales, predict future demand, and identify products that need to be reordered. It is built as a full-stack web application for inventory management and demand forecasting.

## Technology Used.

| Layer | Technology | Purpose |.
| --- | --- | --- |
| Frontend | React, Vite, Tailwind CSS | User interface and browser-side interactions |
| Charts | Recharts and custom SVG/CSS charts | Forecast and dashboard visualizations |
| Backend | Node.js and Express | API, authentication, business logic, and live updates |
| Database | Supabase Postgres | Persistent users, products, sales, and forecast data |
| Authentication | JWT, bcrypt, HTTP-only cookie support | Account registration, login, and protected requests |

## System Architecture

```text
Browser
  React dashboard, inventory, forecasting, reports
        |
        | HTTP API and authenticated live stream
        v
Express backend
  Authentication, validation, inventory logic, forecast logic
        |
        v
Supabase Postgres
  users, products, sales_history, forecasts
```

The frontend never connects directly to the database. It sends requests to the Express backend. The backend validates the user, performs calculations, and reads or writes the Supabase database.

## Main Parts

### Frontend

The frontend is located in `frontend/`.

- `src/App.jsx` controls protected routes and redirects unauthenticated users to login.
- `src/context/AuthContext.jsx` stores the current user and login state.
- `src/context/ThemeContext.jsx` stores the light or dark theme preference.
- `src/pages/Dashboard.jsx` shows current inventory metrics, sales trend, category mix, alert queue, and live status.
- `src/pages/Inventory.jsx` lets users create, update, and delete products.
- `src/pages/Forecasting.jsx` accepts sales data and generates forecasts.
- `src/pages/Reports.jsx` downloads inventory and forecast records as CSV.
- `src/api/client.js` sends authenticated API requests without browser caching.
- `src/api/live.js` keeps an authenticated event stream open for immediate dashboard refreshes.

### Backend

The backend is located in `backend/`.

- `src/server.js` starts Express, configures CORS, registers API routes, and listens on port `4000` by default.
- `src/db/database.js` creates the Supabase client using values from `backend/.env`.
- `src/middleware/auth.js` verifies JWT tokens before protected API requests continue.
- `src/routes/authRoutes.js` handles registration, login, logout, walkthrough completion, and current-user lookup.
- `src/routes/productRoutes.js` manages products and inventory values.
- `src/routes/salesRoutes.js` manages manual and bulk sales history entries.
- `src/routes/forecastRoutes.js` creates forecasts and reorder alerts.
- `src/routes/dashboardRoutes.js` returns one fresh dashboard snapshot based on actual database values.
- `src/routes/liveRoutes.js` keeps a server-sent event connection open for each logged-in user.
- `src/services/forecastService.js` contains the demand forecasting calculations.
- `src/services/liveUpdates.js` publishes dashboard refresh events when data changes.

## Database Data

The system stores four main groups of data in Supabase:

| Table | Stores |
| --- | --- |
| `users` | Name, email, hashed password, role, walkthrough state |
| `products` | Product details, stock, reorder point, unit cost, lead time |
| `sales_history` | Product sales quantities for individual dates |
| `forecasts` | Generated forecast dates, predicted demand, and method |

Product values are entered as INR amounts in the user interface. The dashboard and inventory page display monetary values with the Indian rupee symbol.

## Authentication Flow

1. A user registers or logs in from the frontend.
2. The backend hashes passwords with bcrypt and verifies them during login.
3. The backend creates a JWT containing the user ID, email, and role.
4. The frontend stores the token locally and sends it as a bearer token for protected API requests.
5. The backend middleware checks the token before returning or changing private data.

Every product, sales record, forecast, dashboard snapshot, and CSV report is scoped to the logged-in user.

## Dashboard Flow

The dashboard calls `GET /api/dashboard` to load a single database-backed snapshot. The response contains:

- Total products
- Low-stock products
- Products due for reorder
- Total inventory value in INR
- Open reorder alerts
- Actual product records
- Last 14 days of sales totals
- Category distribution
- A backend-calculated risk score

The dashboard request uses `Cache-Control: no-store` on the backend and `cache: 'no-store'` in the browser. This prevents stale browser data from being displayed.

## Live Updates

The dashboard uses two refresh mechanisms:

1. **Immediate event refresh:** When a product, sale, or forecast is changed through the backend, the backend publishes an event through `/api/live`. Any open dashboard for that user refreshes immediately.
2. **Two-second fallback refresh:** The dashboard also requests a new snapshot every two seconds. This catches data changes that happen directly in Supabase or when a live connection is temporarily unavailable.

The status label in the dashboard shows whether the live connection is active. If the API cannot be reached, the dashboard shows a sync error instead of pretending old data is current.

## Inventory Management

On the Inventory page, a user can:

- Add a product with name, SKU, category, stock, reorder point, INR unit cost, and lead time.
- Edit an existing product.
- Delete a product and its related sales history.
- See the current product list refresh automatically.

When a product is added, edited, or deleted, the backend saves the change in Supabase and publishes a live dashboard update.

## Sales History

Sales history is connected to a product. Users can:

- Add one dated sale manually.
- Paste CSV rows in the form `YYYY-MM-DD,quantity`.
- Import multiple sales rows at once.

Sales history is used for both forecasting and dashboard sales trends.

## Forecasting

The Forecasting page supports two methods.

### Simple Moving Average

The system averages the most recent sales values from a chosen window. The average is then used to estimate future demand.

### Exponential Smoothing

The system uses an alpha value to give more importance to recent sales data. A higher alpha reacts faster to recent changes.

When a forecast is generated, the backend also calculates:

- Average daily demand
- Likely stockout date
- Reorder-by date
- Suggested reorder quantity

Forecasts are saved in Supabase so they can be exported later.

## Reorder Alerts and Risk Score

A product needs attention when either condition is true:

- Current stock is at or below the product's reorder point.
- Current stock cannot cover expected demand during supplier lead time.

The dashboard risk score is calculated by the backend from the number of low-stock items and active reorder alerts. It is not a fixed frontend value.

## Reports

The Reports page calls the backend to download a CSV file containing current product information and saved forecast rows. This can be used for documentation, presentations, or further analysis.

## Running the System

From the project root:

```bash
npm run dev
```

This starts:

- Backend: `http://localhost:4000`
- Frontend: `http://127.0.0.1:5173`

For a production frontend build:

```bash
npm run build
```

## Environment Variables

Create `backend/.env` using `backend/.env.example` as a guide.

| Variable | Purpose |
| --- | --- |
| `PORT` | Backend port, normally `4000` |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase publishable key used by the backend |
| `JWT_SECRET` | Secret used to sign authentication tokens |
| `CLIENT_ORIGIN` | Allowed frontend origin for CORS |

Do not commit real environment values or authentication tokens to GitHub.
