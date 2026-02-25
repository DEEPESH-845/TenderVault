import { Routes, Route, Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getCurrentUser, signOut as authSignOut } from './services/auth';
import type { UserInfo } from './services/types';
import TenderListPage from './pages/TenderListPage';
import TenderDetailPage from './pages/TenderDetailPage';
import AuditLogPage from './pages/AuditLogPage';
import ThemeToggle from './components/ThemeToggle';

interface AppRoutesProps {
  signOut: () => void;
  user: any;
}

function Layout({ userInfo, onSignOut }: { userInfo: UserInfo | null; onSignOut: () => void }) {
  const location = useLocation();

  const roleBadge = {
    'tv-admin': { label: 'Officer', className: 'bg-violet-100 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-500/20' },
    'tv-bidder': { label: 'Bidder', className: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20' },
    'tv-evaluator': { label: 'Evaluator', className: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20' },
  };

  const badge = userInfo ? roleBadge[userInfo.role] : null;

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800 sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 bg-gradient-to-br from-vault-500 to-vault-700 rounded-xl flex items-center justify-center shadow-lg shadow-vault-500/30 group-hover:shadow-vault-500/50 transition-all dark:from-vault-600 dark:to-vault-800">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <span className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight transition-colors duration-300">
                Tender<span className="text-vault-600 dark:text-vault-400">Vault</span>
              </span>
            </Link>

            {/* Nav Links */}
            <div className="hidden sm:flex items-center gap-1">
              <Link
                to="/"
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  location.pathname === '/'
                    ? 'bg-vault-50 text-vault-700 dark:bg-vault-500/10 dark:text-vault-400'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50'
                }`}
              >
                Tenders
              </Link>
              {userInfo?.role === 'tv-admin' && (
                <Link
                  to="/audit-logs"
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    location.pathname === '/audit-logs'
                      ? 'bg-vault-50 text-vault-700 dark:bg-vault-500/10 dark:text-vault-400'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50'
                  }`}
                >
                  Audit Logs
                </Link>
              )}
            </div>

            {/* User Info & Toggle */}
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <div className="hidden md:flex items-center gap-3">
                {badge && (
                  <span className={`badge ${badge.className}`}>
                    {badge.label}
                  </span>
                )}
                <span className="text-sm text-gray-500 dark:text-slate-400 transition-colors duration-300">
                  {userInfo?.email}
                </span>
              </div>
              <button
                onClick={onSignOut}
                className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 dark:text-slate-400 dark:hover:text-red-400 rounded-lg transition-all"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}

export function AppRoutes({ signOut, user }: AppRoutesProps) {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  useEffect(() => {
    getCurrentUser().then(setUserInfo).catch(console.error);
  }, [user]);

  const handleSignOut = () => {
    authSignOut().then(() => signOut());
  };

  return (
    <Routes>
      <Route element={<Layout userInfo={userInfo} onSignOut={handleSignOut} />}>
        <Route index element={<TenderListPage userInfo={userInfo} />} />
        <Route path="/tenders/:tenderId" element={<TenderDetailPage userInfo={userInfo} />} />
        {userInfo?.role === 'tv-admin' && (
          <Route path="/audit-logs" element={<AuditLogPage />} />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
