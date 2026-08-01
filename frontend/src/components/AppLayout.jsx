import { navigate } from '../App.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import WalkthroughModal from './WalkthroughModal.jsx';

const linkGroups = [
  { title: 'General', links: [['/', 'Overview'], ['/inventory', 'Inventory'], ['/forecasting', 'Forecasting']] },
  { title: 'Reports', links: [['/reports', 'Reports']] },
  { title: 'Support', links: [['/help', 'Help']] }
];

function SidebarIcon({ name }) {
  const paths = {
    Overview: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    Inventory: <><path d="m12 3 7 4-7 4-7-4 7-4Z" /><path d="M5 7v7l7 4 7-4V7" /><path d="M12 11v7" /></>,
    Forecasting: <><path d="m4 17 5-5 4 3 7-8" /><path d="M15 7h5v5" /></>,
    Reports: <><path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
    Help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.7 2.7 0 1 1 4.6 1.9c-1.1 1-2.1 1.4-2.1 3.1" /><path d="M12 17h.01" /></>,
    'Team access': <><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M17 10a2.5 2.5 0 1 0-1.7-4.3M17 14.5a4.8 4.8 0 0 1 3.5 4.5" /></>
  };

  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export function AppLayout({ children, currentPath }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="app-shell min-h-screen md:flex">
      <aside className="sidebar border-b p-4 md:min-h-screen md:w-72 md:border-b-0 md:border-r">
        <div className="flex items-start justify-between gap-3">
          <div className="brand-block">
            <h1 className="brand-mark"><span className="brand-icon" aria-hidden="true">✦</span>Smart<span>Inventory</span></h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{user?.name} | {user?.role}</p>
          </div>
          <button className="icon-button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
        <nav className="sidebar-nav mt-8">
          {linkGroups.map(({ title, links }) => (
            <div className="nav-group" key={title}>
              <p className="nav-group-title">{title}</p>
              <div className="grid gap-1">
                {links.map(([to, label]) => (
                  <button key={to} onClick={() => navigate(to)} className={`nav-link ${currentPath === to ? 'nav-link-active' : ''}`}>
                    <SidebarIcon name={label} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {user?.role === 'admin' && (
            <div className="nav-group">
              <p className="nav-group-title">Administration</p>
              <button onClick={() => navigate('/admin/users')} className={`nav-link ${currentPath === '/admin/users' ? 'nav-link-active' : ''}`}>
                <SidebarIcon name="Team access" /> Team access
              </button>
            </div>
          )}
        </nav>
        <div className="sidebar-footer">
          <button className="btn-secondary w-full" onClick={handleLogout}>Logout</button>
        </div>
      </aside>
      <main className="main-content flex-1 p-4 md:p-8">
        <header className="topbar mb-7">
          <div>
            <p className="eyebrow">Inventory intelligence</p>
            <h2 className="welcome-title">Welcome back, {user?.name || 'User'}</h2>
          </div>
          <div className="topbar-actions">
            <label className="search-field">
              <span className="search-mark">/</span>
              <input aria-label="Search inventory" placeholder="Search inventory" />
            </label>
            <span className="connection-status"><span className="live-dot" /> Connected</span>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>
      <WalkthroughModal />
    </div>
  );
}
