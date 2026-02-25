import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { isPast, format } from 'date-fns';
import { getTender, listBids, getErrorMessage, isTenderLockedError } from '../services/api';
import type { Tender, Bid, UserInfo } from '../services/types';
import BidUploadPanel from '../components/BidUploadPanel';
import BidListPanel from '../components/BidListPanel';
import TimeLockOverlay from '../components/TimeLockOverlay';

interface TenderDetailPageProps {
  userInfo: UserInfo | null;
}

export default function TenderDetailPage({ userInfo }: TenderDetailPageProps) {
  const { tenderId } = useParams<{ tenderId: string }>();
  const [tender, setTender] = useState<Tender | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(true);
  const [bidsError, setBidsError] = useState<string | null>(null);

  const fetchTender = useCallback(async () => {
    if (!tenderId) return;
    try {
      setLoading(true);
      const data = await getTender(tenderId);
      setTender(data);
      setIsLocked(!isPast(new Date(data.deadline)));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [tenderId]);

  const fetchBids = useCallback(async () => {
    if (!tenderId || !userInfo) return;
    if (userInfo.role === 'tv-bidder') return; // Bidders can't list bids
    try {
      setBidsError(null);
      const data = await listBids(tenderId);
      setBids(data);
    } catch (err) {
      if (isTenderLockedError(err)) {
        setBidsError(null); // Expected when locked, the overlay handles this
      } else {
        setBidsError(getErrorMessage(err));
      }
    }
  }, [tenderId, userInfo]);

  useEffect(() => {
    fetchTender();
  }, [fetchTender]);

  useEffect(() => {
    if (!isLocked && userInfo?.role !== 'tv-bidder') {
      fetchBids();
    }
  }, [isLocked, fetchBids, userInfo]);

  const handleUnlock = () => {
    setIsLocked(false);
    fetchTender();
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="skeleton h-8 w-64 mb-4" />
        <div className="skeleton h-4 w-96 mb-6" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  if (error || !tender) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-gray-700 mb-2">{error || 'Tender not found'}</p>
        <Link to="/" className="btn-secondary mt-4 inline-flex">← Back to Tenders</Link>
      </div>
    );
  }

  const statusBadge = {
    OPEN: 'badge-open',
    CLOSED: 'badge-closed',
    ARCHIVED: 'badge-archived',
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link to="/" className="text-sm text-vault-600 hover:text-vault-700 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Tenders
        </Link>
      </div>

      {/* Tender Header */}
      <div className="card mb-6">
        <div className="flex items-start justify-between mb-4">
          <span className={statusBadge[tender.status]}>{tender.status}</span>
          <div className="text-right">
            <p className="text-xs text-gray-400">Deadline</p>
            <p className="text-sm font-semibold text-gray-700 font-mono">
              {format(new Date(tender.deadline), 'MMM dd, yyyy HH:mm')}
            </p>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">{tender.title}</h1>
        <p className="text-gray-600 whitespace-pre-wrap">{tender.description}</p>

        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
          <span>Created: {format(new Date(tender.createdAt), 'MMM dd, yyyy HH:mm')}</span>
          <span>ID: <code className="font-mono">{tender.tenderId.slice(0, 12)}...</code></span>
        </div>
      </div>

      {/* Role-specific content */}
      {userInfo?.role === 'tv-bidder' && tender.status === 'OPEN' && isLocked && (
        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-vault-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Submit Your Bid
          </h2>
          <BidUploadPanel tenderId={tender.tenderId} onUploadComplete={fetchTender} />
        </div>
      )}

      {userInfo?.role === 'tv-bidder' && !isLocked && (
        <div className="card text-center py-8">
          <div className="w-12 h-12 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="font-semibold text-gray-900 mb-1">Submission Period Ended</p>
          <p className="text-sm text-gray-500">The deadline for this tender has passed</p>
        </div>
      )}

      {/* Bid List (Admin/Evaluator) */}
      {(userInfo?.role === 'tv-admin' || userInfo?.role === 'tv-evaluator') && (
        <div className="card relative overflow-hidden">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-vault-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            Submitted Bids
          </h2>

          {isLocked && (
            <TimeLockOverlay deadline={tender.deadline} onUnlock={handleUnlock} />
          )}

          {!isLocked && (
            <>
              {bidsError && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-sm text-red-700 mb-4">
                  {bidsError}
                </div>
              )}
              <BidListPanel
                tenderId={tender.tenderId}
                bids={bids}
                userInfo={userInfo}
                onRefresh={fetchBids}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
