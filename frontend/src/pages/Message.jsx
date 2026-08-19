import { useEffect, useMemo, useState } from "react";
import { getConversationMessages, getConversations, markConversationRead, sendConversationMessage } from "../services/conversationApi";
import { connectSocket } from "../services/socket";
import { useAuth } from "../context/AuthContext";

const formatTime = (value) => value ? new Date(value).toLocaleString() : "";

function Message() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const socket = useMemo(() => connectSocket(), []);
  const selectedConversation = conversations.find((item) => item._id === selectedId);

  useEffect(() => {
    let active = true;
    getConversations()
      .then((response) => {
        if (!active) return;
        const items = response.data.conversations || [];
        setConversations(items);
        if (items[0]) setSelectedId(items[0]._id);
      })
      .catch((requestError) => active && setError(requestError.response?.data?.msg || "Unable to load conversations."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedId) return undefined;
    let active = true;
    setMessagesLoading(true);
    getConversationMessages(selectedId, { page: 1, limit: 100 })
      .then((response) => active && setMessages((response.data.messages || []).reverse()))
      .catch((requestError) => active && setError(requestError.response?.data?.msg || "Unable to load messages."))
      .finally(() => active && setMessagesLoading(false));
    markConversationRead(selectedId).catch(() => {});
    if (socket) socket.emit("join-conversation", selectedId);
    return () => {
      if (socket) socket.emit("leave-conversation", selectedId);
      active = false;
    };
  }, [selectedId, socket]);

  useEffect(() => {
    if (!socket) return undefined;
    const handleMessage = (message) => {
      if (message.conversationId !== selectedId) return;
      setMessages((current) => current.some((item) => item._id === message._id) ? current : [...current, message]);
      markConversationRead(selectedId).catch(() => {});
    };
    socket.on("new-message", handleMessage);
    return () => socket.off("new-message", handleMessage);
  }, [selectedId, socket]);

  const handleSend = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !selectedId || sending) return;
    setSending(true);
    setError("");
    try {
      if (socket?.connected) {
        await new Promise((resolve, reject) => {
          socket.emit("send-message", { conversationId: selectedId, content }, (result) => result?.ok ? resolve(result) : reject(new Error(result?.error || "Unable to send message")));
        });
      } else {
        const response = await sendConversationMessage(selectedId, content);
        setMessages((current) => [...current, response.data.message]);
      }
      setDraft("");
    } catch (sendError) {
      setError(sendError.response?.data?.msg || sendError.message || "Unable to send message.");
    } finally {
      setSending(false);
    }
  };

  const otherParticipant = selectedConversation && (String(selectedConversation.tenantId?._id) === String(user?.id) ? selectedConversation.ownerId : selectedConversation.tenantId);

  return (
    <div className="p-6 md:p-8">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-900 px-6 py-6 text-white">
          <div className="text-xs uppercase tracking-[0.3em] text-indigo-100">Messages</div>
          <h1 className="text-3xl font-bold mt-2">Property Owner Communication</h1>
        </div>

        {error && <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">{error}</div>}
        <div className="grid grid-cols-1 gap-0 xl:grid-cols-[0.95fr_1.05fr]">
          <aside className="border-b xl:border-b-0 xl:border-r border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Recent chats</div>
            {loading ? <div className="mt-4 text-sm text-slate-500">Loading conversations...</div> : conversations.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">No conversations yet. Tenants can start one from a property listing.</div> : <div className="mt-4 space-y-3">{conversations.map((conversationItem) => { const participant = String(conversationItem.tenantId?._id) === String(user?.id) ? conversationItem.ownerId : conversationItem.tenantId; const unread = String(conversationItem.tenantId?._id) === String(user?.id) ? conversationItem.tenantUnreadCount : conversationItem.ownerUnreadCount; return <button type="button" key={conversationItem._id} onClick={() => setSelectedId(conversationItem._id)} className={`block w-full rounded-2xl border p-4 text-left ${selectedId === conversationItem._id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white"}`}><div className="font-semibold text-slate-900">{participant?.name || "Participant"}</div><div className="mt-1 text-xs text-slate-500">{conversationItem.propertyId?.title || "Property"}</div><div className="mt-2 flex items-center justify-between text-xs text-slate-500"><span className="truncate">{conversationItem.lastMessage || "No messages yet"}</span>{unread > 0 && <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 font-bold text-white">{unread}</span>}</div></button>; })}</div>}
          </aside>

          <section className="p-5">
            <div className="min-h-[380px] rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">{otherParticipant?.name || "Select a conversation"}</div>
                  <div className="text-xs text-slate-500">{selectedConversation?.propertyId?.title || "Private property conversation"}</div>
                </div>
                {selectedConversation && <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">Private chat</span>}
              </div>

              {messagesLoading ? <div className="py-16 text-center text-sm text-slate-500">Loading messages...</div> : <div className="max-h-[420px] space-y-3 overflow-y-auto">{messages.length === 0 ? <div className="py-16 text-center text-sm text-slate-500">No messages yet.</div> : messages.map((message) => { const mine = String(message.senderId?._id || message.senderId) === String(user?.id); return <div key={message._id} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${mine ? "ml-auto bg-indigo-700 text-white" : "border border-slate-200 bg-white text-slate-700"}`}><div>{message.content}</div><div className={`mt-1 text-[11px] ${mine ? "text-indigo-100" : "text-slate-400"}`}>{formatTime(message.createdAt)}</div></div>; })}</div>}
              {selectedConversation && <form onSubmit={handleSend} className="mt-5 flex gap-2"><input value={draft} maxLength={2000} onChange={(event) => setDraft(event.target.value)} placeholder="Write a private message..." className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500" /><button type="submit" disabled={sending || !draft.trim()} className="rounded-xl bg-indigo-700 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50">{sending ? "Sending..." : "Send"}</button></form>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default Message;
