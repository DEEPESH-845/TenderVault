import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow, isPast, differenceInSeconds } from 'date-fns';
import type { Tender, UserInfo } from '../services/types';
import { useScrollReveal } from '../hooks/useScrollReveal';

interface TenderCardProps {
  tender: Tender;
  userInfo: UserInfo | null;
}

export default function TenderCard({ tender, userInfo }: TenderCardProps) {
  const [countdown, setCountdown] = useState('');
  const deadlineDate = new Date(tender.deadline);
  const isLocked = !isPast(deadlineDate);
  const revealRef = useScrollReveal<HTMLDivElement>();

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

  const statusMeta = {
    OPEN:     { cls: 'tc-status--open',     dot: 'tc-dot--open' },
    CLOSED:   { cls: 'tc-status--closed',   dot: 'tc-dot--closed' },
    ARCHIVED: { cls: 'tc-status--archived', dot: 'tc-dot--archived' },
  };

  const meta = statusMeta[tender.status];

  return (
    <div ref={revealRef}>
      <Link to={`/tenders/${tender.tenderId}`} className="block">
        <div className="tc">

          {/* Accent bar */}
          <div className={`tc__bar tc__bar--${tender.status.toLowerCase()}`} aria-hidden="true" />

          {/* Header row */}
          <div className="tc__head">
            <div className="tc__status-row">
              <span className={`tc__dot ${meta.dot}`} aria-hidden="true" />
              <span className={`tc__status ${meta.cls}`}>{tender.status}</span>
            </div>

            {/* Live countdown */}
            {isLocked && tender.status === 'OPEN' && (
              <div className="tc__countdown animate-lock-pulse">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="tc__countdown-time tabular-nums">{countdown}</span>
              </div>
            )}
          </div>

          {/* Title */}
          <h3 className="tc__title">
            {tender.title}
          </h3>

          {/* Description */}
          <p className="tc__desc">
            {tender.description}
          </p>

          {/* Footer */}
          <div className="tc__foot">
            <span className="tc__age">
              {formatDistanceToNow(new Date(tender.createdAt), { addSuffix: true })}
            </span>

            {/* Role-specific CTA */}
            {userInfo?.role === 'tv-bidder' && tender.status === 'OPEN' && isLocked && (
              <span className="tc__cta tc__cta--bid">Submit Bid →</span>
            )}
            {userInfo?.role === 'tv-evaluator' && !isLocked && tender.status === 'CLOSED' && (
              <span className="tc__cta tc__cta--eval">View Bids →</span>
            )}
            {userInfo?.role === 'tv-evaluator' && isLocked && (
              <span className="tc__cta tc__cta--sealed">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                Sealed
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
