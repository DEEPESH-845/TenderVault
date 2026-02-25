import { useState, useEffect } from 'react';
import { differenceInSeconds } from 'date-fns';

interface TimeLockOverlayProps {
  deadline: string;
  onUnlock: () => void;
}

export default function TimeLockOverlay({ deadline, onUnlock }: TimeLockOverlayProps) {
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const deadlineDate = new Date(deadline);

    const updateCountdown = () => {
      const now = new Date();
      const diff = differenceInSeconds(deadlineDate, now);

      if (diff <= 0) {
        setIsExpired(true);
        onUnlock();
        return;
      }

      setCountdown({
        hours: Math.floor(diff / 3600),
        minutes: Math.floor((diff % 3600) / 60),
        seconds: diff % 60,
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [deadline, onUnlock]);

  if (isExpired) return null;

  return (
    <div className="absolute inset-0 z-30 bg-gray-900/80 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center text-white">
      {/* Lock Icon */}
      <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-6 animate-lock-pulse ring-2 ring-white/20">
        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>

      {/* Title */}
      <h3 className="text-xl font-bold mb-2">Bids Sealed</h3>
      <p className="text-sm text-gray-300 mb-6">
        This tender's bids are locked until the submission deadline
      </p>

      {/* Countdown */}
      <div className="flex gap-3 mb-6">
        {[
          { value: countdown.hours, label: 'Hours' },
          { value: countdown.minutes, label: 'Minutes' },
          { value: countdown.seconds, label: 'Seconds' },
        ].map(({ value, label }) => (
          <div key={label} className="flex flex-col items-center">
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 min-w-[4rem] min-h-[4rem] border border-white/10 flex items-center justify-center">
              <span className="text-3xl font-mono font-bold tabular-nums">
                {String(value).padStart(2, '0')}
              </span>
            </div>
            <span className="text-xs text-gray-400 mt-1.5 uppercase tracking-wider text-center">{label}</span>
          </div>
        ))}
      </div>

      {/* Unlock time */}
      <p className="text-xs text-gray-400">
        Unlocks at: <span className="font-mono text-gray-300">{new Date(deadline).toLocaleString()}</span>
      </p>
    </div>
  );
}
