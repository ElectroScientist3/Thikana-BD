import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const plans = {
  basic: {
    name: "Basic",
    tokens: 20,
    price: "9.99 tk",
    priceValue: 9.99,
    highlight: "Starter access for light property discovery",
  },
  pro: {
    name: "Pro",
    tokens: 100,
    price: "49.99 tk",
    priceValue: 49.99,
    highlight: "Best for active landlords and renters",
  },
  premium: {
    name: "Premium",
    tokens: 200,
    price: "99.99 tk",
    priceValue: 99.99,
    highlight: "Maximum AI-assisted searches for serious users",
  },
};

const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";

function Payment() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedPlanKey = searchParams.get("plan") || "basic";
  const selectedPlan = plans[selectedPlanKey] || plans.basic;
  const bookingIdParam = searchParams.get("bookingId");

  const [payments, setPayments] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState("bg-slate-100 text-slate-700");
  const [autoBookingStarted, setAutoBookingStarted] = useState(false);

  const parseApiResponse = async (response) => {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await response.json();
    }
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return { html: text, raw: text };
    }
  };

  const handleAuthFailure = (message) => {
    localStorage.removeItem("token");
    setStatusMessage(message || "Authentication required. Please log in again.");
    setStatusTone("bg-amber-100 text-amber-700");
    navigate("/login");
  };

  const fetchPayments = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      handleAuthFailure("Please log in to view your payments.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${apiBase}/api/payments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401 || response.status === 403) {
        handleAuthFailure("Your session has expired. Please sign in again.");
        return;
      }
      const data = await response.json();
      if (response.ok) {
        setPayments(data.payments || []);
      } else {
        console.error("Failed to load payments:", data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch(`${apiBase}/api/bookings/tenant`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.status === 401 || response.status === 403) {
        handleAuthFailure("Your session has expired. Please sign in again.");
        return;
      }
      if (!response.ok) throw new Error(data.msg || "Failed to load bookings");
      setBookings(data.bookings || []);
    } catch (error) {
      console.error("Failed to load booking payments:", error);
      setBookings([]);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchBookings();
  }, [location.search]);

  useEffect(() => {
    const paymentStatus = searchParams.get("status");
    if (paymentStatus === "success") {
      setStatusMessage("Your SSLCommerz payment was completed successfully.");
      setStatusTone("bg-emerald-100 text-emerald-700");
    } else if (paymentStatus === "failed") {
      setStatusMessage("The payment was not completed. Please try again.");
      setStatusTone("bg-amber-100 text-amber-700");
    } else if (paymentStatus === "canceled") {
      setStatusMessage("The payment was canceled.");
      setStatusTone("bg-slate-100 text-slate-700");
    } else {
      setStatusMessage("");
      setStatusTone("bg-slate-100 text-slate-700");
    }
  }, [searchParams]);

  useEffect(() => {
    if (autoBookingStarted || !bookingIdParam) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    setAutoBookingStarted(true);
    fetch(`${apiBase}/api/bookings/${bookingIdParam}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.msg || "Could not load booking");
        return data.booking;
      })
      .then((booking) => handleBookingPayment(booking))
      .catch((error) => {
        setStatusMessage(error.message);
        setStatusTone("bg-amber-100 text-amber-700");
      });
  }, [bookingIdParam, autoBookingStarted]);

  const handleTokenPurchase = async (planKey) => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    const plan = plans[planKey] || plans.basic;
    try {
      const response = await fetch(`${apiBase}/api/payments/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: plan.priceValue, purpose: "tokens", plan: planKey, tokens: plan.tokens }),
      });
      const data = await parseApiResponse(response);
      if (response.status === 401 || response.status === 403) {
        handleAuthFailure("Your session has expired. Please sign in again to complete the purchase.");
        return;
      }
      if (!response.ok) {
        throw new Error(data.msg || "Could not start payment");
      }

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }

      console.error("Payment initiation response did not include redirectUrl:", data);
      setStatusMessage(data.message || "Unable to start payment: no redirect URL was returned.");
      setStatusTone("bg-amber-100 text-amber-700");
    } catch (error) {
      console.error(error);
      setStatusMessage(error.message || "Unable to start payment");
      setStatusTone("bg-amber-100 text-amber-700");
    }
  };

  const handleBookingPayment = async (booking) => {
    const token = localStorage.getItem("token");
    if (!token) {
      handleAuthFailure("Please log in to pay for a booking.");
      return;
    }

    try {
      const raw = String(booking.amount).replace(/[^0-9.]/g, "");
      const amount = Number(raw.replace(/,/g, ""));
      if (!amount || Number.isNaN(amount)) {
        setStatusMessage("Invalid booking amount. Please try again.");
        setStatusTone("bg-amber-100 text-amber-700");
        return;
      }

      const response = await fetch(`${apiBase}/api/payments/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount, purpose: "booking", bookingId: booking._id || booking.bookingToken || booking.id, name: booking.tenant?.name || booking.tenant }),
      });
      const data = await parseApiResponse(response);
      if (response.status === 401 || response.status === 403) {
        handleAuthFailure("Your session has expired. Please sign in again to complete the booking payment.");
        return;
      }
      if (!response.ok) {
        throw new Error(data.msg || "Could not start payment");
      }

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }

      console.error("Payment initiation response did not include redirectUrl:", data);
      setStatusMessage(data.message || "Unable to start payment: no redirect URL was returned.");
      setStatusTone("bg-amber-100 text-amber-700");
    } catch (error) {
      console.error(error);
      setStatusMessage(error.message || "Unable to start payment");
      setStatusTone("bg-amber-100 text-amber-700");
    }
  };

  const formatCurrency = (value) => `৳${Number(value || 0).toLocaleString()}`;
  const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : "—");

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
                <div className="text-slate-300">Transactions</div>
                <div className="mt-1 text-xl font-semibold">{payments.length}</div>
              </div>
              <div className="rounded-3xl bg-slate-950/90 px-4 py-3 text-sm text-slate-200 ring-1 ring-white/10">
                <div className="text-slate-300">Pending payments</div>
                <div className="mt-1 text-xl font-semibold">{payments.filter((payment) => payment.status === "Initiated").length}</div>
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

            {statusMessage ? (
              <div className={`mt-6 rounded-3xl px-5 py-4 text-sm font-medium ${statusTone}`}>
                {statusMessage}
              </div>
            ) : (
              <div className="mt-6 rounded-3xl bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-4 text-white shadow-md shadow-emerald-500/20">
                <div className="text-sm font-semibold">Secure payment ready</div>
                <div className="text-xs mt-1 text-slate-100">Pay securely through SSLCommerz sandbox and receive your gateway result instantly.</div>
              </div>
            )}

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

            <button
              onClick={() => handleTokenPurchase(selectedPlanKey)}
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Pay Now for {selectedPlan.name}
            </button>
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
                    <th className="px-3 py-3 font-semibold">Purpose</th>
                    <th className="px-3 py-3 font-semibold">Amount</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="px-3 py-6 text-center text-slate-500">Loading payments…</td>
                    </tr>
                  ) : payments.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-3 py-6 text-center text-slate-500">No payments have been created yet.</td>
                    </tr>
                  ) : (
                    payments.map((payment) => (
                      <tr key={payment._id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-3 font-semibold text-slate-900">{payment.tran_id || payment._id}</td>
                        <td className="px-3 py-3 capitalize">{payment.purpose || "other"}</td>
                        <td className="px-3 py-3">{formatCurrency(payment.amount)}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${payment.status === "Completed" ? "bg-emerald-100 text-emerald-700" : payment.status === "Failed" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>
                            {payment.status}
                          </span>
                        </td>
                        <td className="px-3 py-3">{formatDate(payment.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100/80 xl:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Booking payments</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">Pay for a specific booking</div>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {bookings.length} bookings
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {bookings.map((item) => (
                <div key={item._id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition hover:bg-slate-100">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-slate-900">{item.bookingToken}</div>
                      <div className="text-sm text-slate-600">{item.listing?.title || "Property"}</div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      item.status === "Paid"
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
                      <div>Amount: <span className="font-semibold text-slate-900">{formatCurrency(item.amount)}</span></div>
                      <div>Move-in: <span className="font-semibold text-slate-900">{formatDate(item.moveInDate)}</span></div>
                    </div>
                    {item.status === "Pending" && (
                      <button
                        onClick={() => handleBookingPayment(item)}
                        className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                      >
                        Pay booking
                      </button>
                    )}
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
