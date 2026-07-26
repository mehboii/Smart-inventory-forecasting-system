export default function Help() {
  const steps = [
    ['1. Login or register', 'Use the demo account or create a new account. The app stores your session with JWT authentication.'],
    ['2. Add products', 'Open Inventory and enter the product name, SKU, category, current stock, reorder point, unit cost, and lead time.'],
    ['3. Add sales history', 'Open Forecasting, choose a product, then add manual rows or paste CSV rows using date,quantity_sold format.'],
    ['4. Generate a forecast', 'Choose Simple Moving Average for an easy average-based forecast or Exponential Smoothing to emphasize recent demand.'],
    ['5. Read the chart', 'Blue points show historical sales. The red dashed line shows predicted demand for the selected horizon.'],
    ['6. Interpret alerts', 'A reorder alert means current stock is at or below the reorder point or may not cover expected demand during lead time.'],
    ['7. Export reports', 'Open Reports to download a CSV containing current inventory and forecast rows for documentation or presentation.']
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Help</h2>
        <p className="text-slate-500">How to use the Smart Inventory Forecasting System.</p>
      </div>
      <section className="card">
        <div className="grid gap-4 md:grid-cols-2">
          {steps.map(([title, description]) => (
            <div className="rounded-xl border border-slate-200 p-4" key={title}>
              <h3 className="font-semibold text-blue-700">{title}</h3>
              <p className="mt-2 text-sm text-slate-600">{description}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="card">
        <h3 className="text-lg font-semibold">Forecasting methods</h3>
        <p className="mt-2 text-sm text-slate-600">
          Simple Moving Average averages the most recent sales window and is easiest to explain in a demo. Exponential Smoothing applies a weighting factor called alpha so recent sales influence the result more strongly than older sales.
        </p>
      </section>
    </div>
  );
}
