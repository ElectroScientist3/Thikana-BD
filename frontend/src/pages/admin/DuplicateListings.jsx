import { useEffect, useMemo, useState } from 'react';
import { getDuplicateFlags, resolveDuplicateFlag } from '../../services/verificationApi';

function DuplicateListings() {
  const [flags, setFlags] = useState([]);
  const [status, setStatus] = useState('pending_review');
  const [minimumScore, setMinimumScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const loadFlags = async () => {
    setLoading(true);
    try {
      const response = await getDuplicateFlags({ status: status || undefined });
      const nextFlags = response.data.flags || [];
      setFlags(nextFlags);
      setSelected((current) => nextFlags.find((item) => item._id === current?._id) || nextFlags[0] || null);
    } catch (requestError) {
      setError(requestError.response?.data?.msg || 'Unable to load duplicate flags.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFlags(); }, [status]);

  const visibleFlags = useMemo(() => flags.filter((flag) => flag.overallSimilarity >= minimumScore), [flags, minimumScore]);
  const counts = {
    total: flags.length,
    pending: flags.filter((flag) => flag.status === 'pending_review').length,
    confirmed: flags.filter((flag) => flag.status === 'confirmed_duplicate').length,
  };

  const resolve = async (nextStatus) => {
    if (!selected) return;
    setWorking(true);
    try {
      await resolveDuplicateFlag(selected._id, { status: nextStatus, reviewNotes: nextStatus === 'confirmed_duplicate' ? 'Confirmed by admin' : 'Dismissed by admin' });
      await loadFlags();
    } catch (requestError) {
      setError(requestError.response?.data?.msg || 'Unable to resolve duplicate flag.');
    } finally {
      setWorking(false);
    }
  };

  const Comparison = ({ listing }) => <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><img src={listing?.images?.[0] || '/thikana-brand.svg'} alt="Property" className="mb-4 aspect-video w-full rounded-xl object-cover" /><h3 className="font-bold text-slate-900">{listing?.title || 'Property'}</h3><p className="mt-1 text-sm text-slate-500">{listing?.area}, {listing?.city}</p><p className="mt-3 text-sm text-slate-600">{listing?.description || 'No description provided.'}</p><p className="mt-3 text-sm font-semibold text-emerald-700">BDT {listing?.monthly_rent_bdt || 'N/A'}</p></div>;

  return <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-7xl"><div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-600">Admin console</p><h1 className="mt-2 text-3xl font-bold text-slate-900">Duplicate listings</h1><p className="mt-2 text-sm text-slate-500">Review properties with suspicious similarity scores.</p></div><div className="mb-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-white p-5 shadow-sm"><div className="text-3xl font-bold text-slate-900">{counts.total}</div><div className="text-sm text-slate-500">Total flags</div></div><div className="rounded-2xl bg-white p-5 shadow-sm"><div className="text-3xl font-bold text-amber-600">{counts.pending}</div><div className="text-sm text-slate-500">Pending review</div></div><div className="rounded-2xl bg-white p-5 shadow-sm"><div className="text-3xl font-bold text-red-600">{counts.confirmed}</div><div className="text-sm text-slate-500">Confirmed duplicates</div></div></div>{error && <div className="mb-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}<div className="grid gap-4 lg:grid-cols-[22rem_1fr]"><aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex gap-2"><select value={status} onChange={(event) => setStatus(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">All statuses</option><option value="pending_review">Pending</option><option value="confirmed_duplicate">Confirmed</option><option value="not_duplicate">Not duplicate</option><option value="dismissed">Dismissed</option></select><select value={minimumScore} onChange={(event) => setMinimumScore(Number(event.target.value))} className="w-24 rounded-xl border border-slate-200 px-2 py-2 text-sm"><option value="0">All scores</option><option value="70">70+</option><option value="80">80+</option><option value="90">90+</option></select></div><div className="mt-4 space-y-2">{loading ? <p className="text-sm text-slate-500">Loading flags...</p> : visibleFlags.map((flag) => <button type="button" key={flag._id} onClick={() => setSelected(flag)} className={`w-full rounded-xl p-3 text-left ${selected?._id === flag._id ? 'bg-red-50 ring-1 ring-red-300' : 'bg-slate-50 hover:bg-slate-100'}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-slate-900">{flag.propertyId?.title || 'Property'}</span><span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">{flag.overallSimilarity}%</span></div><div className="mt-1 text-xs text-slate-500">vs {flag.suspectedDuplicateOf?.title || 'another listing'}</div></button>)}</div></aside><main className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">{!selected ? <div className="flex min-h-[450px] items-center justify-center text-sm text-slate-500">No duplicate flag selected.</div> : <><div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-5 sm:flex-row"><div><h2 className="text-2xl font-bold text-slate-900">Similarity review</h2><p className="mt-1 text-sm text-slate-500">Overall score: {selected.overallSimilarity}% · Matched: {selected.similarityTypes?.join(', ')}</p></div><span className="h-fit rounded-full bg-red-100 px-3 py-1 text-xs font-bold capitalize text-red-700">{selected.status.replaceAll('_', ' ')}</span></div><div className="mt-5 grid gap-4 md:grid-cols-2"><Comparison listing={selected.propertyId} /><Comparison listing={selected.suspectedDuplicateOf} /></div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">{Object.entries(selected.similarityScores || {}).map(([key, score]) => <div key={key} className="rounded-xl bg-slate-50 p-3 text-center"><div className="text-lg font-bold text-slate-900">{score}%</div><div className="text-xs capitalize text-slate-500">{key}</div></div>)}</div><div className="mt-6 flex flex-wrap gap-2 border-t border-slate-200 pt-5"><button type="button" disabled={working} onClick={() => resolve('confirmed_duplicate')} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Confirm duplicate</button><button type="button" disabled={working} onClick={() => resolve('not_duplicate')} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Dismiss flag</button><button type="button" disabled={working} onClick={() => resolve('dismissed')} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50">Warn owner</button></div></>}</main></div></div></div>;
}

export default DuplicateListings;
