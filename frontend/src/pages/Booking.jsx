import { useNavigate } from "react-router-dom";

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

function Booking() {
  const navigate = useNavigate();

  const handlePay = (booking) => {
    const token = localStorage.getItem('token');
    if (!token) return alert('Please login to make a payment');
    navigate(`/dashboard/payments?bookingId=${encodeURIComponent(booking.id)}`);
  };

  return (
    <div className="p-6 md:p-8">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-900 px-6 py-6 text-white">
          <div className="text-xs uppercase tracking-[0.3em] text-blue-100">Booking Center</div>
          <h1 className="text-3xl font-bold mt-2">Booking Information</h1>
        </div>

        <div className="p-6 overflow-x-auto">
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
                <tr key={item.id} className="border-t border-slate-200">
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
                    <button onClick={() => handlePay(item)} className="bg-blue-600 text-white px-3 py-1 rounded">
                      Pay Now
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Booking;
