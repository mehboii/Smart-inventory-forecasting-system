import { useAuth } from '../context/AuthContext.jsx';

export default function WalkthroughModal() {
  const { user, completeWalkthrough } = useAuth();
  if (!user || user.has_seen_walkthrough) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4">
      <div className="max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-2xl font-bold">First-time walkthrough</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>Add products with SKU, stock, reorder point, unit cost, and supplier lead time.</li>
          <li>Upload or enter dated sales quantities for each product.</li>
          <li>Generate a moving average or exponential smoothing forecast.</li>
          <li>Use alerts to identify stock that may run out before restock arrives.</li>
          <li>Export inventory and forecast data from Reports for submission or review.</li>
        </ol>
        <button className="btn mt-5 w-full" onClick={completeWalkthrough}>Start using the system</button>
      </div>
    </div>
  );
}
