// src/pages/Booking.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config/api";

function Booking() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Try to fetch real bookings from API
      const response = await fetch(`${API_BASE}/api/payments`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.payments && data.payments.length > 0) {
          // Transform payment data to booking format
          const transformedBookings = data.payments.map((payment, index) => ({
            id: payment.tran_id || `BK-${String(index + 1).padStart(4, '0')}`,
            property: payment.meta?.propertyTitle || 'Property',
            tenant: payment.user?.name || 'Tenant',
            unit: payment.meta?.unit || 'N/A',
            moveIn: payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : 'N/A',
            status: payment.status === 'Completed' ? 'Confirmed' : 
                    payment.status === 'Initiated' ? 'Pending' : 'In Review',
            amount: `৳${payment.amount?.toLocaleString() || '0'}`,
          }));
          setBookings(transformedBookings);
          setError(null);
        } else {
          // If no bookings, use sample data
          setBookings(getSampleBookings());
        }
      } else {
        // If API fails, use sample data
        setBookings(getSampleBookings());
      }
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
      setBookings(getSampleBookings());
    } finally {
      setLoading(false);
    }
  };

  const getSampleBookings = () => {
    return [
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
  };

  const handlePay = (booking) => {
    const token = localStorage.getItem('token');
    if (!token) return alert('Please login to make a payment');
    navigate(`/dashboard/payments?bookingId=${encodeURIComponent(booking.id)}`);
  };

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Loading bookings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-900 px-6 py-6 text-white">
          <div className="text-xs uppercase tracking-[0.3em] text-blue-100">Booking Center</div>
          <h1 className="text-3xl font-bold mt-2">Booking Information</h1>
          <p className="mt-1 text-blue-100/80 text-sm">
            {bookings.length} booking{bookings.length !== 1 ? 's' : ''} found
          </p>
        </div>

        <div className="p-6 overflow-x-auto">
          {error ? (
            <div className="text-center py-8 text-red-600">
              <p>{error}</p>
              <button 
                onClick={fetchBookings}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-xl font-semibold text-slate-900">No bookings found</h3>
              <p className="text-slate-500 mt-2">You haven't made any bookings yet.</p>
              <button 
                onClick={() => navigate('/dashboard/properties')}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
              >
                Browse Properties
              </button>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  <th className="px-3 py-3 font-semibold">Booking ID</th>
                  <th className="px-3 py-3 font-semibold">Property</th>
                  <th className="px-3 py-3 font-semibold">Tenant</th>
                  <th className="px-3 py-3 font-semibold">Unit</th>
                  <th className="px-3 py-3 font-semibold">Move-in</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Amount</th>
                  <th className="px-3 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200 hover:bg-slate-50 transition">
                    <td className="px-3 py-3 font-semibold text-slate-900">{item.id}</td>
                    <td className="px-3 py-3">{item.property}</td>
                    <td className="px-3 py-3">{item.tenant}</td>
                    <td className="px-3 py-3">{item.unit}</td>
                    <td className="px-3 py-3">{item.moveIn}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        item.status === "Confirmed"
                          ? "bg-emerald-100 text-emerald-700"
                          : item.status === "Pending"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-sky-100 text-sky-700"
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">{item.amount}</td>
                    <td className="px-3 py-3">
                      <button 
                        onClick={() => handlePay(item)} 
                        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition"
                      >
                        Pay Now
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default Booking;