import { useState, useEffect, useCallback } from 'react';
import { listAuditLogs, getErrorMessage } from '../services/api';
import type { AuditEvent } from '../services/types';
import AuditLogTable from '../components/AuditLogTable';
import AnimatedPage from '../components/AnimatedPage';
import ScrollReveal from '../components/ScrollReveal';

export default function AuditLogPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextToken, setNextToken] = useState<string | undefined>();
  const [filters, setFilters] = useState({
    userId: '',
    tenderId: '',
    action: '',
  });
  const [activeFilters, setActiveFilters] = useState(filters);

  const fetchLogs = useCallback(async (token?: string, reset = false) => {
    try {
      setLoading(true);
      const params: any = { limit: 50 };
      if (activeFilters.userId) params.userId = activeFilters.userId;
      if (activeFilters.tenderId) params.tenderId = activeFilters.tenderId;
      if (activeFilters.action) params.action = activeFilters.action;
      if (token) params.nextToken = token;

      const data = await listAuditLogs(params);
      const newEvents = data.events || [];

      if (reset) {
        setEvents(newEvents);
      } else {
        setEvents(prev => [...prev, ...newEvents]);
      }
      setNextToken(data.nextToken);
    } catch (err) {
      console.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [activeFilters]);

  useEffect(() => {
    fetchLogs(undefined, true);
  }, [fetchLogs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveFilters(filters);
  };

  const handleClearFilters = () => {
    const cleared = { userId: '', tenderId: '', action: '' };
    setFilters(cleared);
    setActiveFilters(cleared);
  };

  const actionOptions = [
    'AUTH_VERIFY',
    'TENDER_CREATED',
    'TENDER_LISTED',
    'TENDER_VIEWED',
    'UPLOAD_URL_GENERATED',
    'BID_SUBMITTED',
    'DOWNLOAD_URL_GENERATED',
    'DOWNLOAD_DENIED_TIMELOCKED',
    'VERSIONS_LISTED',
    'VERSION_RESTORED',
    'AUDIT_LOG_VIEWED',
  ];

  return (
    <AnimatedPage>
      {/* Header */}
      <div className="mb-8">
        <h1 className="page-header">Audit Trail</h1>
        <p className="page-subtitle">Complete system activity log for compliance and security monitoring</p>
      </div>

      {/* Filters */}
      <ScrollReveal>
        <form onSubmit={handleSearch} className="card mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="label">User ID</label>
              <input
                type="text"
                className="input"
                placeholder="Filter by user..."
                value={filters.userId}
                onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Tender ID</label>
              <input
                type="text"
                className="input"
                placeholder="Filter by tender..."
                value={filters.tenderId}
                onChange={(e) => setFilters({ ...filters, tenderId: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Action</label>
              <select
                className="input"
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              >
                <option value="">All Actions</option>
                {actionOptions.map(action => (
                  <option key={action} value={action}>{action.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1">
                Search
              </button>
              <button type="button" onClick={handleClearFilters} className="btn-secondary">
                Clear
              </button>
            </div>
          </div>
        </form>
      </ScrollReveal>

      {/* Results */}
      <ScrollReveal delay={0.1}>
        <AuditLogTable
          events={events}
          loading={loading}
          hasMore={!!nextToken}
          onLoadMore={() => fetchLogs(nextToken)}
        />
      </ScrollReveal>
    </AnimatedPage>
  );
}
