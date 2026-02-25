import { Authenticator } from '@aws-amplify/ui-react';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes';
import './services/auth'; // Initialize Amplify config

function App() {
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
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#0d7ff2] rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500 rounded-full blur-[120px]"></div>
          </div>
          <div className="relative z-10 p-12 max-w-xl">
             <h1 className="text-5xl font-bold text-white mb-6 leading-[1.1]">Enterprise Procurement, Secured.</h1>
             <p className="text-slate-300 text-xl leading-relaxed">The unified standard for high-stakes government contracting and digital asset custody.</p>
             <div className="mt-12 flex gap-8">
                <div className="flex flex-col"><span className="text-3xl font-bold text-[#0d7ff2]">99.9%</span><span className="text-slate-400 text-sm uppercase tracking-widest mt-1">Uptime</span></div>
                <div className="flex flex-col"><span className="text-3xl font-bold text-[#0d7ff2]">AES-256</span><span className="text-slate-400 text-sm uppercase tracking-widest mt-1">Encryption</span></div>
             </div>
          </div>
        </div>

        {/* RIGHT LOGIN CONTAINER */}
        <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-white lg:bg-[#101922]">
           
           <div 
             className="w-full max-w-[460px] p-6 sm:p-8 rounded-xl lg:shadow-2xl border border-slate-200 lg:border-slate-800/50"
             style={{ background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
           >
              <div className="mb-6 text-center lg:text-left">
                 <h2 className="text-2xl font-bold text-slate-900 lg:text-white mb-2">Welcome Back</h2>
                 <p className="text-slate-500 lg:text-slate-400 text-sm">Sign in with your enterprise credentials to access the platform.</p>
              </div>

              {/* AWS AMPLIFY AUTHENTICATOR WIDGET */}
              <div 
                className="aws-amplify-wrapper" 
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
                 >
                   {({ signOut, user }) => (
                     /* DASHBOARD OVERLAY: Rendered ONLY when logged in */
                     <div className="fixed inset-0 bg-gray-50 z-50 overflow-auto text-slate-900">
                       <BrowserRouter>
                         <AppRoutes signOut={signOut!} user={user!} />
                       </BrowserRouter>
                     </div>
                   )}
                 </Authenticator>
              </div>

              <div className="mt-6 text-center border-t border-slate-200 lg:border-slate-800/50 pt-6">
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
