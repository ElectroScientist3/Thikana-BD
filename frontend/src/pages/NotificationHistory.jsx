import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getNotificationHistory } from '../services/telegramNotifications';

const typeOptions = [
  ['', 'All types'],
  ['viewing_request', 'Viewing request'],
  ['viewing_response', 'Viewing response'],
  ['application_status', 'Application status'],
  ['payment_confirmation', 'Payment confirmation'],
  ['rent_reminder', 'Rent reminder'],
  ['new_message', 'New message'],
  ['maintenance_update', 'Maintenance update'],
  ['verification_status', 'Verification status'],
  ['review_received', 'Review received'],
  ['fraud_report', 'Fraud report'],
];

const icons = {
  viewing_request: '👁️', viewing_response: '📅', application_status: '📄', payment_confirmation: '💳',
  rent_reminder: '⏰', new_message: '💬', maintenance_update: '🛠️', verification_status: '✓',
  review_received: '★', fraud_report: '⚠️',
};

function relativeTime(value) {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(value).toLocaleDateString();
}

function NotificationHistory() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getNotificationHistory({ page: pagination.page, limit: pagination.limit, type: type || undefined, status: status || undefined })
      .then((response) => {
        if (!active) return;
        setLogs(response.data.logs || []);
        setPagination((current) => ({ ...current, ...(response.data.pagination || {}) }));
        setError('');
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.msg || 'Unable to load notification history.');
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [pagination.page, pagination.limit, status, type]);

  const filteredLogs = useMemo(() => logs.filter((item) => {
    const matchesStatus = !status || item.status === status;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${item.title} ${item.message} ${item.type}`.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  }), [logs, search, status]);

  const pageCount = pagination.totalPages || 1;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><Link to="/dashboard/profile" className="text-sm font-semibold text-blue-600 hover:text-blue-700">← Profile</Link><h1 className="mt-2 text-3xl font-bold text-slate-900">Notification history</h1><p className="mt-1 text-sm text-slate-500">Review Telegram delivery activity and important account updates.</p></div>
        <div className="flex flex-wrap gap-2">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notifications" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500" />
          <select value={type} onChange={(event) => { setType(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">All types</option>{typeOptions.slice(1).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">All statuses</option><option value="sent">Sent</option><option value="pending">Pending</option><option value="failed">Failed</option></select>
        </div>
      </div>

      {loading ? <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading notification history...</div> : error ? <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div> : filteredLogs.length === 0 ? <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center"><div className="text-4xl">🔔</div><h2 className="mt-3 text-xl font-semibold text-slate-900">No notifications found</h2><p className="mt-2 text-sm text-slate-500">Try another filter or connect Telegram from your profile.</p></div> : <div className="space-y-3">{filteredLogs.map((item) => <article key={item._id} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">{icons[item.type] || '🔔'}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-slate-900">{item.title}</h2><span className="text-xs text-slate-500">{relativeTime(item.createdAt)}</span></div><p className="mt-1 text-sm text-slate-600">{item.message}</p><div className="mt-3 flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-600">{item.type.replaceAll('_', ' ')}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${item.status === 'sent' ? 'bg-emerald-50 text-emerald-700' : item.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{item.status}</span></div></div></article>)}</div>}

      {!loading && !error && filteredLogs.length > 0 && <div className="mt-6 flex items-center justify-between"><button type="button" disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Previous</button><span className="text-sm text-slate-500">Page {pagination.page} of {pageCount}</span><button type="button" disabled={pagination.page >= pageCount} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Next</button></div>}
    </div>
  );
}

export default NotificationHistory;
