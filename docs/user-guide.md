# Smart Inventory Forecasting System User Guide.

## Login

Register an account to begin. The application displays only the products and
sales entered by the signed-in user.

## Dashboard

The dashboard summarizes inventory health:

- Total products: number of products currently tracked.
- Low-stock items: products where stock is at or below the reorder point.
- Due for reorder: products nearing their reorder threshold.
- Inventory value: estimated value from current stock multiplied by unit cost.

## Inventory

Use the Inventory page to add, edit, or delete products.

Important fields:

- SKU uniquely identifies a product for your account.
- Current stock is the number of units on hand.
- Reorder point is the minimum stock level before replenishment should be considered.
- Lead time is the number of days it usually takes to restock.

## Sales History

Open Forecasting and select a product. Add sales one row at a time, or paste CSV rows.

CSV format:

```csv
2026-01-01,12
2026-01-02,9
```

Each row means `date,quantity_sold`.

## Forecasting

Choose one method:

- Simple Moving Average: averages recent sales over a selected window.
- Exponential Smoothing: gives more importance to recent sales using alpha.

Set the forecast horizon to choose how many future days to predict.

## Reading the Chart

- Blue line: historical actual sales.
- Red dashed line: forecasted future demand.

The forecast explanation panel states how the selected method calculated the prediction.

## Reorder Alerts

The system flags a product when current stock is already below the reorder point or predicted demand during lead time could consume available stock.

The forecast result includes:

- Average daily demand.
- Likely stockout date.
- Suggested reorder-by date.
- Suggested reorder quantity.

## Reports

Open Reports and click Download CSV after generating forecasts. The report includes products and saved forecast rows.
