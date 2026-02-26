import { useRef, useEffect } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes';
import './services/auth'; // Initialize Amplify config
import { useGSAP } from './hooks/useGSAP';
import { gsap } from './lib/gsap';

function App() {
  const { route, signOut, user } = useAuthenticator((context) => [context.route, context.user]);

  // =========================================================================
  // 1) AUTHENTICATED STATE: Render ONLY the Fullscreen Dashboard
  // =========================================================================
  if (route === 'authenticated') {
    return (
      <div className="min-h-screen w-full">
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AppRoutes signOut={signOut} user={user} />
        </BrowserRouter>
      </div>
    );
  }

  // =========================================================================
  // 2) UNAUTHENTICATED STATE: Render the Premium Split-Screen Login Layout
  // =========================================================================
  return <LoginPage />;
}

function LoginPage() {
  const pageRef    = useRef<HTMLDivElement>(null);
  const leftRef    = useRef<HTMLDivElement>(null);
  const scanRef    = useRef<HTMLDivElement>(null);
  const glyphsRef  = useRef<HTMLDivElement>(null);
  const formRef    = useRef<HTMLDivElement>(null);

  // Scanline animation — pure CSS would loop, GSAP gives us the precise feel
  useEffect(() => {
    if (!scanRef.current) return;
    gsap.fromTo(
      scanRef.current,
      { top: '-4px' },
      { top: '100%', duration: 4, ease: 'none', repeat: -1 }
    );
  }, []);

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    // Left panel: stagger each heading word
    const words = glyphsRef.current?.querySelectorAll('[data-word]');
    if (words?.length) {
      tl.fromTo(words,
        { opacity: 0, y: 32, skewY: 2 },
        { opacity: 1, y: 0, skewY: 0, duration: 0.9, stagger: 0.1 },
        0.15
      );
    }

    // Right panel: form entrance
    if (formRef.current) {
      tl.fromTo(formRef.current,
        { opacity: 0, x: 24 },
        { opacity: 1, x: 0, duration: 0.8 },
        0.35
      );
    }
  }, []);

  return (
    <div ref={pageRef} className="login-root">
      {/* ── SCANLINES TEXTURE (full page) ─────────────────── */}
      <div className="login-scanlines" aria-hidden="true" />

      {/* ══════════════════════════════════════════════════════
          LAYOUT: two columns
      ══════════════════════════════════════════════════════ */}
      <div className="login-layout">

        {/* ── LEFT PANEL ───────────────────────────────────── */}
        <div ref={leftRef} className="login-left">
          {/* Moving scan beam */}
          <div ref={scanRef} className="login-beam" aria-hidden="true" />

          {/* Corner accents */}
          <span className="login-corner login-corner--tl" aria-hidden="true" />
          <span className="login-corner login-corner--br" aria-hidden="true" />

          {/* Background grid */}
          <div className="login-grid-overlay" aria-hidden="true" />

          {/* Content */}
          <div ref={glyphsRef} className="login-left-content">

            {/* Logo mark */}
            <div className="login-logo-mark" data-word>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span>TENDERVAULT</span>
            </div>

            {/* Large headline */}
            <div className="login-headline">
              <div data-word className="login-headline-word">Enterprise</div>
              <div data-word className="login-headline-word login-headline-word--accent">Procurement,</div>
              <div data-word className="login-headline-word">Secured.</div>
            </div>

            {/* Sub copy */}
            <p data-word className="login-sub">
              The unified standard for high-stakes<br />
              government contracting.
            </p>

            {/* Stats bar */}
            <div data-word className="login-stats">
              <div className="login-stat">
                <span className="login-stat__value">99.9%</span>
                <span className="login-stat__label">Uptime SLA</span>
              </div>
              <div className="login-stat-divider" aria-hidden="true" />
              <div className="login-stat">
                <span className="login-stat__value">AES-256</span>
                <span className="login-stat__label">Encryption</span>
              </div>
              <div className="login-stat-divider" aria-hidden="true" />
              <div className="login-stat">
                <span className="login-stat__value">FedRAMP</span>
                <span className="login-stat__label">Certified</span>
              </div>
            </div>

            {/* Clearance badge */}
            <div data-word className="login-clearance">
              <span className="login-clearance__dot" aria-hidden="true" />
              SYSTEM OPERATIONAL · CLEARANCE REQUIRED
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ──────────────────────────────────── */}
        <div className="login-right">
          <div ref={formRef} className="login-form-wrap">

            {/* Mobile-only logo */}
            <div className="login-mobile-logo" aria-label="TenderVault">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span>TENDERVAULT</span>
            </div>

            {/* Header */}
            <div className="login-form-header">
              <div className="login-form-eyebrow">SECURE ACCESS PORTAL</div>
              <h2 className="login-form-title">Welcome Back</h2>
              <p className="login-form-desc">
                Authenticate with your enterprise credentials
                to access the procurement platform.
              </p>
            </div>

            {/* AWS Amplify widget — wrapped in card */}
            <div className="login-form-card">
              <div className="aws-amplify-wrapper w-full">
                <Authenticator
                  loginMechanisms={['email']}
                  signUpAttributes={['email']}
                  variation="default"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="login-form-footer">
              <span>Authorized users only · All actions are audited</span>
              <span className="login-form-footer__copy">© 2024 TenderVault Systems Inc.</span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
