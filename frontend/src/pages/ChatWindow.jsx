import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getConversationMessages, getConversations, markConversationRead, sendConversationMessage } from '../services/conversationApi';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const formatTime = (value) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const formatDate = (value) => new Date(value).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
const sameDay = (first, second) => new Date(first).toDateString() === new Date(second).toDateString();

function ChatWindow() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, connected, reconnecting, isUserOnline } = useSocket();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState('');
  const [failedMessage, setFailedMessage] = useState('');
  const scrollRef = useRef(null);
  const typingTimer = useRef(null);

  const isTenant = String(conversation?.tenantId?._id) === String(user?.id);
  const otherUser = conversation && (isTenant ? conversation.ownerId : conversation.tenantId);
  const property = conversation?.propertyId;
  const otherOnline = isUserOnline(otherUser?._id);

  const loadConversation = useCallback(async () => {
    const response = await getConversations();
    const found = (response.data.conversations || []).find((item) => item._id === conversationId);
    if (!found) throw new Error('Conversation not found or access denied');
    setConversation(found);
  }, [conversationId]);

  const scrollToBottom = useCallback((smooth = false) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  const loadMessages = useCallback(async (targetPage = 1, older = false) => {
    if (older) setLoadingOlder(true); else setLoading(true);
    try {
      const response = await getConversationMessages(conversationId, { page: targetPage, limit: 50 });
      const incoming = (response.data.messages || []).reverse();
      setMessages((current) => {
        if (!older) return incoming;
        const existingIds = new Set(current.map((message) => message._id));
        return [...incoming.filter((message) => !existingIds.has(message._id)), ...current];
      });
      setPage(targetPage);
      setHasMore(targetPage < (response.data.pagination?.totalPages || 0));
      return incoming.length;
    } finally {
      if (older) setLoadingOlder(false); else setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    let active = true;
    Promise.all([loadConversation(), loadMessages()])
      .then(() => active && window.setTimeout(() => scrollToBottom(), 0))
      .catch((requestError) => active && setError(requestError.response?.data?.msg || requestError.message || 'Unable to load chat.'));
    markConversationRead(conversationId).catch(() => {});
    return () => { active = false; };
  }, [conversationId, loadConversation, loadMessages, scrollToBottom]);

  useEffect(() => {
    if (!socket || !conversationId) return undefined;
    const join = () => socket.emit('join-conversation', conversationId);
    const handleMessage = (message) => {
      if (String(message.conversationId) !== String(conversationId)) return;
      setMessages((current) => current.some((item) => item._id === message._id) ? current : [...current, message]);
      markConversationRead(conversationId).catch(() => {});
      window.setTimeout(() => scrollToBottom(true), 0);
    };
    const handleTyping = ({ userId }) => {
      if (String(userId) !== String(user?.id)) setTyping(true);
    };
    const handleStopTyping = ({ userId }) => {
      if (String(userId) !== String(user?.id)) setTyping(false);
    };
    const handleMessagesRead = ({ conversationId: readConversationId, userId: readerId }) => {
      if (String(readConversationId) !== String(conversationId)) return;
      setMessages((current) => current.map((message) => String(message.receiverId?._id || message.receiverId) === String(readerId) ? { ...message, isRead: true } : message));
    };
    if (connected) join();
    socket.on('connect', join);
    socket.on('new-message', handleMessage);
    socket.on('user-typing', handleTyping);
    socket.on('user-stop-typing', handleStopTyping);
    socket.on('messages-read', handleMessagesRead);
    return () => {
      socket.emit('leave-conversation', conversationId);
      socket.off('connect', join);
      socket.off('new-message', handleMessage);
      socket.off('user-typing', handleTyping);
      socket.off('user-stop-typing', handleStopTyping);
      socket.off('messages-read', handleMessagesRead);
    };
  }, [connected, conversationId, scrollToBottom, socket, user?.id]);

  const handleScroll = async (event) => {
    if (event.currentTarget.scrollTop > 60 || !hasMore || loadingOlder) return;
    const previousHeight = event.currentTarget.scrollHeight;
    await loadMessages(page + 1, true);
    window.requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight - previousHeight;
    });
  };

  const sendMessage = async (content) => {
    const cleanContent = content.trim();
    if (!cleanContent || cleanContent.length > 2000 || sending) return;
    setSending(true);
    setError('');
    setFailedMessage('');
    try {
      if (socket?.connected) {
        await new Promise((resolve, reject) => {
          socket.emit('send-message', { conversationId, content: cleanContent }, (result) => result?.ok ? resolve(result) : reject(new Error(result?.error || 'Message could not be sent')));
        });
      } else {
        const response = await sendConversationMessage(conversationId, cleanContent);
        setMessages((current) => current.some((item) => item._id === response.data.message._id) ? current : [...current, response.data.message]);
      }
      setDraft('');
      window.setTimeout(() => scrollToBottom(true), 0);
    } catch (sendError) {
      setFailedMessage(cleanContent);
      setError(sendError.response?.data?.msg || sendError.message || 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const handleDraftChange = (event) => {
    const value = event.target.value.slice(0, 2000);
    setDraft(value);
    event.target.style.height = 'auto';
    event.target.style.height = `${Math.min(event.target.scrollHeight, 140)}px`;
    if (socket?.connected && conversationId) {
      socket.emit('typing', conversationId);
      window.clearTimeout(typingTimer.current);
      typingTimer.current = window.setTimeout(() => socket.emit('stop-typing', conversationId), 900);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage(draft);
  };

  const renderedMessages = useMemo(() => messages.map((message, index) => {
    const mine = String(message.senderId?._id || message.senderId) === String(user?.id);
    const previous = messages[index - 1];
    return { message, mine, showDate: !previous || !sameDay(previous.createdAt, message.createdAt) };
  }), [messages, user?.id]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      {reconnecting && <div className="bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-amber-950">Reconnecting to messaging...</div>}
      <header className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6"><div className="mx-auto flex max-w-5xl items-center gap-3"><button type="button" onClick={() => navigate('/messages')} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">← Messages</button>{otherUser && <><div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700">{otherUser.name?.slice(0, 1).toUpperCase() || '?'}</div><div className="min-w-0"><h1 className="truncate font-semibold text-slate-900">{otherUser.name || 'Participant'}</h1><div className="flex items-center gap-2 text-xs text-slate-500"><span className={`h-2 w-2 rounded-full ${otherOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />{otherOnline ? 'Online' : 'Offline'}</div></div></>}</div></header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-4 sm:px-6"><div className="mb-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"><div className="min-w-0"><p className="text-xs uppercase tracking-wider text-slate-500">Property</p><p className="truncate font-semibold text-slate-900">{property?.title || 'Loading property...'}</p><p className="truncate text-xs text-slate-500">{property?.area}, {property?.city}</p></div>{property?._id && <Link to={`/dashboard/properties?listingId=${property._id}`} className="shrink-0 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">View Property</Link>}</div>
        {error && <div className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}{failedMessage && <button type="button" onClick={() => sendMessage(failedMessage)} className="ml-3 font-bold underline">Retry</button>}</div>}
        <section ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-6">{loading ? <div className="py-20 text-center text-sm text-slate-500">Loading messages...</div> : <>{loadingOlder && <div className="pb-3 text-center text-xs text-slate-500">Loading older messages...</div>}{renderedMessages.length === 0 ? <div className="py-20 text-center text-sm text-slate-500">No messages yet. Start the conversation.</div> : renderedMessages.map(({ message, mine, showDate }) => <div key={message._id}>{showDate && <div className="my-5 text-center text-xs font-semibold text-slate-400">{formatDate(message.createdAt)}</div>}<div className={`mb-3 flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm sm:max-w-[70%] ${mine ? 'bg-indigo-700 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}><p className="whitespace-pre-wrap break-words">{message.content}</p><div className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${mine ? 'text-indigo-100' : 'text-slate-400'}`}><span>{formatTime(message.createdAt)}</span>{mine && <span>{message.isRead ? '✓✓' : '✓'}</span>}</div></div></div></div>)}</>}</section>
        {typing && <div className="px-3 py-2 text-xs italic text-slate-500">typing<span className="animate-pulse">...</span></div>}
        <form onSubmit={handleSubmit} className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><textarea value={draft} onChange={handleDraftChange} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleSubmit(event); } }} maxLength={2000} rows={1} placeholder={connected ? 'Write a message...' : 'Messaging connection unavailable'} disabled={!conversation || sending} className="max-h-[140px] min-h-[42px] w-full resize-none border-0 px-2 py-2 text-sm outline-none disabled:bg-white" /><div className="flex items-center justify-between gap-3"><span className={`text-xs ${draft.length >= 1900 ? 'text-red-600' : 'text-slate-400'}`}>{draft.length}/2000</span><button type="submit" disabled={sending || !draft.trim() || !conversation} className="rounded-xl bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50">{sending ? 'Sending...' : 'Send'}</button></div></form>
      </main>
    </div>
  );
}

export default ChatWindow;
