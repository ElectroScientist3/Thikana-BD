import { useState } from "react";

const starterMessages = [
  "Find me a 2-bedroom flat under ৳30,000 in Dhaka.",
  "Show me options near the university area with wifi.",
  "Suggest a safe rental home with a parking facility.",
];

function Agent() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "agent",
      text: "Hi, I’m ThikanaAI. I can help you shortlist rentals based on location, budget, and comfort requirements.",
    },
  ]);
  const [input, setInput] = useState("");
  const [tokensLeft, setTokensLeft] = useState(18);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now(),
      sender: "user",
      text: input,
    };

    const aiReply = {
      id: Date.now() + 1,
      sender: "agent",
      text: `I can help with that. Based on your request, I would shortlist homes near your preferred location and match your budget and amenities. Token-based premium search is ready for integration.`,
    };

    setMessages((prev) => [...prev, userMessage, aiReply]);
    setInput("");
    setTokensLeft((prev) => Math.max(prev - 1, 0));
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-900 via-sky-800 to-blue-700 text-white px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-100">AI Assistant</div>
              <h1 className="text-3xl font-bold mt-2">ThikanaAI Agent</h1>
            </div>
            <div className="rounded-2xl bg-white/15 px-4 py-3 text-right">
              <div className="text-xs tracking-[0.25em] text-cyan-100">Tokens left</div>
              <div className="text-2xl font-bold">{tokensLeft}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-0">
          <aside className="border-b xl:border-b-0 xl:border-r border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Quick prompts</div>
            <div className="mt-4 space-y-3">
              {starterMessages.map((msg) => (
                <button
                  key={msg}
                  onClick={() => setInput(msg)}
                  className="w-full text-left rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 hover:border-cyan-400 hover:bg-cyan-50"
                >
                  {msg}
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
              <div className="font-semibold text-cyan-900">Buy more tokens</div>
              <div className="text-sm text-slate-600 mt-1">Use the payment tab to purchase a token bundle.</div>
              <button
                onClick={() => window.location.href = "/dashboard/payments?plan=pro"}
                className="mt-3 rounded-full bg-cyan-700 text-white px-4 py-2 text-sm font-semibold"
              >
                Open Payment Tab
              </button>
            </div>
          </aside>

          <section className="p-5">
            <div className="h-[320px] overflow-y-auto space-y-3 bg-slate-50 rounded-2xl p-4 border border-slate-200">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    message.sender === "user"
                      ? "ml-auto bg-cyan-700 text-white"
                      : "bg-white border border-slate-200 text-slate-700"
                  }`}
                >
                  {message.text}
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the AI assistant about preferred tolets..."
                className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button
                onClick={handleSend}
                className="rounded-2xl bg-cyan-700 text-white px-5 py-3 font-semibold"
              >
                Send
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default Agent;
