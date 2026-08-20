const conversation = [
  {
    sender: "owner",
    text: "Hello, the apartment viewing is confirmed for tomorrow at 11:00 AM.",
    time: "09:10 AM",
  },
  {
    sender: "user",
    text: "Great. Please share the exact location details and ownership documents.",
    time: "09:14 AM",
  },
  {
    sender: "owner",
    text: "Sure. I have shared the map pin and the property guide in your inbox.",
    time: "09:18 AM",
  },
];

function Message() {
  return (
    <div className="p-6 md:p-8">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-900 px-6 py-6 text-white">
          <div className="text-xs uppercase tracking-[0.3em] text-indigo-100">Messages</div>
          <h1 className="text-3xl font-bold mt-2">Property Owner Communication</h1>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-0">
          <aside className="border-b xl:border-b-0 xl:border-r border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Recent chats</div>
            <div className="mt-4 space-y-3">
              {[
                { name: "Skyline Residency Owner", status: "Online" },
                { name: "Harbor Heights Team", status: "Away" },
                { name: "Lake View Homes", status: "Online" },
              ].map((chat) => (
                <div key={chat.name} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="font-semibold text-slate-900">{chat.name}</div>
                  <div className="text-xs text-slate-500 mt-1">{chat.status}</div>
                </div>
              ))}
            </div>
          </aside>

          <section className="p-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 min-h-[380px]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">Skyline Residency Owner</div>
                  <div className="text-xs text-slate-500">Latest conversation</div>
                </div>
                <span className="rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-semibold">Online</span>
              </div>

              <div className="space-y-3">
                {conversation.map((msg, idx) => (
                  <div
                    key={`${msg.sender}-${idx}`}
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                      msg.sender === "user"
                        ? "ml-auto bg-indigo-700 text-white"
                        : "bg-white border border-slate-200 text-slate-700"
                    }`}
                  >
                    <div>{msg.text}</div>
                    <div className={`mt-1 text-[11px] ${msg.sender === "user" ? "text-indigo-100" : "text-slate-400"}`}>{msg.time}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default Message;
