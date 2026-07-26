import { API_BASE_URL } from '../api/client.js';

export default function Reports() {
  async function downloadReport() {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/reports/inventory-forecast.csv`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'inventory_forecast.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Reports</h2>
        <p className="text-slate-500">Export inventory and generated forecast data as CSV.</p>
      </div>
      <section className="card">
        <h3 className="text-lg font-semibold">Inventory + Forecast CSV</h3>
        <p className="mt-2 text-sm text-slate-600">Generate forecasts first, then export the current product list and saved forecast rows.</p>
        <button className="btn mt-4" onClick={downloadReport}>Download CSV</button>
      </section>
    </div>
  );
}
