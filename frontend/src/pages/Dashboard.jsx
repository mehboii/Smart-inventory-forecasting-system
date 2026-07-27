import { useCallback, useEffect, useState } from 'react';
import { navigate } from '../App.jsx';
import { api } from '../api/client.js';
import { subscribeToInventoryUpdates } from '../api/live.js';
import { formatInr } from '../utils/currency.js';

const metricLabels = [
  ['Total products', 'Products'],
  ['Low-stock items', 'Stock'],
  ['Due for reorder', 'Reorder'],
  ['Inventory value', 'Value'],
  ['Open alerts', 'Alerts']
];

function MetricCard({ label, value, mark, index }) {
  return (
    <div className="metric-card">
      <div className={`metric-orb metric-orb-${index}`}><span>{mark}</span></div>
      <span className="metric-menu">:</span>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function RiskGauge({ score, level }) {
  const gaugeAngle = Math.max(0, Math.min(260, Math.round((score / 1000) * 260)));
  return (
    <section className="card risk-score-panel">
      <div className="panel-heading"><div><p className="eyebrow">Current state</p><h3>Risk Score</h3></div><span className="panel-menu">:</span></div>
      <div className="risk-gauge" style={{ '--gauge-angle': `${gaugeAngle}deg` }}>
        <div className="risk-gauge-inner"><span>Score</span><strong>{score}</strong><small>{level}</small></div>
      </div>
      <div className="gauge-scale"><span>0</span><span>1000</span></div>
    </section>
  );
}

function InventoryTrend({ trend }) {
  const max = Math.max(...trend.map((point) => Number(point.quantitySold) || 0), 1);
  const points = trend.map((point, index) => {
    const x = trend.length === 1 ? 50 : (index / (trend.length - 1)) * 100;
    const y = 92 - ((Number(point.quantitySold) || 0) / max) * 62;
    return `${x},${y}`;
  }).join(' ');

  if (!trend.length) return <p className="chart-empty">No sales history is available yet.</p>;

  return (
    <div className="trend-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Inventory level trend">
        <defs><linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#a855f7" stopOpacity="0.35" /><stop offset="1" stopColor="#a855f7" stopOpacity="0" /></linearGradient></defs>
        {[25, 48, 71].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} className="chart-grid-line" />)}
        <polygon points={`0,100 ${points} 100,100`} className="trend-area" />
        <polyline points={points} className="trend-line" />
      </svg>
      <div className="chart-labels">{trend.filter((_, index) => index % 2 === 0).map((point) => <span key={point.date}>{point.date.slice(5)}</span>)}</div>
    </div>
  );
}

function CategoryMix({ categories, totalProducts }) {
  const categoryColor = (index) => `hsl(${(index * 137.508) % 360} 70% 55%)`;
  let offset = 0;
  const stops = categories.map((category, index) => {
    const start = offset;
    offset += category.percentage;
    return `${categoryColor(index)} ${start}% ${offset}%`;
  });

  return (
    <section className="card category-panel">
      <div className="panel-heading"><div><p className="eyebrow">Product mix</p><h3>By category</h3></div><span className="panel-menu">:</span></div>
      <div className="category-content">
        <div className="category-donut" style={{ background: `conic-gradient(${stops.length ? stops.join(', ') : '#334155 0 100%'})` }}><div><strong>{totalProducts}</strong><span>Total</span></div></div>
        <div className="category-legend">{categories.map((category, index) => <div key={category.category}><span className="legend-dot" style={{ background: categoryColor(index) }} /> <span>{category.category}</span><strong>{category.percentage}%</strong></div>)}</div>
      </div>
    </section>
  );
}

