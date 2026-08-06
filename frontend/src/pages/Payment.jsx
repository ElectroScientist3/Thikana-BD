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

const bookings = [
  {
    id: "BK-1001",
    property: "Skyline Residency",
    tenant: "Nafis Rahman",
    unit: "A-102",
    moveIn: "2026-08-12",
    status: "Confirmed",
    amount: "৳32,000",
  },
  {
    id: "BK-1002",
    property: "Harbor Heights",
    tenant: "Tanjina Sultana",
    unit: "B-15",
    moveIn: "2026-08-22",
    status: "Pending",
    amount: "৳28,500",
  },
  {
    id: "BK-1003",
    property: "Lake View Homes",
    tenant: "Rafiul Alam",
    unit: "C-07",
    moveIn: "2026-09-01",
    status: "In Review",
    amount: "৳24,000",
  },
];

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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-blue-100">Payments</div>
              <h1 className="text-3xl font-bold mt-2">Token purchase and payment history</h1>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-950/90 px-4 py-3 text-sm text-slate-200 ring-1 ring-white/10">
                <div className="text-slate-300">Active packages</div>
                <div className="mt-1 text-xl font-semibold">3</div>
              </div>
              <div className="rounded-3xl bg-slate-950/90 px-4 py-3 text-sm text-slate-200 ring-1 ring-white/10">
                <div className="text-slate-300">Pending payments</div>
                <div className="mt-1 text-xl font-semibold">2</div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 xl:grid-cols-[0.65fr_1.35fr] gap-6">
          <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm ring-1 ring-slate-100/70">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Selected plan</div>
            <div className="mt-3 text-2xl font-bold text-slate-900">{selectedPlan.name} Token Pack</div>
            <div className="mt-2 text-sm text-slate-600">{selectedPlan.highlight}</div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-white p-4 border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500">Tokens</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">{selectedPlan.tokens}</div>
              </div>
              <div className="rounded-3xl bg-white p-4 border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500">Price</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">{selectedPlan.price}</div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-4 text-white shadow-md shadow-emerald-500/20">
              <div className="text-sm font-semibold">Secure payment ready</div>
              <div className="text-xs mt-1 text-slate-100">You can complete checkout here once the AI agent token purchase flow is connected to your gateway.</div>
            </div>

            <div className="mt-5 space-y-3">
              {Object.entries(plans).map(([key, plan]) => (
                <button
                  key={key}
                  onClick={() => navigate(`/dashboard/payments?plan=${key}`)}
                  className={`w-full rounded-3xl border p-4 text-left transition duration-200 ${
                    selectedPlanKey === key
                      ? "border-blue-600 bg-blue-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
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

          <section className="rounded-3xl border border-slate-200 bg-white p-5 min-h-[26rem] shadow-sm ring-1 ring-slate-100/80">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Transaction information</div>
                <h2 className="text-2xl font-bold text-slate-900">Payment history</h2>
              </div>
            </div>

            <div className="overflow-x-auto rounded-3xl border border-slate-200/70">
              <table className="min-w-full text-sm divide-y divide-slate-200">
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
                    <tr key={txn.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
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

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100/80">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Booking payments</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">All pending bookings</div>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {bookings.length} bookings
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {bookings.map((item) => (
                <div key={item.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition hover:bg-slate-100">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-slate-900">{item.id}</div>
                      <div className="text-sm text-slate-600">{item.property} · {item.unit}</div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      item.status === "Confirmed"
                        ? "bg-emerald-100 text-emerald-700"
                        : item.status === "Pending"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-sky-100 text-sky-700"
                    }`}>
                      {item.status}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-slate-600">
                      <div>Amount: <span className="font-semibold text-slate-900">{item.amount}</span></div>
                      <div>Move-in: <span className="font-semibold text-slate-900">{item.moveIn}</span></div>
                    </div>
                    <button className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
                      Pay {item.id}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default Payment;
