import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { generateDownloadUrl, getErrorMessage } from '../services/api';
import type { Bid, UserInfo } from '../services/types';
import VersionHistoryDrawer from './VersionHistoryDrawer';

interface BidListPanelProps {
  tenderId: string;
  bids: Bid[];
  userInfo: UserInfo | null;
  onRefresh: () => void;
}

export default function BidListPanel({ tenderId, bids, userInfo, onRefresh }: BidListPanelProps) {
  const [downloadingBid, setDownloadingBid] = useState<string | null>(null);
  const [versionDrawer, setVersionDrawer] = useState<{ tenderId: string; bidderId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async (bidderId: string) => {
    setDownloadingBid(bidderId);
    setError(null);
    try {
      const { downloadUrl } = await generateDownloadUrl(tenderId, bidderId);
      window.open(downloadUrl, '_blank');
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
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9.75m3 0l-3-3m3 3l-3 3M5.25 21h13.5A2.25 2.25 0 0021 18.75V5.25A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25v13.5A2.25 2.25 0 005.25 21z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-500">No bids submitted yet</p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-100">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="table-header">Bidder</th>
              <th className="table-header">File</th>
              <th className="table-header">Size</th>
              <th className="table-header">Submitted</th>
              <th className="table-header">Status</th>
              <th className="table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {bids.map((bid) => (
              <tr key={bid.bidderId} className="hover:bg-gray-50/50 transition-colors">
                <td className="table-cell font-medium text-gray-900">
                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded-md">
                    {bid.bidderId.slice(0, 8)}...
                  </span>
                </td>
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    <span className="truncate max-w-[200px]">{bid.fileName}</span>
                  </div>
                </td>
                <td className="table-cell text-gray-500">{formatFileSize(bid.fileSize)}</td>
                <td className="table-cell text-gray-500">
                  {formatDistanceToNow(new Date(bid.submittedAt), { addSuffix: true })}
                </td>
                <td className="table-cell">
                  <span className={`badge ${bid.status === 'SUBMITTED' ? 'badge-open' : 'badge-archived'}`}>
                    {bid.status}
                  </span>
                </td>
                <td className="table-cell text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleDownload(bid.bidderId)}
                      disabled={downloadingBid === bid.bidderId}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      {downloadingBid === bid.bidderId ? 'Generating...' : 'Download'}
                    </button>
                    {userInfo?.role === 'tv-admin' && (
                      <button
                        onClick={() => setVersionDrawer({ tenderId, bidderId: bid.bidderId })}
                        className="btn-secondary text-xs px-3 py-1.5"
                      >
                        Versions
                      </button>
                    )}
                  </div>
                </td>
              </tr>
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
