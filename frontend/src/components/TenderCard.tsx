import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow, isPast, differenceInSeconds } from 'date-fns';
import type { Tender, UserInfo } from '../services/types';

interface TenderCardProps {
  tender: Tender;
  userInfo: UserInfo | null;
}

export default function TenderCard({ tender, userInfo }: TenderCardProps) {
  const [countdown, setCountdown] = useState('');
  const deadlineDate = new Date(tender.deadline);
  const isLocked = !isPast(deadlineDate);

  useEffect(() => {
    if (!isLocked) {
      setCountdown('Deadline passed');
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const diff = differenceInSeconds(deadlineDate, now);
      if (diff <= 0) {
        setCountdown('Deadline passed');
        return;
      }
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      setCountdown(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [deadlineDate, isLocked]);

  const statusBadge = {
    OPEN: 'badge-open',
    CLOSED: 'badge-closed',
    ARCHIVED: 'badge-archived',
  };

  return (
    <Link to={`/tenders/${tender.tenderId}`} className="block">
      <div className="card group cursor-pointer hover:border-vault-200 hover:shadow-vault-100/50 dark:hover:border-vault-500/30 dark:hover:shadow-vault-900/30">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <span className={statusBadge[tender.status]}>
            {tender.status}
          </span>
          {isLocked && tender.status === 'OPEN' && (
            <div className="flex items-center gap-1.5 text-amber-600 animate-lock-pulse">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-bold font-mono">{countdown}</span>
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 group-hover:text-vault-700 dark:group-hover:text-vault-400 transition-colors line-clamp-2">
          {tender.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4 line-clamp-2">
          {tender.description}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-slate-800">
          <span className="text-xs text-gray-400 dark:text-slate-500">
            Created {formatDistanceToNow(new Date(tender.createdAt), { addSuffix: true })}
          </span>

          {/* Role-specific action hint */}
          {userInfo?.role === 'tv-bidder' && tender.status === 'OPEN' && isLocked && (
            <span className="text-xs font-semibold text-vault-600 bg-vault-50 dark:bg-vault-500/10 dark:text-vault-400 px-2.5 py-1 rounded-full">
              Submit Bid →
            </span>
          )}
          {userInfo?.role === 'tv-evaluator' && !isLocked && tender.status === 'CLOSED' && (
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 px-2.5 py-1 rounded-full">
              View Bids →
            </span>
          )}
          {userInfo?.role === 'tv-evaluator' && isLocked && (
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400 px-2.5 py-1 rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              Sealed
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
