import { navigate } from '../App.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import WalkthroughModal from './WalkthroughModal.jsx';

const linkGroups = [
  { title: 'General', links: [['/', 'Overview'], ['/inventory', 'Inventory'], ['/forecasting', 'Forecasting']] },
  { title: 'Reports', links: [['/reports', 'Reports']] },
  { title: 'Support', links: [['/help', 'Help']] }
];

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
          <div>
            <h1 className="brand-mark">Smart<span>Inventory</span></h1>
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
                    <span className="nav-icon">{label.slice(0, 2).toUpperCase()}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
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
