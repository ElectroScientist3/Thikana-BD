import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE } from "../config/api";

function PaymentResult() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const status = searchParams.get("status") || "failed";
  const tranId = searchParams.get("tran_id") || "—";

  useEffect(() => {
    if (status !== "success" || tranId === "—") return;
    fetch(`${API_BASE}/api/payments/reconcile/${encodeURIComponent(tranId)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }).catch(() => {});
  }, [status, tranId]);

  const details = useMemo(() => {
    switch (status) {
      case "success":
        return {
          title: "Payment completed",
          description: "Your SSLCommerz payment was accepted and the record has been saved.",
          tone: "from-emerald-500 to-green-600",
          badge: "Success",
        };
      case "canceled":
        return {
          title: "Payment canceled",
          description: "The payment was canceled before it could be completed.",
          tone: "from-slate-500 to-slate-600",
          badge: "Canceled",
        };
      default:
        return {
          title: "Payment failed",
          description: "The payment could not be completed. Please try again or choose another method.",
          tone: "from-amber-500 to-orange-600",
          badge: "Failed",
        };
    }
  }, [status]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className={`rounded-t-3xl bg-gradient-to-r ${details.tone} px-6 py-8 text-white`}>
          <div className="text-xs uppercase tracking-[0.3em] opacity-80">SSLCommerz</div>
          <h1 className="mt-2 text-3xl font-bold">{details.title}</h1>
          <p className="mt-2 text-sm text-slate-100">{details.description}</p>
        </div>

        <div className="space-y-4 p-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Status</span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                {details.badge}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="font-semibold">Transaction ID</span>
              <span className="font-mono text-xs text-slate-600">{tranId}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/dashboard/bookings")}
              className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              View bookings
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
            >
              Go to dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentResult;
