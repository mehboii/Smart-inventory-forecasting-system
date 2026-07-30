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

const configuredBasePath = (import.meta.env.VITE_BASE_PATH || '').replace(/^\/|\/$/g, '');
const basePath = configuredBasePath ? `/${configuredBasePath}` : '';

function stripBasePath(pathname) {
  if (!basePath) return pathname || '/';
  if (pathname === basePath) return '/';
  if (pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length) || '/';
  return pathname || '/';
}

function withBasePath(path) {
  if (!basePath) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return normalizedPath === '/' ? `${basePath}/` : `${basePath}${normalizedPath}`;
}

function currentPath() {
  return stripBasePath(window.location.pathname || '/');
}

export function navigate(path) {
  window.history.pushState({}, '', withBasePath(path));
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
