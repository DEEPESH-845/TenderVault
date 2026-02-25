import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { listVersions, restoreVersion, getErrorMessage } from '../services/api';
import type { BidVersion } from '../services/types';

interface VersionHistoryDrawerProps {
  tenderId: string;
  bidderId: string;
  onClose: () => void;
  onRestore: () => void;
}

export default function VersionHistoryDrawer({ tenderId, bidderId, onClose, onRestore }: VersionHistoryDrawerProps) {
  const [versions, setVersions] = useState<BidVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  useEffect(() => {
    fetchVersions();
  }, [tenderId, bidderId]);

  const fetchVersions = async () => {
    try {
      setLoading(true);
      const data = await listVersions(tenderId, bidderId);
      setVersions(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (versionId: string) => {
    setRestoring(versionId);
    setError(null);
    try {
      await restoreVersion(tenderId, bidderId, versionId);
      setConfirmRestore(null);
      await fetchVersions();
      onRestore();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRestoring(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl animate-slide-in-right overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Version History</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 font-mono">Bidder: {bidderId.slice(0, 12)}...</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-gray-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-100 dark:border-red-500/20 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-20 rounded-xl" />
              ))}
            </div>
          ) : versions.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-slate-400 py-8">No versions found</p>
          ) : (
            <div className="space-y-3">
              {versions.map((version, index) => (
                <div
                  key={version.versionId}
                  className={`p-4 rounded-xl border transition-all ${
                    version.isLatest
                      ? 'border-vault-200 dark:border-vault-500/30 bg-vault-50/50 dark:bg-vault-500/5'
                      : 'border-gray-100 dark:border-slate-800 hover:border-gray-200 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">V{versions.length - index}</span>
                      {version.isLatest && (
                        <span className="badge-open text-[10px] px-2 py-0.5">Current</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 dark:text-slate-500">{formatFileSize(version.size)}</span>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-3 font-mono">
                    {version.versionId.slice(0, 20)}...
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 dark:text-slate-500">
                      {version.lastModified
                        ? formatDistanceToNow(new Date(version.lastModified), { addSuffix: true })
                        : 'Unknown date'}
                    </span>

                    {!version.isLatest && (
                      confirmRestore === version.versionId ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRestore(version.versionId)}
                            disabled={restoring === version.versionId}
                            className="btn-danger text-xs px-3 py-1"
                          >
                            {restoring === version.versionId ? 'Restoring...' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => setConfirmRestore(null)}
                            className="text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRestore(version.versionId)}
                          className="btn-secondary text-xs px-3 py-1"
                        >
                          Restore
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
