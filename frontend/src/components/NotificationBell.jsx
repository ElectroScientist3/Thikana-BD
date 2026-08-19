import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState('');
  const containerRef = useRef(null);

  const loadNotifications = async () => {
    try {
      const response = await api.get('/api/notifications', { params: { limit: 5, page: 1 } });
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unreadCount || 0);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.msg || 'Unable to load notifications.');
    }
  };

  useEffect(() => {
    loadNotifications();
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button type="button" onClick={() => { setOpen((current) => !current); if (!open) loadNotifications(); }} className="relative flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-700 shadow-sm transition hover:bg-slate-200" title="Notifications" aria-label="Notifications">
        🔔
        {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {open && <div className="absolute right-0 z-[80] mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"><div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3"><strong className="text-slate-900">Notifications</strong><span className="text-xs text-slate-500">{unreadCount} unread</span></div>{error ? <div className="p-4 text-sm text-red-600">{error}</div> : notifications.length === 0 ? <div className="p-5 text-center text-sm text-slate-500">No notifications yet.</div> : <div className="divide-y divide-slate-100">{notifications.slice(0, 5).map((notification) => <div key={notification._id} className={`px-4 py-3 text-sm ${notification.read ? 'bg-white' : 'bg-blue-50/60'}`}><div className="font-semibold text-slate-800">{notification.message}</div><div className="mt-1 text-xs text-slate-500">{new Date(notification.created_at).toLocaleString()}</div></div>)}</div>}<Link onClick={() => setOpen(false)} to="/notifications" className="block border-t border-slate-200 px-4 py-3 text-center text-sm font-semibold text-blue-600 hover:bg-blue-50">View All</Link></div>}
    </div>
  );
}

export default NotificationBell;
