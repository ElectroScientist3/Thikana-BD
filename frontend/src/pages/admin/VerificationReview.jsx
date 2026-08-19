import { useEffect, useState } from 'react';
import { getVerificationDetails, getVerificationQueue, getVerificationStats, reviewVerification } from '../../services/verificationApi';

const statuses = ['', 'pending', 'under_review', 'requires_more_info', 'approved', 'rejected'];

function VerificationReview() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('pending');
  const [stats, setStats] = useState({});
  const [tab, setTab] = useState('documents');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const loadQueue = async () => {
    setLoading(true);
    try {
      const [queue, summary] = await Promise.all([getVerificationQueue({ status: status || undefined }), getVerificationStats()]);
      setItems(queue.data.verifications || []);
      setStats(summary.data.stats || {});
      if (queue.data.verifications?.[0]) await loadDetails(queue.data.verifications[0]._id);
      else setSelected(null);
    } catch (requestError) {
      setError(requestError.response?.data?.msg || 'Unable to load verification queue.');
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async (id) => {
    try {
      const response = await getVerificationDetails(id);
      setSelected(response.data.verification);
      setReviewNotes(response.data.verification.reviewNotes || '');
      setRejectionReason(response.data.verification.rejectionReason || '');
    } catch (requestError) {
      setError(requestError.response?.data?.msg || 'Unable to load verification details.');
    }
  };

  useEffect(() => { loadQueue(); }, [status]);

  const act = async (nextStatus) => {
    if (!selected) return;
    if (nextStatus === 'rejected' && !rejectionReason.trim()) return setError('Add a rejection reason first.');
    setWorking(true);
    try {
      await reviewVerification(selected._id, { status: nextStatus, rejectionReason, reviewNotes, badge: nextStatus === 'approved' ? 'basic' : 'none' });
      await loadQueue();
    } catch (requestError) {
      setError(requestError.response?.data?.msg || 'Unable to update verification.');
    } finally {
      setWorking(false);
    }
  };

  const property = selected?.propertyId;
  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-7xl"><div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Admin console</p><h1 className="mt-2 text-3xl font-bold text-slate-900">Property verification</h1></div><div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4"><div className="rounded-2xl bg-white px-4 py-3 shadow-sm"><div className="text-2xl font-bold text-amber-600">{stats.pending || 0}</div><div className="text-xs text-slate-500">Pending</div></div><div className="rounded-2xl bg-white px-4 py-3 shadow-sm"><div className="text-2xl font-bold text-blue-600">{stats.under_review || 0}</div><div className="text-xs text-slate-500">Under review</div></div><div className="rounded-2xl bg-white px-4 py-3 shadow-sm"><div className="text-2xl font-bold text-emerald-600">{stats.approved || 0}</div><div className="text-xs text-slate-500">Approved</div></div><div className="rounded-2xl bg-white px-4 py-3 shadow-sm"><div className="text-2xl font-bold text-red-600">{stats.rejected || 0}</div><div className="text-xs text-slate-500">Rejected</div></div></div></div>{error && <div className="mb-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}<div className="grid min-h-[650px] gap-4 lg:grid-cols-[18rem_1fr]"><aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">All statuses</option>{statuses.slice(1).map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select><div className="mt-4 space-y-2">{loading ? <p className="text-sm text-slate-500">Loading queue...</p> : items.map((item) => <button type="button" key={item._id} onClick={() => loadDetails(item._id)} className={`w-full rounded-xl p-3 text-left ${selected?._id === item._id ? 'bg-blue-50 ring-1 ring-blue-300' : 'bg-slate-50 hover:bg-slate-100'}`}><div className="truncate text-sm font-semibold text-slate-900">{item.propertyId?.title || 'Property'}</div><div className="mt-1 text-xs capitalize text-slate-500">{item.verificationStatus.replaceAll('_', ' ')}</div><div className="mt-1 text-xs text-slate-400">{item.ownerId?.name}</div></button>)}</div></aside><main className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">{!selected ? <div className="flex h-full items-center justify-center text-sm text-slate-500">No verification selected.</div> : <><div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row"><div><h2 className="text-2xl font-bold text-slate-900">{property?.title}</h2><p className="mt-1 text-sm text-slate-500">Owner: {selected.ownerId?.name} · {selected.ownerId?.email}</p><p className="text-sm text-slate-500">{property?.area}, {property?.city}</p></div><span className="h-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold capitalize text-amber-700">{selected.verificationStatus.replaceAll('_', ' ')}</span></div><div className="mt-5 flex gap-2 overflow-x-auto border-b border-slate-200">{['documents', 'photos', 'mobile', 'property'].map((item) => <button type="button" key={item} onClick={() => setTab(item)} className={`shrink-0 border-b-2 px-3 py-2 text-sm font-semibold capitalize ${tab === item ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>{item === 'mobile' ? 'Mobile verification' : item}</button>)}</div><div className="mt-6 min-h-[250px]">{tab === 'documents' && <div className="grid gap-3 sm:grid-cols-2">{Object.entries(selected.documents || {}).filter(([key]) => key !== 'propertyPhotos').map(([key, url]) => <a href={url} target="_blank" rel="noreferrer" key={key} className="rounded-2xl border border-slate-200 p-4 text-sm font-semibold capitalize text-blue-700 hover:bg-blue-50">View {key.replaceAll(/([A-Z])/g, ' $1')}</a>)}</div>}{tab === 'photos' && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{(selected.documents?.propertyPhotos || []).map((url) => <a href={url} target="_blank" rel="noreferrer" key={url}><img src={url} alt="Property" className="aspect-square w-full rounded-xl object-cover" /></a>)}</div>}{tab === 'mobile' && <div className="rounded-2xl bg-slate-50 p-5 text-sm"><div>Phone: <strong>{selected.mobileVerification?.phone || 'Not provided'}</strong></div><div className="mt-2">Status: <strong>{selected.mobileVerification?.verified ? 'Verified' : 'Not verified'}</strong></div></div>}{tab === 'property' && <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2"><div>Rent: BDT {property?.monthly_rent_bdt}</div><div>Type: {property?.property_type}</div><div>Rooms: {property?.rooms || 1}</div><div>Address: {property?.address || `${property?.area}, ${property?.city}`}</div></div>}</div><div className="border-t border-slate-200 pt-5"><textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder="Review notes" rows={3} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" /><textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Rejection reason (required for rejection)" rows={2} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" /><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={working} onClick={() => act('approved')} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Approve</button><button type="button" disabled={working} onClick={() => act('rejected')} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Reject</button><button type="button" disabled={working} onClick={() => act('requires_more_info')} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Request More Info</button></div></div></>}</main></div></div></div>
  );
}

export default VerificationReview;
