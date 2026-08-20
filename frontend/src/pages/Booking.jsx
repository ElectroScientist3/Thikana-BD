import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config/api";

function Booking() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}").isOwner ? "owner" : "tenant";
    } catch {
      return "tenant";
    }
  });
  const [bookings, setBookings] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchBookings = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/bookings/${viewMode}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.msg || "Failed to load bookings");
      setBookings(data.bookings || []);
      setAgreements(data.agreements || []);
      setError("");
    } catch (err) {
      setError(err.message);
      setBookings([]);
      setAgreements([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [viewMode]);

  const formatCurrency = (value) => `৳${Number(value || 0).toLocaleString()}`;
  const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : "-");
  const getAgreement = (bookingId) => agreements.find((agreement) => String(agreement.booking) === String(bookingId));

  const downloadAgreement = async (booking, agreement) => {
    const token = localStorage.getItem("token");
    if (!token || !agreement) return;

    try {
      const response = await fetch(`${API_BASE}/api/bookings/${booking._id}/agreement/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.msg || "Unable to download agreement");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rental-agreement-${agreement.agreementNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-900 px-6 py-6 text-white">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-blue-100">Booking Center</div>
              <h1 className="mt-2 text-3xl font-bold">Booking Information</h1>
              <p className="mt-1 text-sm text-blue-100/80">Confirmed properties, payment status, and agreements</p>
            </div>
            <div className="inline-flex rounded-2xl bg-white/10 p-1">
              {["tenant", "owner"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize ${viewMode === mode ? "bg-white text-slate-900" : "text-white/80"}`}
                >
                  {mode} mode
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6">
          {loading ? <p className="py-10 text-center text-slate-500">Loading bookings...</p> : error ? (
            <div className="py-10 text-center text-red-600">
              <p>{error}</p>
              <button onClick={fetchBookings} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-white">Retry</button>
            </div>
          ) : bookings.length === 0 ? (
            <div className="py-10 text-center text-slate-500">No {viewMode} bookings found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-3 py-3">Property</th>
                    <th className="px-3 py-3">{viewMode === "tenant" ? "Owner" : "Tenant"}</th>
                    <th className="px-3 py-3">Booking token</th>
                    <th className="px-3 py-3">Amount</th>
                    <th className="px-3 py-3">Payment</th>
                    <th className="px-3 py-3">Agreement</th>
                    <th className="px-3 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => {
                    const agreement = getAgreement(booking._id);
                    const property = booking.listing || {};
                    const person = viewMode === "tenant" ? booking.owner : booking.tenant;
                    return (
                      <tr key={booking._id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                        <td className="px-3 py-4">
                          <div className="font-semibold text-slate-900">{property.title || "Property"}</div>
                          <div className="text-xs text-slate-500">{property.area || property.city || "-"}</div>
                          <div className="text-xs text-emerald-700">Move-in {formatDate(booking.moveInDate)}</div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="font-medium text-slate-900">{person?.name || "-"}</div>
                          <div className="text-xs text-slate-500">{person?.email || "-"}</div>
                        </td>
                        <td className="px-3 py-4 font-mono text-xs text-slate-700">{booking.bookingToken}</td>
                        <td className="px-3 py-4 font-semibold text-slate-900">{formatCurrency(booking.amount)}</td>
                        <td className="px-3 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${booking.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {booking.status}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-xs text-slate-600">{agreement?.agreementNumber || "Not generated"}</td>
                        <td className="px-3 py-4">
                          {viewMode === "tenant" && booking.status === "Pending" ? (
                            <button onClick={() => navigate(`/dashboard/payments?bookingId=${encodeURIComponent(booking._id)}`)} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">Pay Now</button>
                          ) : booking.status === "Paid" && agreement ? (
                            <button onClick={() => downloadAgreement(booking, agreement)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">Download PDF</button>
                          ) : <span className="text-xs text-slate-400">Available after payment</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Booking;
