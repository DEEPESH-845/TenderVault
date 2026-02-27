import { useState, Fragment } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { generateDownloadUrl, updateBidStatus, scoreBid, getErrorMessage } from '../services/api';
import type { Bid, UserInfo } from '../services/types';
import VersionHistoryDrawer from './VersionHistoryDrawer';
import { useStagger } from '../hooks/useStagger';

interface BidListPanelProps {
  tenderId: string;
  bids: Bid[];
  userInfo: UserInfo | null;
  onRefresh: () => void;
}

export default function BidListPanel({ tenderId, bids, userInfo, onRefresh }: BidListPanelProps) {
  const [downloadingBid, setDownloadingBid] = useState<string | null>(null);
  const [downloadedBid, setDownloadedBid] = useState<string | null>(null);
  const [versionDrawer, setVersionDrawer] = useState<{ tenderId: string; bidderId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tbodyRef = useStagger<HTMLTableSectionElement>(':scope > tr.bl-tr', [bids.length]);

  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [scoringBid, setScoringBid] = useState<string | null>(null);
  const [scoreInputs, setScoreInputs] = useState<Record<string, { score: string; notes: string }>>({});

  const handleStatusChange = async (bidderId: string, bidStatus: 'UNDER_REVIEW' | 'SHORTLISTED' | 'DISQUALIFIED' | 'AWARDED') => {
    setUpdatingStatus(bidderId);
    setError(null);
    try {
      await updateBidStatus(tenderId, bidderId, bidStatus);
      onRefresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleScore = async (bidderId: string) => {
    const input = scoreInputs[bidderId];
    if (!input?.score) return;
    const scoreNum = parseInt(input.score, 10);
    if (isNaN(scoreNum) || scoreNum < 1 || scoreNum > 10) {
      setError('Score must be between 1 and 10');
      return;
    }
    setScoringBid(bidderId);
    setError(null);
    try {
      await scoreBid(tenderId, bidderId, scoreNum, input.notes || undefined);
      onRefresh();
      setScoreInputs(prev => ({ ...prev, [bidderId]: { score: '', notes: '' } }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setScoringBid(null);
    }
  };

  const handleDownload = async (bidderId: string) => {
    setDownloadingBid(bidderId);
    setError(null);
    try {
      const { downloadUrl, fileName } = await generateDownloadUrl(tenderId, bidderId);
      // Create a temporary anchor to trigger download with proper filename
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDownloadedBid(bidderId);
      setTimeout(() => setDownloadedBid(null), 3000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDownloadingBid(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  if (bids.length === 0) {
    return (
      <div className="bl-empty">
        <div className="bl-empty__icon">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <p className="bl-empty__title">No bids submitted</p>
        <p className="bl-empty__sub">No bidders have submitted for this tender</p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="td-alert td-alert--error" style={{ marginBottom: '1rem' }}>{error}</div>
      )}

      <div className="bl-table-wrap">
        <table className="bl-table">
          <thead>
            <tr>
              <th className="bl-th">Bidder ID</th>
              <th className="bl-th">File</th>
              <th className="bl-th">Size</th>
              <th className="bl-th">Submitted</th>
              <th className="bl-th">Status</th>
              {userInfo?.role === 'tv-admin' && (
                <th className="bl-th">Eval Status</th>
              )}
              <th className="bl-th bl-th--right">Actions</th>
            </tr>
          </thead>
          <tbody ref={tbodyRef}>
            {bids.map((bid) => (
              <Fragment key={bid.bidderId}>
                <tr className="bl-tr">
                  <td className="bl-td">
                    <span className="bl-bidder-id">{bid.bidderId.slice(0, 8)}…</span>
                  </td>
                  <td className="bl-td">
                    <div className="bl-file-cell">
                      <svg className="bl-pdf-icon" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                      <span className="bl-file-name">{bid.fileName}</span>
                    </div>
                  </td>
                  <td className="bl-td bl-td--muted">{formatFileSize(bid.fileSize)}</td>
                  <td className="bl-td bl-td--muted" title={format(new Date(bid.submittedAt), 'MMM dd, yyyy HH:mm')}>
                    {formatDistanceToNow(new Date(bid.submittedAt), { addSuffix: true })}
                  </td>
                  <td className="bl-td">
                    <span className={`bl-status bl-status--${bid.status.toLowerCase()}`}>
                      <span className="bl-status__dot" />
                      {bid.status}
                    </span>
                  </td>
                  {userInfo?.role === 'tv-admin' && (
                    <td className="bl-td">
                      <select
                        className={`bl-status-select ${updatingStatus === bid.bidderId ? 'bl-status-select--loading' : ''}`}
                        value={bid.bidStatus || ''}
                        disabled={updatingStatus === bid.bidderId}
                        onChange={(e) => {
                          if (e.target.value) {
                            handleStatusChange(bid.bidderId, e.target.value as 'UNDER_REVIEW' | 'SHORTLISTED' | 'DISQUALIFIED' | 'AWARDED');
                          }
                        }}
                      >
                        <option value="">— Set status —</option>
                        <option value="UNDER_REVIEW">Under Review</option>
                        <option value="SHORTLISTED">Shortlisted</option>
                        <option value="DISQUALIFIED">Disqualified</option>
                        <option value="AWARDED">Awarded</option>
                      </select>
                    </td>
                  )}
                  <td className="bl-td bl-td--right">
                    <div className="bl-actions">
                      <button
                        onClick={() => handleDownload(bid.bidderId)}
                        disabled={downloadingBid === bid.bidderId}
                        className={`bl-btn-download ${downloadedBid === bid.bidderId ? 'bl-btn-download--done' : ''}`}
                      >
                        {downloadingBid === bid.bidderId ? (
                          <>
                            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Generating…
                          </>
                        ) : downloadedBid === bid.bidderId ? (
                          <>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            Downloaded
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            Download
                          </>
                        )}
                      </button>
                      {userInfo?.role === 'tv-admin' && (
                        <button
                          onClick={() => setVersionDrawer({ tenderId, bidderId: bid.bidderId })}
                          className="bl-btn-versions"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Versions
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {(userInfo?.role === 'tv-evaluator' || userInfo?.role === 'tv-admin') && (
                  <tr className="bl-score-row" key={`${bid.bidderId}-score`}>
                    <td colSpan={userInfo?.role === 'tv-admin' ? 7 : 6} className="bl-score-cell">
                      {userInfo?.role === 'tv-evaluator' && (
                        <div className="bl-score-form">
                          <span className="bl-score-label">Score this bid:</span>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            className="bl-score-input"
                            placeholder="1–10"
                            value={scoreInputs[bid.bidderId]?.score || ''}
                            onChange={(e) => setScoreInputs(prev => ({
                              ...prev,
                              [bid.bidderId]: { ...prev[bid.bidderId], score: e.target.value, notes: prev[bid.bidderId]?.notes || '' }
                            }))}
                          />
                          <input
                            type="text"
                            className="bl-score-notes"
                            placeholder="Notes (optional)"
                            value={scoreInputs[bid.bidderId]?.notes || ''}
                            onChange={(e) => setScoreInputs(prev => ({
                              ...prev,
                              [bid.bidderId]: { ...prev[bid.bidderId], notes: e.target.value, score: prev[bid.bidderId]?.score || '' }
                            }))}
                          />
                          <button
                            className="bl-btn-score"
                            disabled={scoringBid === bid.bidderId}
                            onClick={() => handleScore(bid.bidderId)}
                          >
                            {scoringBid === bid.bidderId ? 'Saving…' : 'Submit Score'}
                          </button>
                        </div>
                      )}
                      {userInfo?.role === 'tv-admin' && bid.evaluationScores && Object.keys(bid.evaluationScores).length > 0 && (
                        <div className="bl-score-summary">
                          <span className="bl-score-label">Evaluator scores:</span>
                          {Object.entries(bid.evaluationScores).map(([uid, entry]) => (
                            <span key={uid} className="bl-score-chip">
                              {uid.slice(0, 6)}… — <strong>{entry.score}/10</strong>
                              {entry.notes && <span className="bl-score-note"> "{entry.notes}"</span>}
                            </span>
                          ))}
                          <span className="bl-score-avg">
                            Avg: {(Object.values(bid.evaluationScores).reduce((s, e) => s + e.score, 0) / Object.values(bid.evaluationScores).length).toFixed(1)}
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Version History Drawer */}
      {versionDrawer && (
        <VersionHistoryDrawer
          tenderId={versionDrawer.tenderId}
          bidderId={versionDrawer.bidderId}
          onClose={() => setVersionDrawer(null)}
          onRestore={onRefresh}
        />
      )}
    </>
  );
}
