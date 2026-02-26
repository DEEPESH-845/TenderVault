import { useState, useEffect, useRef } from 'react';
import { listTenders, createTender, getErrorMessage } from '../services/api';
import type { Tender, UserInfo } from '../services/types';
import TenderCard from '../components/TenderCard';
import AnimatedPage from '../components/AnimatedPage';
import { useStagger } from '../hooks/useStagger';
import { gsap } from '../lib/gsap';

interface TenderListPageProps {
  userInfo: UserInfo | null;
}

export default function TenderListPage({ userInfo }: TenderListPageProps) {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', deadline: '' });
  const gridRef = useStagger<HTMLDivElement>(':scope > div', [tenders.length, loading]);
  const modalRef = useRef<HTMLDivElement>(null);
  const modalBackdropRef = useRef<HTMLDivElement>(null);

  const fetchTenders = async () => {
    try {
      setLoading(true);
      const data = await listTenders();
      setTenders(data);
    } catch (err) {
      console.error('Failed to fetch tenders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenders();
  }, []);

  // Modal entrance animation
  useEffect(() => {
    if (!showCreateModal) return;

    if (modalBackdropRef.current) {
      gsap.fromTo(modalBackdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    }
    if (modalRef.current) {
      gsap.fromTo(
        modalRef.current,
        { opacity: 0, scale: 0.95, y: 20 },
        { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'power3.out', delay: 0.1 }
      );
    }
  }, [showCreateModal]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await createTender({
        title: formData.title,
        description: formData.description,
        deadline: new Date(formData.deadline).toISOString(),
      });
      setShowCreateModal(false);
      setFormData({ title: '', description: '', deadline: '' });
      await fetchTenders();
    } catch (err) {
      setCreateError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <AnimatedPage>
      {/* ── Page Header ─────────────────────────────────── */}
      <div className="db-page-header">
        <div className="db-page-header__left">
          <div className="db-page-header__eyebrow">PROCUREMENT REGISTRY</div>
          <h1 className="db-page-header__title">Tenders</h1>
          <p className="db-page-header__sub">
            {userInfo?.role === 'tv-admin' && 'Manage all tenders and procurement processes'}
            {userInfo?.role === 'tv-bidder' && 'Browse and submit bids for open tenders'}
            {userInfo?.role === 'tv-evaluator' && 'Review submitted bids after tender closing'}
          </p>
        </div>
        <div className="db-page-header__right">
          {userInfo?.role === 'tv-admin' && (
            <button onClick={() => setShowCreateModal(true)} className="db-btn-create">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Tender
            </button>
          )}
        </div>
      </div>

      {/* ── Stats Strip (admin only) ─────────────────────── */}
      {userInfo?.role === 'tv-admin' && !loading && tenders.length > 0 && (
        <div className="db-stats-strip">
          <div className="db-stat-pill">
            <span className="db-stat-pill__value">{tenders.length}</span>
            <span className="db-stat-pill__label">Total</span>
          </div>
          <div className="db-stat-divider" />
          <div className="db-stat-pill">
            <span className="db-stat-pill__value db-stat-pill__value--open">
              {tenders.filter(t => t.status === 'OPEN').length}
            </span>
            <span className="db-stat-pill__label">Open</span>
          </div>
          <div className="db-stat-divider" />
          <div className="db-stat-pill">
            <span className="db-stat-pill__value db-stat-pill__value--closed">
              {tenders.filter(t => t.status === 'CLOSED').length}
            </span>
            <span className="db-stat-pill__label">Closed</span>
          </div>
          <div className="db-stat-divider" />
          <div className="db-stat-pill">
            <span className="db-stat-pill__value">
              {tenders.filter(t => t.status === 'ARCHIVED').length}
            </span>
            <span className="db-stat-pill__label">Archived</span>
          </div>
        </div>
      )}

      {/* ── Tender Grid ─────────────────────────────────── */}
      {loading ? (
        <div className="db-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="db-skeleton" />
          ))}
        </div>
      ) : tenders.length === 0 ? (
        <div className="db-empty">
          <div className="db-empty__icon">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <p className="db-empty__title">No tenders found</p>
          <p className="db-empty__sub">
            {userInfo?.role === 'tv-admin'
              ? 'Create your first tender to get started'
              : 'Check back later for new opportunities'}
          </p>
        </div>
      ) : (
        <div ref={gridRef} className="db-grid">
          {tenders.map((tender) => (
            <TenderCard key={tender.tenderId} tender={tender} userInfo={userInfo} />
          ))}
        </div>
      )}

      {/* ── Create Tender Modal ──────────────────────────── */}
      {showCreateModal && (
        <>
          <div
            ref={modalBackdropRef}
            className="db-modal-backdrop"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="db-modal-wrap">
            <div ref={modalRef} className="db-modal">

              {/* Modal header */}
              <div className="db-modal__header">
                <div>
                  <div className="db-modal__eyebrow">PROCUREMENT OFFICER</div>
                  <h2 className="db-modal__title">New Tender</h2>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="db-modal__close"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreate} className="db-modal__form">
                <div className="db-field">
                  <label className="db-field__label">Title</label>
                  <input
                    type="text"
                    className="db-field__input"
                    placeholder="Government IT Infrastructure Upgrade"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    minLength={3}
                    maxLength={200}
                  />
                </div>

                <div className="db-field">
                  <label className="db-field__label">Description</label>
                  <textarea
                    className="db-field__input db-field__input--textarea"
                    placeholder="Detailed description of the tender requirements..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    minLength={10}
                    maxLength={2000}
                  />
                </div>

                <div className="db-field">
                  <label className="db-field__label">Submission Deadline</label>
                  <input
                    type="datetime-local"
                    className="db-field__input"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    required
                  />
                  <p className="db-field__hint">Must be set in the future</p>
                </div>

                {createError && (
                  <div className="db-form-error">
                    {createError}
                  </div>
                )}

                <div className="db-modal__actions">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="db-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="db-btn-submit"
                  >
                    {creating ? (
                      <span className="db-btn-submit__loading">
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Creating...
                      </span>
                    ) : 'Create Tender'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </AnimatedPage>
  );
}
