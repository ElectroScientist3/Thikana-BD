import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const plans = {
  basic: {
    name: "Basic",
    tokens: 20,
    price: "9.99 tk",
    highlight: "Starter access for light property discovery",
  },
  pro: {
    name: "Pro",
    tokens: 100,
    price: "49.99 tk",
    highlight: "Best for active landlords and renters",
  },
  premium: {
    name: "Premium",
    tokens: 200,
    price: "99.99 tk",
    highlight: "Maximum AI-assisted searches for serious users",
  },
};

const transactions = [
  {
    id: "TXN-2034",
    plan: "Basic",
    tokens: 20,
    amount: "9.99 tk",
    status: "Paid",
    date: "2026-08-02",
  },
  {
    id: "TXN-2039",
    plan: "Pro",
    tokens: 100,
    amount: "49.99 tk",
    status: "Pending",
    date: "2026-08-04",
  },
  {
    id: "TXN-2047",
    plan: "Premium",
    tokens: 200,
    amount: "99.99 tk",
    status: "Paid",
    date: "2026-08-05",
  },
];

function Payment() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedPlanKey = searchParams.get("plan") || "basic";
  const selectedPlan = plans[selectedPlanKey] || plans.basic;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-900 px-6 py-6 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-blue-100">Payments</div>
              <h1 className="text-3xl font-bold mt-2">Token purchase and payment history</h1>
            </div>
            <button
              onClick={() => navigate("/dashboard?token=buy")}
              className="rounded-full bg-white text-slate-900 px-5 py-2 font-semibold"
            >
              Buy Token
            </button>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Selected plan</div>
            <div className="mt-3 text-2xl font-bold text-slate-900">{selectedPlan.name} Token Pack</div>
            <div className="mt-2 text-sm text-slate-600">{selectedPlan.highlight}</div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white p-4 border border-slate-200">
                <div className="text-xs text-slate-500">Tokens</div>
                <div className="text-xl font-bold text-slate-900">{selectedPlan.tokens}</div>
              </div>
              <div className="rounded-2xl bg-white p-4 border border-slate-200">
                <div className="text-xs text-slate-500">Price</div>
                <div className="text-xl font-bold text-slate-900">{selectedPlan.price}</div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 text-white p-4">
              <div className="text-sm font-semibold">Secure payment ready</div>
              <div className="text-xs mt-1">You can complete checkout here once the AI agent token purchase flow is connected to your gateway.</div>
            </div>

            <div className="mt-5 space-y-3">
              {Object.entries(plans).map(([key, plan]) => (
                <button
                  key={key}
                  onClick={() => navigate(`/dashboard/payments?plan=${key}`)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selectedPlanKey === key
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{plan.name}</span>
                    <span className="text-sm text-slate-600">{plan.price}</span>
                  </div>
                  <div className="text-sm text-slate-500 mt-1">{plan.tokens} tokens</div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Transaction information</div>
                <h2 className="text-2xl font-bold text-slate-900">Payment history</h2>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-slate-600">
                    <th className="px-3 py-3 font-semibold">Txn ID</th>
                    <th className="px-3 py-3 font-semibold">Plan</th>
                    <th className="px-3 py-3 font-semibold">Tokens</th>
                    <th className="px-3 py-3 font-semibold">Amount</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => (
                    <tr key={txn.id} className="border-t border-slate-200">
                      <td className="px-3 py-3 font-semibold text-slate-900">{txn.id}</td>
                      <td className="px-3 py-3">{txn.plan}</td>
                      <td className="px-3 py-3">{txn.tokens}</td>
                      <td className="px-3 py-3">{txn.amount}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${txn.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {txn.status}
                        </span>
                      </td>
                      <td className="px-3 py-3">{txn.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default Payment;
