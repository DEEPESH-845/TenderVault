import { useRef } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes';
import './services/auth'; // Initialize Amplify config
import GridBackground from './components/GridBackground';
import AnimatedCounter from './components/AnimatedCounter';
import { useGSAP } from './hooks/useGSAP';
import { gsap } from './lib/gsap';

function App() {
  const { route, signOut, user } = useAuthenticator((context) => [context.route, context.user]);

  // =========================================================================
  // 1) AUTHENTICATED STATE: Render ONLY the Fullscreen Dashboard
  // =========================================================================
  if (route === 'authenticated') {
    return (
      <div className="min-h-screen w-full bg-slate-50 dark:bg-[#101922] text-slate-900 dark:text-slate-100 transition-colors duration-300">
        <BrowserRouter>
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
  const heroRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // Hero text staggered entrance
    const heroElements = heroRef.current?.querySelectorAll('[data-animate]');
    if (heroElements?.length) {
      gsap.fromTo(
        heroElements,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out', delay: 0.2 }
      );
    }

    // Login card glassmorphism entrance
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 30, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'power3.out', delay: 0.4 }
      );
    }
  }, []);

  return (
    <div className="bg-[#101922] font-sans text-slate-100 min-h-screen flex flex-col pt-0 relative">
      {/* HEADER */}
      <header className="flex items-center bg-transparent p-6 justify-between absolute top-0 w-full z-10">
        <div className="flex items-center gap-2">
           <div className="text-[#0d7ff2] flex h-10 w-10 shrink-0 items-center justify-center bg-[#0d7ff2]/10 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
           </div>
           <h2 className="text-slate-100 text-xl font-bold leading-tight tracking-tight">TenderVault</h2>
        </div>
      </header>

      {/* MAIN SPLIT SCREEN */}
      <main className="flex-1 flex flex-col lg:flex-row relative">

        {/* LEFT NAVY/CYAN HERO */}
        <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden" style={{ background: 'radial-gradient(circle at top right, #0d7ff233, transparent), linear-gradient(135deg, #101922 0%, #0a2e52 100%)' }}>
          <GridBackground />
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#0d7ff2] rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500 rounded-full blur-[120px]"></div>
          </div>
          <div ref={heroRef} className="relative z-10 p-12 max-w-xl">
             <h1 data-animate className="text-5xl font-bold text-white mb-6 leading-[1.1]">Enterprise Procurement, Secured.</h1>
             <p data-animate className="text-slate-300 text-xl leading-relaxed">The unified standard for high-stakes government contracting and digital asset custody.</p>
             <div data-animate className="mt-12 flex gap-8">
                <div className="flex flex-col">
                  <AnimatedCounter value={99.9} suffix="%" decimals={1} duration={2.5} className="text-3xl font-bold text-[#0d7ff2] tabular-nums" />
                  <span className="text-slate-400 text-sm uppercase tracking-widest mt-1">Uptime</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-3xl font-bold text-[#0d7ff2]">AES-256</span>
                  <span className="text-slate-400 text-sm uppercase tracking-widest mt-1">Encryption</span>
                </div>
             </div>
          </div>
        </div>

        {/* RIGHT LOGIN CONTAINER - Perfect Visual Centering */}
        <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-white lg:bg-[#101922] w-full min-h-screen">

           <div
             ref={cardRef}
             className="w-full max-w-[460px] p-6 sm:p-8 rounded-xl lg:shadow-2xl border border-slate-200 lg:border-slate-800/50 flex flex-col items-center card-glass lg:bg-white/[0.03]"
             style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
           >
              <div className="mb-6 w-full text-center lg:text-left">
                 <h2 className="text-2xl font-bold text-slate-900 lg:text-white mb-2">Welcome Back</h2>
                 <p className="text-slate-500 lg:text-slate-400 text-sm">Sign in with your enterprise credentials to access the platform.</p>
              </div>

              {/* AWS AMPLIFY AUTHENTICATOR WIDGET */}
              <div
                className="aws-amplify-wrapper w-full flex justify-center"
                style={{
                  '--amplify-components-authenticator-router-box-shadow': 'none',
                  '--amplify-components-authenticator-router-border-width': '0',
                  '--amplify-colors-background-primary': 'transparent',
                  '--amplify-colors-background-secondary': 'transparent',
                  '--amplify-colors-font-primary': 'inherit'
                } as React.CSSProperties}
              >
                 <Authenticator
                   loginMechanisms={['email']}
                   signUpAttributes={['email']}
                   variation="default"
                 />
              </div>

              <div className="mt-6 w-full text-center border-t border-slate-200 lg:border-slate-800/50 pt-6">
                 <p className="text-xs text-slate-500">
                     Authorized users only. All actions are audited.
                     <br className="my-1"/>
                     © 2024 TenderVault Systems Inc. FedRAMP High.
                 </p>
              </div>

           </div>
        </div>
      </main>
    </div>
  );
}

export default App;
