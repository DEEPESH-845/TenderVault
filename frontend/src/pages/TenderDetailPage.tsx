import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { isPast, format } from 'date-fns';
import { getTender, listBids, getErrorMessage, isTenderLockedError, deleteTender, updateTender } from '../services/api';
import type { Tender, Bid, UserInfo } from '../services/types';
import BidUploadPanel from '../components/BidUploadPanel';
import BidListPanel from '../components/BidListPanel';
import TimeLockOverlay from '../components/TimeLockOverlay';
import AnimatedPage from '../components/AnimatedPage';
import ScrollReveal from '../components/ScrollReveal';
import { gsap } from '../lib/gsap';

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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteModalRef = useRef<HTMLDivElement>(null);
  const deleteBackdropRef = useRef<HTMLDivElement>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({ title: '', description: '', deadline: '' });
  const editModalRef = useRef<HTMLDivElement>(null);
  const editBackdropRef = useRef<HTMLDivElement>(null);

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
    if (userInfo.role === 'tv-bidder') return;
    try {
      setBidsError(null);
      const data = await listBids(tenderId);
      setBids(data);
    } catch (err) {
      if (isTenderLockedError(err)) {
        setBidsError(null);
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
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteTender(tenderId);
      setShowDeleteModal(false);
      navigate('/');
    } catch (err) {
      setDeleteError(getErrorMessage(err));
      setDeleting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenderId) return;
    setEditing(true);
    setEditError(null);
    try {
      const updated = await updateTender(tenderId, {
        title: editFormData.title,
        description: editFormData.description,
        deadline: new Date(editFormData.deadline).toISOString(),
      });
      setTender(updated);
      setShowEditModal(false);
    } catch (err) {
      setEditError(getErrorMessage(err));
    } finally {
      setEditing(false);
    }
  };

  const openEditModal = () => {
    if (!tender) return;
    setEditFormData({
      title: tender.title,
      description: tender.description,
      deadline: format(new Date(tender.deadline), "yyyy-MM-dd'T'HH:mm"),
    });
    setEditError(null);
    setShowEditModal(true);
  };

  // Animate delete modal on open
  useEffect(() => {
    if (!showDeleteModal) return;
    if (deleteBackdropRef.current) {
      gsap.fromTo(deleteBackdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    }
    if (deleteModalRef.current) {
      gsap.fromTo(
        deleteModalRef.current,
        { opacity: 0, scale: 0.95, y: 20 },
        { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'power3.out', delay: 0.1 }
      );
    }
  }, [showDeleteModal]);

  // Animate edit modal on open
  useEffect(() => {
    if (!showEditModal) return;
    if (editBackdropRef.current) {
      gsap.fromTo(editBackdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    }
    if (editModalRef.current) {
      gsap.fromTo(
        editModalRef.current,
        { opacity: 0, scale: 0.95, y: 20 },
        { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'power3.out', delay: 0.1 }
      );
    }
  }, [showEditModal]);

  if (loading) {
    return (
      <div className="td-wrap">
        <div className="db-skeleton" style={{ height: '24px', width: '180px', marginBottom: '1.5rem', borderRadius: '4px' }} />
        <div className="db-skeleton" style={{ height: '220px', borderRadius: '10px', marginBottom: '1rem' }} />
        <div className="db-skeleton" style={{ height: '160px', borderRadius: '10px' }} />
      </div>
    );
  }

  if (error || !tender) {
    return (
      <div className="td-wrap td-error-state">
        <div className="td-error-icon">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="td-error-title">{error || 'Tender not found'}</p>
        <Link to="/" className="td-back-link">← Back to Tenders</Link>
      </div>
    );
  }

  const statusColors = {
    OPEN:     { bar: 'td-status-bar--open',     badge: 'td-badge--open',     dot: 'td-dot--open' },
    CLOSED:   { bar: 'td-status-bar--closed',   badge: 'td-badge--closed',   dot: 'td-dot--closed' },
    ARCHIVED: { bar: 'td-status-bar--archived', badge: 'td-badge--archived', dot: 'td-dot--archived' },
  };
  const sc = statusColors[tender.status];

  return (
    <AnimatedPage>
      <div className="td-wrap">

        {/* ── Breadcrumb ──────────────────────────────────────── */}
        <div className="td-breadcrumb">
          <Link to="/" className="td-breadcrumb__link">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Tenders
          </Link>
          <span className="td-breadcrumb__sep">/</span>
          <span className="td-breadcrumb__current">{tender.tenderId.slice(0, 8)}…</span>
        </div>

        {/* ── Tender Header Card ──────────────────────────────── */}
        <ScrollReveal>
          <div className="td-card">
            {/* Status bar */}
            <div className={`td-status-bar ${sc.bar}`} aria-hidden="true" />

            <div className="td-card__inner">
              {/* Top meta row */}
              <div className="td-card__meta">
                <div className="td-card__meta-left">
                  <span className={`td-dot ${sc.dot}`} aria-hidden="true" />
                  <span className={`td-badge ${sc.badge}`}>{tender.status}</span>
                  {userInfo?.role === 'tv-admin' && (
                    <div className="td-admin-actions">
                      <button onClick={openEditModal} className="td-btn-edit" title="Edit Tender">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                        Edit
                      </button>
                      <button
                        onClick={() => { setDeleteError(null); setShowDeleteModal(true); }}
                        className="td-btn-delete"
                        title="Delete Tender"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                <div className="td-card__deadline">
                  <span className="td-card__deadline-label">DEADLINE</span>
                  <span className="td-card__deadline-value">
                    {format(new Date(tender.deadline), 'MMM dd, yyyy HH:mm')}
                  </span>
                </div>
              </div>

              {/* Title */}
              <h1 className="td-title">{tender.title}</h1>

              {/* Description */}
              <p className="td-desc">{tender.description}</p>

              {/* Footer metadata */}
              <div className="td-card__foot">
                <span className="td-meta-item">
                  Created: <code className="td-mono">{format(new Date(tender.createdAt), 'MMM dd, yyyy HH:mm')}</code>
                </span>
                <span className="td-meta-item">
                  ID: <code className="td-mono">{tender.tenderId.slice(0, 12)}…</code>
                </span>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* ── Bidder: Submit Bid ──────────────────────────────── */}
        {userInfo?.role === 'tv-bidder' && tender.status === 'OPEN' && isLocked && (
          <ScrollReveal delay={0.1}>
            <div className="td-card">
              <div className="td-card__inner">
                <h2 className="td-section-title">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  Submit Your Bid
                </h2>
                <BidUploadPanel tenderId={tender.tenderId} onUploadComplete={fetchTender} />
              </div>
            </div>
          </ScrollReveal>
        )}

        {/* ── Bidder: Deadline Passed ─────────────────────────── */}
        {userInfo?.role === 'tv-bidder' && !isLocked && (
          <div className="td-card td-card--centered animate-fade-in">
            <div className="td-card__inner td-deadline-passed">
              <div className="td-deadline-icon">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="td-deadline-title">Submission Period Ended</p>
              <p className="td-deadline-sub">The deadline for this tender has passed</p>
            </div>
          </div>
        )}

        {/* ── Admin/Evaluator: Bid List ───────────────────────── */}
        {(userInfo?.role === 'tv-admin' || userInfo?.role === 'tv-evaluator') && (
          <ScrollReveal delay={0.15}>
            <div className="td-card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div className="td-card__inner">
                <h2 className="td-section-title">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                      <div className="td-alert td-alert--error">{bidsError}</div>
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
            </div>
          </ScrollReveal>
        )}
      </div>

      {/* ── Delete Confirmation Modal ───────────────────────── */}
      {showDeleteModal && (
        <>
          <div
            ref={deleteBackdropRef}
            className="db-modal-backdrop"
            onClick={() => !deleting && setShowDeleteModal(false)}
          />
          <div className="db-modal-wrap">
            <div ref={deleteModalRef} className="db-modal td-delete-modal">
              <div className="td-delete-modal__icon">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="td-delete-modal__eyebrow">DESTRUCTIVE ACTION</div>
              <h3 className="td-delete-modal__title">Delete Tender</h3>
              <p className="td-delete-modal__body">
                Are you sure you want to permanently delete
              </p>
              <p className="td-delete-modal__tender-name">"{tender.title}"?</p>
              <p className="td-delete-modal__warning">
                This action cannot be undone. All associated data will be lost.
              </p>

              {deleteError && (
                <div className="td-alert td-alert--error" style={{ marginBottom: '1rem' }}>
                  {deleteError}
                </div>
              )}

              <div className="td-delete-modal__actions">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="db-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="td-btn-danger"
                >
                  {deleting ? 'Deleting…' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Edit Tender Modal ───────────────────────────────── */}
      {showEditModal && (
        <>
          <div
            ref={editBackdropRef}
            className="db-modal-backdrop"
            onClick={() => !editing && setShowEditModal(false)}
          />
          <div className="db-modal-wrap">
            <div ref={editModalRef} className="db-modal">

              <div className="db-modal__header">
                <div>
                  <div className="db-modal__eyebrow">PROCUREMENT OFFICER</div>
                  <h2 className="db-modal__title">Edit Tender</h2>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="db-modal__close"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleEdit} className="db-modal__form">
                <div className="db-field">
                  <label className="db-field__label">Title</label>
                  <input
                    type="text"
                    className="db-field__input"
                    value={editFormData.title}
                    onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                    required
                    minLength={3}
                    maxLength={200}
                  />
                </div>

                <div className="db-field">
                  <label className="db-field__label">Description</label>
                  <textarea
                    className="db-field__input db-field__input--textarea"
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
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
                    value={editFormData.deadline}
                    onChange={(e) => setEditFormData({ ...editFormData, deadline: e.target.value })}
                    required
                  />
                </div>

                {editError && (
                  <div className="db-form-error">{editError}</div>
                )}

                <div className="db-modal__actions">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    disabled={editing}
                    className="db-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editing}
                    className="db-btn-submit"
                  >
                    {editing ? (
                      <span className="db-btn-submit__loading">
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Saving…
                      </span>
                    ) : 'Save Changes'}
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
