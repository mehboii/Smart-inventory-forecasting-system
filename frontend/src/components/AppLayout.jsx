import { navigate } from '../App.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import WalkthroughModal from './WalkthroughModal.jsx';

const links = [
  ['/', 'Dashboard'],
  ['/inventory', 'Inventory'],
  ['/forecasting', 'Forecasting'],
  ['/reports', 'Reports'],
  ['/help', 'Help']
];

export function AppLayout({ children, currentPath }) {
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-white p-4 md:min-h-screen md:w-72 md:border-b-0 md:border-r">
        <h1 className="text-xl font-bold text-blue-700">Smart Inventory</h1>
        <p className="mt-1 text-sm text-slate-500">{user?.name} · {user?.role}</p>
        <nav className="mt-6 grid gap-2">
          {links.map(([to, label]) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className={`rounded-lg px-3 py-2 text-left text-sm font-medium ${currentPath === to ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <button className="btn-secondary mt-6 w-full" onClick={handleLogout}>Logout</button>
      </aside>
      <main className="flex-1 p-4 md:p-8">
        {children}
      </main>
      <WalkthroughModal />
    </div>
  );
}
