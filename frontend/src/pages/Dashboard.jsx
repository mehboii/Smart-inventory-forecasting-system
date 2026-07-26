import { useEffect, useState } from 'react';
import { navigate } from '../App.jsx';
import { api } from '../api/client.js';

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [products, setProducts] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    Promise.all([api('/products/summary/metrics'), api('/products'), api('/forecasts/alerts/summary')]).then(([summary, productData, alertData]) => {
      setMetrics(summary);
      setProducts(productData.products);
      setAlerts(alertData.alerts);
    });
  }, []);

  const cards = [
    ['Total products', metrics?.totalProducts ?? 0],
    ['Low-stock items', metrics?.lowStockItems ?? 0],
    ['Due for reorder', metrics?.dueForReorder ?? 0],
    ['Inventory value', `$${metrics?.inventoryValue ?? 0}`]
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Dashboard</h2>
        <p className="text-slate-500">Current inventory status and reorder risk.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {cards.map(([label, value]) => (
          <div className="card" key={label}>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Inventory</h3>
            <button className="text-sm font-semibold text-blue-700" onClick={() => navigate('/inventory')}>Manage</button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr><th className="py-2">Name</th><th>SKU</th><th>Category</th><th>Stock</th><th>Reorder point</th></tr>
              </thead>
              <tbody>
                {products.slice(0, 8).map((product) => (
                  <tr className="border-t" key={product.id}>
                    <td className="py-2 font-medium">{product.name}</td>
                    <td>{product.sku}</td>
                    <td>{product.category}</td>
                    <td className={product.current_stock <= product.reorder_point ? 'font-bold text-red-600' : ''}>{product.current_stock}</td>
                    <td>{product.reorder_point}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card">
          <h3 className="text-lg font-semibold">Reorder alerts</h3>
          <div className="mt-4 space-y-3">
            {alerts.length === 0 && <p className="text-sm text-slate-500">No reorder alerts yet.</p>}
            {alerts.map((alert) => (
              <div className="rounded-lg bg-amber-50 p-3 text-sm" key={alert.id}>
                <p className="font-semibold text-amber-900">{alert.name}</p>
                <p className="text-amber-800">Suggested reorder: {alert.suggestedReorderQuantity} units</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
