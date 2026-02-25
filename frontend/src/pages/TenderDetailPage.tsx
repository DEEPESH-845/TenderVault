import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { isPast, format } from 'date-fns';
import { getTender, listBids, getErrorMessage, isTenderLockedError, deleteTender } from '../services/api';
import type { Tender, Bid, UserInfo } from '../services/types';
import BidUploadPanel from '../components/BidUploadPanel';
import BidListPanel from '../components/BidListPanel';
import TimeLockOverlay from '../components/TimeLockOverlay';
import AnimatedPage from '../components/AnimatedPage';
import ScrollReveal from '../components/ScrollReveal';

interface TenderDetailPageProps {
  userInfo: UserInfo | null;
}

export default function TenderDetailPage({ userInfo }: TenderDetailPageProps) {
  const { tenderId } = useParams<{ tenderId: string }>();
  const navigate = useNavigate();
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

  const handleDelete = async () => {
    if (!tenderId) return;
    if (window.confirm('WARNING: Are you sure you want to permanently delete this tender? This action cannot be undone.')) {
      try {
        await deleteTender(tenderId);
        navigate('/');
      } catch (err) {
        alert('Failed to delete tender: ' + getErrorMessage(err));
      }
    }
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
        <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-gray-700 dark:text-slate-200 mb-2">{error || 'Tender not found'}</p>
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
    <AnimatedPage>
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link to="/" className="text-sm text-vault-600 hover:text-vault-700 dark:text-vault-400 dark:hover:text-vault-300 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to Tenders
          </Link>
        </div>

        {/* Tender Header */}
        <ScrollReveal>
          <div className="card mb-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className={statusBadge[tender.status]}>{tender.status}</span>
                {userInfo?.role === 'tv-admin' && (
                  <button
                    onClick={handleDelete}
                    className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 px-3 py-1 rounded-full border border-red-200 dark:border-red-500/20 transition-colors flex items-center gap-1"
                    title="Permanently Delete Tender"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    Delete
                  </button>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 dark:text-slate-500">Deadline</p>
                <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 font-mono">
                  {format(new Date(tender.deadline), 'MMM dd, yyyy HH:mm')}
                </p>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{tender.title}</h1>
            <p className="text-gray-600 dark:text-slate-300 whitespace-pre-wrap">{tender.description}</p>

            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center gap-4 text-xs text-gray-400 dark:text-slate-500">
              <span>Created: {format(new Date(tender.createdAt), 'MMM dd, yyyy HH:mm')}</span>
              <span>ID: <code className="font-mono">{tender.tenderId.slice(0, 12)}...</code></span>
            </div>
          </div>
        </ScrollReveal>

        {/* Role-specific content */}
        {userInfo?.role === 'tv-bidder' && tender.status === 'OPEN' && isLocked && (
          <ScrollReveal delay={0.1}>
            <div className="card">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-vault-600 dark:text-vault-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Submit Your Bid
              </h2>
              <BidUploadPanel tenderId={tender.tenderId} onUploadComplete={fetchTender} />
            </div>
          </ScrollReveal>
        )}

        {userInfo?.role === 'tv-bidder' && !isLocked && (
          <div className="card text-center py-8 animate-fade-in">
            <div className="w-12 h-12 mx-auto bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="font-semibold text-gray-900 dark:text-white mb-1">Submission Period Ended</p>
            <p className="text-sm text-gray-500 dark:text-slate-400">The deadline for this tender has passed</p>
          </div>
        )}

        {/* Bid List (Admin/Evaluator) */}
        {(userInfo?.role === 'tv-admin' || userInfo?.role === 'tv-evaluator') && (
          <ScrollReveal delay={0.15}>
            <div className="card relative overflow-hidden">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-vault-600 dark:text-vault-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                    <div className="p-3 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-100 dark:border-red-500/20 text-sm text-red-700 dark:text-red-400 mb-4">
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
          </ScrollReveal>
        )}
      </div>
    </AnimatedPage>
  );
}
