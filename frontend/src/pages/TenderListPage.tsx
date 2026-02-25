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
      {/* Page Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="page-header">Tenders</h1>
          <p className="page-subtitle">
            {userInfo?.role === 'tv-admin' && 'Manage all tenders and procurement processes'}
            {userInfo?.role === 'tv-bidder' && 'Browse and submit bids for open tenders'}
            {userInfo?.role === 'tv-evaluator' && 'Review submitted bids after tender closing'}
          </p>
        </div>
        {userInfo?.role === 'tv-admin' && (
          <button onClick={() => setShowCreateModal(true)} className="btn-primary gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Tender
          </button>
        )}
      </div>

      {/* Tender Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton h-48 rounded-2xl" />
          ))}
        </div>
      ) : tenders.length === 0 ? (
        <div className="text-center py-20 animate-fade-in">
          <div className="w-20 h-20 mx-auto bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-5">
            <svg className="w-10 h-10 text-gray-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-gray-700 dark:text-slate-200 mb-1">No tenders found</p>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {userInfo?.role === 'tv-admin'
              ? 'Create your first tender to get started'
              : 'Check back later for new opportunities'}
          </p>
        </div>
      ) : (
        <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tenders.map((tender) => (
            <TenderCard key={tender.tenderId} tender={tender} userInfo={userInfo} />
          ))}
        </div>
      )}

      {/* Create Tender Modal */}
      {showCreateModal && (
        <>
          <div ref={modalBackdropRef} className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div ref={modalRef} className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl dark:shadow-black/50 max-w-lg w-full p-6 border border-transparent dark:border-slate-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Create New Tender</h2>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="label">Title</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Government IT Infrastructure Upgrade"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    minLength={3}
                    maxLength={200}
                  />
                </div>

                <div>
                  <label className="label">Description</label>
                  <textarea
                    className="input min-h-[100px]"
                    placeholder="Detailed description of the tender requirements..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    minLength={10}
                    maxLength={2000}
                  />
                </div>

                <div>
                  <label className="label">Submission Deadline</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    required
                  />
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Must be in the future</p>
                </div>

                {createError && (
                  <div className="p-3 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-100 dark:border-red-500/20 text-sm text-red-700 dark:text-red-400">
                    {createError}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="btn-primary"
                  >
                    {creating ? 'Creating...' : 'Create Tender'}
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
