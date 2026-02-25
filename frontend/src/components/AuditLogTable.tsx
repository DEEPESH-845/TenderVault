import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { AuditEvent } from '../services/types';

interface AuditLogTableProps {
  events: AuditEvent[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

export default function AuditLogTable({ events, loading, hasMore, onLoadMore }: AuditLogTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const resultColors: Record<string, string> = {
    SUCCESS: 'text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:ring-emerald-500/20',
    DENIED: 'text-red-700 bg-red-50 ring-1 ring-red-200 dark:text-red-400 dark:bg-red-500/10 dark:ring-red-500/20',
    ERROR: 'text-orange-700 bg-orange-50 ring-1 ring-orange-200 dark:text-orange-400 dark:bg-orange-500/10 dark:ring-orange-500/20',
  };

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'User ID', 'Role', 'Action', 'Tender ID', 'Result', 'IP Address'];
    const rows = events.map(e => [
      e.timestamp,
      e.userId,
      e.userRole,
      e.action,
      e.tenderId || '',
      e.result,
      e.ipAddress,
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && events.length === 0) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-12 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Export button */}
      <div className="flex justify-end mb-4">
        <button onClick={handleExportCSV} className="btn-secondary text-xs px-3 py-1.5 gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-slate-800">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="table-header">Timestamp</th>
              <th className="table-header">User</th>
              <th className="table-header">Role</th>
              <th className="table-header">Action</th>
              <th className="table-header">Tender</th>
              <th className="table-header">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
            {events.map((event) => (
              <>
                <tr
                  key={event.auditId}
                  className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  onClick={() => setExpandedRow(expandedRow === event.auditId ? null : event.auditId)}
                >
                  <td className="table-cell text-xs font-mono text-gray-500 dark:text-slate-400">
                    {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                  </td>
                  <td className="table-cell">
                    <span className="font-mono text-xs bg-gray-100 dark:bg-slate-800 dark:text-slate-300 px-1.5 py-0.5 rounded">
                      {event.userId.slice(0, 8)}...
                    </span>
                  </td>
                  <td className="table-cell text-xs">{event.userRole}</td>
                  <td className="table-cell text-xs font-semibold">
                    {event.action.replace(/_/g, ' ')}
                  </td>
                  <td className="table-cell">
                    {event.tenderId ? (
                      <span className="font-mono text-xs text-gray-500 dark:text-slate-400">
                        {event.tenderId.slice(0, 8)}...
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300 dark:text-slate-600">—</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <span className={`badge text-[10px] ${resultColors[event.result] || ''}`}>
                      {event.result}
                    </span>
                  </td>
                </tr>
                {expandedRow === event.auditId && (
                  <tr key={`${event.auditId}-detail`}>
                    <td colSpan={6} className="px-4 py-3 bg-gray-50/80 dark:bg-slate-800/50">
                      <div className="text-xs space-y-1">
                        <p><strong className="text-gray-500 dark:text-slate-400">Audit ID:</strong> <span className="font-mono dark:text-slate-300">{event.auditId}</span></p>
                        <p><strong className="text-gray-500 dark:text-slate-400">Full Timestamp:</strong> <span className="dark:text-slate-300">{event.timestamp}</span></p>
                        <p><strong className="text-gray-500 dark:text-slate-400">IP Address:</strong> <span className="dark:text-slate-300">{event.ipAddress}</span></p>
                        {event.fileKey && <p><strong className="text-gray-500 dark:text-slate-400">File Key:</strong> <span className="font-mono dark:text-slate-300">{event.fileKey}</span></p>}
                        {event.versionId && <p><strong className="text-gray-500 dark:text-slate-400">Version ID:</strong> <span className="font-mono dark:text-slate-300">{event.versionId}</span></p>}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="btn-secondary"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {events.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500 dark:text-slate-400">
          <p className="text-sm">No audit events found</p>
        </div>
      )}
    </div>
  );
}