export default function Dashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [syncError, setSyncError] = useState('');

  const loadDashboard = useCallback(async () => {
    try {
      const snapshot = await api(`/dashboard?refresh=${Date.now()}`);
      setDashboard(snapshot);
      setLastUpdated(new Date(snapshot.updatedAt));
      setSyncError('');
    } catch (error) {
      setLastUpdated(null);
      setSyncError(error.message || 'Dashboard data is unavailable.');
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const interval = window.setInterval(loadDashboard, 2000);
    return () => window.clearInterval(interval);
  }, [loadDashboard]);

  useEffect(() => subscribeToInventoryUpdates({
    onUpdate: loadDashboard,
    onStatusChange: setLiveConnected
  }), [loadDashboard]);

  const metrics = dashboard?.metrics;
  const products = dashboard?.products || [];
  const alerts = dashboard?.alerts || [];
  const salesTrend = dashboard?.salesTrend || [];
  const categoryMix = dashboard?.categoryMix || [];
  const cardValues = [
    metrics?.totalProducts ?? 0,
    metrics?.lowStockItems ?? 0,
    metrics?.dueForReorder ?? 0,
    formatInr(metrics?.inventoryValue),
    metrics?.openAlerts ?? 0
  ];

  return (
    <div className="dashboard-page liquid-glass-dashboard">
      <div className="page-heading dashboard-heading">
        <div><p className="eyebrow">Workspace / Overview</p><h2>Current Risk</h2></div>
        <div className="heading-controls"><span className="period-control">Daily <span>v</span></span><span className={`live-status ${liveConnected ? '' : 'live-status-pending'}`}><span className="live-dot" /> {liveConnected ? 'Live' : 'Connecting'}{lastUpdated ? ` | ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</span></div>
      </div>
      {syncError && <p className="dashboard-sync-error">{syncError}</p>}

      <div className="risk-layout">
        <section className="card current-risk-panel">
          <div className="metric-grid">{metricLabels.map(([label, mark], index) => <MetricCard key={label} label={label} value={cardValues[index]} mark={mark.slice(0, 1)} index={index} />)}</div>
        </section>
        <RiskGauge score={dashboard?.risk?.score ?? 0} level={dashboard?.risk?.level ?? 'Low'} />
      </div>

      <div className="analysis-layout">
        <section className="card trend-panel">
          <div className="panel-heading"><div><p className="eyebrow">Live sales history</p><h3>Sales Trend</h3></div><span className="period-control">Last 14 days</span></div>
          <InventoryTrend trend={salesTrend} />
        </section>
        <CategoryMix categories={categoryMix} totalProducts={metrics?.totalProducts ?? 0} />
      </div>

      <section className="card details-panel">
        <div className="panel-heading"><div><p className="eyebrow">Operational feed</p><h3>Inventory Details</h3></div><button className="panel-action" onClick={() => navigate('/inventory')}>View all</button></div>
        <div className="details-table-wrap">
          <table className="details-table w-full text-left text-sm">
            <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Stock</th><th>Reorder point</th><th>Status</th></tr></thead>
            <tbody>{products.slice(0, 6).map((product) => {
              const low = product.current_stock <= product.reorder_point;
              return <tr key={product.id}><td className="font-medium">{product.name}</td><td>{product.sku}</td><td>{product.category}</td><td>{product.current_stock}</td><td>{product.reorder_point}</td><td><span className={`status-label ${low ? 'status-warning' : 'status-ready'}`}>{low ? 'Review' : 'Healthy'}</span></td></tr>;
            })}</tbody>
          </table>
        </div>
      </section>

      <section className="card alerts-panel dashboard-alerts">
        <div className="panel-heading"><div><p className="eyebrow">Priority queue</p><h3>Reorder Alerts</h3></div><span className="risk-badge">{alerts.length} open</span></div>
        <div className="alert-list">{alerts.slice(0, 5).map((alert) => <div className="alert-row" key={alert.id}><span className="alert-mark">!</span><div><strong>{alert.name}</strong><span>Suggested reorder: {alert.suggestedReorderQuantity} units</span></div></div>)}{alerts.length === 0 && <p className="text-sm text-slate-500">No reorder alerts yet.</p>}</div>
      </section>
    </div>
  );
}
