import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getConversations } from '../services/conversationApi';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const formatTime = (value) => value ? new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';

function Messages() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, isUserOnline } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadConversations = useCallback(async () => {
    try {
      const response = await getConversations();
      setConversations((response.data.conversations || []).sort((first, second) => new Date(second.lastMessageAt || second.createdAt) - new Date(first.lastMessageAt || first.createdAt)));
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.msg || 'Unable to load conversations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!socket) return undefined;
    socket.on('conversation-updated', loadConversations);
    socket.on('conversation-read', loadConversations);
    return () => {
      socket.off('conversation-updated', loadConversations);
      socket.off('conversation-read', loadConversations);
    };
  }, [loadConversations, socket]);

  const filteredConversations = useMemo(() => conversations.filter((conversation) => {
    const participant = String(conversation.tenantId?._id) === String(user?.id) ? conversation.ownerId : conversation.tenantId;
    const text = `${conversation.propertyId?.title || ''} ${participant?.name || ''} ${conversation.lastMessage || ''}`.toLowerCase();
    return text.includes(search.trim().toLowerCase());
  }), [conversations, search, user?.id]);

  const unreadTotal = conversations.reduce((total, conversation) => {
    const tenantOwnsConversation = String(conversation.tenantId?._id) === String(user?.id);
    return total + (tenantOwnsConversation ? conversation.tenantUnreadCount : conversation.ownerUnreadCount);
  }, 0);

  return (
    <div className="mx-auto min-h-screen max-w-5xl bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-900 p-6 text-white sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs uppercase tracking-[0.3em] text-indigo-200">Private conversations</p><h1 className="mt-2 text-3xl font-bold">Messages</h1><p className="mt-2 text-sm text-slate-300">Chat privately about a specific ThikanaBD property.</p></div>
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3"><div className="text-xs uppercase tracking-wider text-indigo-200">Unread</div><div className="mt-1 text-2xl font-bold">{unreadTotal}</div></div>
          </div>
        </div>
        <div className="border-b border-slate-200 p-4"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-500" /></div>
        {error && <div className="m-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {loading ? <div className="p-12 text-center text-sm text-slate-500">Loading conversations...</div> : filteredConversations.length === 0 ? <div className="p-14 text-center"><div className="text-4xl">💬</div><h2 className="mt-3 text-xl font-semibold text-slate-900">No conversations yet</h2><p className="mt-2 text-sm text-slate-500">Tenants can start a conversation from a property listing.</p></div> : <div className="divide-y divide-slate-100">{filteredConversations.map((conversation) => { const participant = String(conversation.tenantId?._id) === String(user?.id) ? conversation.ownerId : conversation.tenantId; const isTenant = String(conversation.tenantId?._id) === String(user?.id); const unread = isTenant ? conversation.tenantUnreadCount : conversation.ownerUnreadCount; return <button type="button" key={conversation._id} onClick={() => navigate(`/messages/${conversation._id}`)} className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-indigo-50/50 sm:p-5"><div className="relative shrink-0"><img src={conversation.propertyId?.images?.[0] || '/thikana-brand.svg'} alt="" className="h-14 w-14 rounded-2xl object-cover" /><span className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white ${isUserOnline(participant?._id) ? 'bg-emerald-500' : 'bg-slate-300'}`} /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><h2 className="truncate font-semibold text-slate-900">{participant?.name || 'Participant'}</h2><span className="shrink-0 text-xs text-slate-400">{formatTime(conversation.lastMessageAt || conversation.createdAt)}</span></div><div className="mt-1 text-sm font-medium text-indigo-700">{conversation.propertyId?.title || 'Property'}</div><p className="mt-1 truncate text-sm text-slate-500">{conversation.lastMessage || 'No messages yet'}</p></div>{unread > 0 && <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-2 text-xs font-bold text-white">{unread}</span>}</button>; })}</div>}
      </div>
    </div>
  );
}

export default Messages;
