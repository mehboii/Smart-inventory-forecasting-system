import { useEffect, useMemo, useState } from 'react';
import { Line, LineChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api/client.js';
import { parseSalesCsv } from '../utils/csv.js';

export default function Forecasting() {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [sales, setSales] = useState([]);
  const [manualSale, setManualSale] = useState({ date: '', quantity_sold: 0 });
  const [csvText, setCsvText] = useState('');
  const [settings, setSettings] = useState({ method: 'moving_average', horizon: 14, windowSize: 7, alpha: 0.35 });
  const [forecast, setForecast] = useState(null);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let active = true;
    async function loadProducts() {
      try {
        const data = await api('/products');
        if (!active) return;
        setProducts(data.products);
        setProductId((current) => data.products.some((product) => String(product.id) === current) ? current : String(data.products[0]?.id || ''));
        setLastUpdated(new Date());
      } catch (loadError) {
        if (active) setError(loadError.message);
      }
    }
    loadProducts();
    const interval = window.setInterval(loadProducts, 5000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!productId) return;
    let active = true;
    async function loadSales() {
      try {
        const data = await api(`/sales/${productId}`);
        if (active) {
          setSales(data.sales);
          setLastUpdated(new Date());
        }
      } catch (loadError) {
        if (active) setError(loadError.message);
      }
    }
    loadSales();
    const interval = window.setInterval(loadSales, 5000);
    setForecast(null);
    return () => { active = false; window.clearInterval(interval); };
  }, [productId]);

  const chartData = useMemo(() => {
    const actual = sales.map((row) => ({ date: row.date, actual: row.quantity_sold }));
    const predicted = forecast?.forecast?.map((row) => ({ date: row.forecast_date, forecast: row.predicted_demand })) || [];
    return [...actual, ...predicted];
  }, [sales, forecast]);

  async function addManualSale(event) {
    event.preventDefault();
    setError('');
    try {
      await api(`/sales/${productId}`, { method: 'POST', body: JSON.stringify(manualSale) });
      const data = await api(`/sales/${productId}`);
      setSales(data.sales);
    } catch (saleError) {
      setError(saleError.message);
    }
  }

  async function importCsv() {
    const rows = parseSalesCsv(csvText);
    if (!rows.length) {
      setError('CSV must contain lines like 2026-01-01,12');
      return;
    }
    await api(`/sales/${productId}/bulk`, { method: 'POST', body: JSON.stringify({ rows }) });
    setCsvText('');
    const data = await api(`/sales/${productId}`);
    setSales(data.sales);
  }

  async function runForecast() {
    setError('');
    try {
      const data = await api(`/forecasts/${productId}`, { method: 'POST', body: JSON.stringify(settings) });
      setForecast(data);
    } catch (forecastError) {
      setError(forecastError.message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Forecasting</h2>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-slate-500 dark:text-slate-400">Upload historical sales and forecast future demand.</p>
          <span className="live-status"><span className="live-dot" /> Live{lastUpdated ? ` | ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
        </div>
      </div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <section className="card grid gap-4 lg:grid-cols-4">
        <label className="text-sm font-medium">Product
          <select className="input mt-1" value={productId} onChange={(event) => setProductId(event.target.value)}>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Method
          <select className="input mt-1" value={settings.method} onChange={(event) => setSettings({ ...settings, method: event.target.value })}>
            <option value="moving_average">Simple Moving Average</option>
            <option value="exponential_smoothing">Exponential Smoothing</option>
          </select>
        </label>
        <label className="text-sm font-medium">Forecast days
          <input className="input mt-1" type="number" min="1" max="90" value={settings.horizon} onChange={(event) => setSettings({ ...settings, horizon: event.target.value })} />
        </label>
        <label className="text-sm font-medium">Window / Alpha
          <input className="input mt-1" value={settings.method === 'moving_average' ? settings.windowSize : settings.alpha} onChange={(event) => setSettings(settings.method === 'moving_average' ? { ...settings, windowSize: event.target.value } : { ...settings, alpha: event.target.value })} />
        </label>
        <button className="btn lg:col-span-4" disabled={!productId} onClick={runForecast}>Generate forecast</button>
      </section>
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <h3 className="text-lg font-semibold">Actual sales vs forecast</h3>
          <div className="mt-4 h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="actual" stroke="#2563eb" dot={false} />
                <Line type="monotone" dataKey="forecast" stroke="#dc2626" strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card space-y-4">
          <h3 className="text-lg font-semibold">Sales data</h3>
          <form className="grid gap-2" onSubmit={addManualSale}>
            <input className="input" type="date" value={manualSale.date} onChange={(event) => setManualSale({ ...manualSale, date: event.target.value })} required />
            <input className="input" type="number" min="0" value={manualSale.quantity_sold} onChange={(event) => setManualSale({ ...manualSale, quantity_sold: event.target.value })} />
            <button className="btn">Add sale</button>
          </form>
          <textarea className="input min-h-28" placeholder="CSV: date,quantity_sold" value={csvText} onChange={(event) => setCsvText(event.target.value)} />
          <button className="btn-secondary w-full" onClick={importCsv}>Import CSV rows</button>
          <p className="text-sm text-slate-500">{sales.length} historical sales rows loaded.</p>
        </section>
      </div>
      {forecast && (
        <section className="card">
          <h3 className="text-lg font-semibold">Forecast explanation</h3>
          <p className="mt-2 text-sm text-slate-700">{forecast.explanation}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div><p className="text-sm text-slate-500">Avg daily demand</p><p className="text-xl font-bold">{forecast.alert.averageDailyDemand}</p></div>
            <div><p className="text-sm text-slate-500">Stockout date</p><p className="text-xl font-bold">{forecast.alert.likelyStockoutDate || 'Not expected'}</p></div>
            <div><p className="text-sm text-slate-500">Reorder by</p><p className="text-xl font-bold">{forecast.alert.reorderByDate || 'Not needed'}</p></div>
            <div><p className="text-sm text-slate-500">Suggested quantity</p><p className="text-xl font-bold">{forecast.alert.suggestedReorderQuantity}</p></div>
          </div>
        </section>
      )}
    </div>
  );
}
