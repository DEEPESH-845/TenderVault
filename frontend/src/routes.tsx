import { Routes, Route, Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { getCurrentUser, signOut as authSignOut } from './services/auth';
import type { UserInfo } from './services/types';
import TenderListPage from './pages/TenderListPage';
import TenderDetailPage from './pages/TenderDetailPage';
import AuditLogPage from './pages/AuditLogPage';
import ThemeToggle from './components/ThemeToggle';
import { useGSAP } from './hooks/useGSAP';
import { gsap } from './lib/gsap';

interface AppRoutesProps {
  signOut: () => void;
  user: any;
}

function Layout({ userInfo, onSignOut }: { userInfo: UserInfo | null; onSignOut: () => void }) {
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const logoRef = useRef<HTMLAnchorElement>(null);

  // Nav slide-down entrance animation
  useGSAP(() => {
    if (navRef.current) {
      gsap.fromTo(
        navRef.current,
        { y: -20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }
      );
    }
  }, []);

  // Logo hover micro-interaction
  const handleLogoEnter = () => {
    if (logoRef.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.to(logoRef.current.querySelector('.logo-icon'), {
        scale: 1.1,
        duration: 0.3,
        ease: 'power2.out',
      });
    }
  };

  const handleLogoLeave = () => {
    if (logoRef.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.to(logoRef.current.querySelector('.logo-icon'), {
        scale: 1,
        duration: 0.3,
        ease: 'power2.out',
      });
    }
  };

  const roleBadge = {
    'tv-admin': { label: 'Officer', className: 'db-role-badge db-role-badge--admin' },
    'tv-bidder': { label: 'Bidder', className: 'db-role-badge db-role-badge--bidder' },
    'tv-evaluator': { label: 'Evaluator', className: 'db-role-badge db-role-badge--evaluator' },
  };

  const badge = userInfo ? roleBadge[userInfo.role] : null;

  return (
    <div className="db-shell">
      {/* Navigation */}
      <nav ref={navRef} className="db-nav">
        <div className="db-nav__inner">
          <div className="db-nav__row">

            {/* Logo */}
            <Link
              ref={logoRef}
              to="/"
              className="db-nav__logo"
              onMouseEnter={handleLogoEnter}
              onMouseLeave={handleLogoLeave}
            >
              <div className="logo-icon db-nav__logo-icon">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <span className="db-nav__logo-text">
                Tender<span className="db-nav__logo-accent">Vault</span>
              </span>
            </Link>

            {/* Nav Links */}
            <div className="db-nav__links">
              <Link
                to="/"
                className={`db-nav__link ${location.pathname === '/' ? 'db-nav__link--active' : ''}`}
              >
                Tenders
              </Link>
              {userInfo?.role === 'tv-admin' && (
                <Link
                  to="/audit-logs"
                  className={`db-nav__link ${location.pathname === '/audit-logs' ? 'db-nav__link--active' : ''}`}
                >
                  Audit Logs
                </Link>
              )}
            </div>

            {/* User Info & Toggle */}
            <div className="db-nav__actions">
              <ThemeToggle />
              <div className="db-nav__user">
                {badge && (
                  <span className={badge.className}>
                    {badge.label}
                  </span>
                )}
                <span className="db-nav__email">
                  {userInfo?.email}
                </span>
              </div>
              <button onClick={onSignOut} className="db-nav__signout">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="db-main">
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
