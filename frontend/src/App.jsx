import { useEffect, useState } from 'react';
import { AppLayout } from './components/AppLayout.jsx';
import { useAuth } from './context/AuthContext.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Forecasting from './pages/Forecasting.jsx';
import Help from './pages/Help.jsx';
import Inventory from './pages/Inventory.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Reports from './pages/Reports.jsx';

const routes = {
  '/': Dashboard,
  '/inventory': Inventory,
  '/forecasting': Forecasting,
  '/reports': Reports,
  '/help': Help,
  '/login': Login,
  '/register': Register
};

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function currentPath() {
  const path = window.location.pathname;
  if (basePath && path.startsWith(basePath)) return path.slice(basePath.length) || '/';
  return path || '/';
}

export function navigate(path) {
  window.history.pushState({}, '', `${basePath}${path}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function App() {
  const { user, loading } = useAuth();
  const [path, setPath] = useState(currentPath());

  useEffect(() => {
    const syncPath = () => setPath(currentPath());
    window.addEventListener('popstate', syncPath);
    return () => window.removeEventListener('popstate', syncPath);
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading session...</div>;

  if (!user && path !== '/login' && path !== '/register') {
    navigate('/login');
    return null;
  }

  if (user && (path === '/login' || path === '/register')) {
    navigate('/');
    return null;
  }

  if (path === '/login') return <Login />;
  if (path === '/register') return <Register />;

  const Page = routes[path] || Dashboard;
  return (
    <AppLayout currentPath={path}>
      <Page />
    </AppLayout>
  );
}
