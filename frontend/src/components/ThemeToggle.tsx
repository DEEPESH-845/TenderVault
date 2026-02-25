import { useTheme } from '../contexts/ThemeContext';

export default function ThemeToggle() {
  const { theme, setTheme, isDark } = useTheme();

  const handleToggle = () => {
    // If currently dark, switch to light. If light or system-light, switch to dark.
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <button
      onClick={handleToggle}
      className={`relative p-2 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-vault-400 focus:ring-offset-2 hover:bg-black/5 dark:hover:bg-white/10 ${
        isDark ? 'text-yellow-400' : 'text-slate-600 hover:text-slate-900'
      }`}
      aria-label="Toggle Dark Mode"
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
    >
      <div className="relative w-6 h-6 overflow-hidden">
        {/* Sun Icon (translates up and rotates out when dark) */}
        <svg
          className={`absolute inset-0 w-6 h-6 transform transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            isDark ? 'rotate-90 scale-0 opacity-0 -translate-y-4' : 'rotate-0 scale-100 opacity-100 translate-y-0'
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>

        {/* Moon Icon (rotates entirely from the bottom when becoming dark) */}
        <svg
          className={`absolute inset-0 w-6 h-6 transform transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            isDark ? 'rotate-0 scale-100 opacity-100 translate-y-0 text-cyan-300' : '-rotate-90 scale-0 opacity-0 translate-y-4'
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </div>
      
      {/* Subtle background glow effect when dark */}
      <div 
        className={`absolute inset-0 rounded-full bg-cyan-400/20 blur-md transition-opacity duration-500 pointer-events-none ${
          isDark ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </button>
  );
}
