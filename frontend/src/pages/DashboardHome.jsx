import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const sampleRentDetails = [
  {
    id: 1,
    title: "Skyline Residency",
    location: "Dhaka, Bashundhara",
    unit: "A-102",
    rent: "৳32,000",
    status: "Paid",
    nextDue: "2026-08-15",
  },
  {
    id: 2,
    title: "Harbor Heights",
    location: "Chattogram, GEC",
    unit: "B-15",
    rent: "৳28,500",
    status: "Pending",
    nextDue: "2026-08-18",
  },
  {
    id: 3,
    title: "Lake View Homes",
    location: "Sylhet, Amberkhana",
    unit: "C-07",
    rent: "৳24,000",
    status: "Paid",
    nextDue: "2026-08-21",
  },
];

function DashboardHome() {
  const navigate = useNavigate();
  const [selectedProperty, setSelectedProperty] = useState(sampleRentDetails[0]);
  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || {};
    } catch {
      return {};
    }
  }, []);

  const userName = storedUser.name || "John Doe";
  const userEmail = storedUser.email || "john@example.com";

  const quickActions = [
    { title: "Add Property", subtitle: "Launch new listings" },
    { title: "My Listings", subtitle: "Manage your properties" },
    { title: "Viewings", subtitle: "Manage viewing requests" },
    { title: "Create Booking", subtitle: "Reserve a visitor slot" },
    { title: "Record Payment", subtitle: "Track incoming rent" },
    { title: "Buy Token", subtitle: "Unlock AI discovery" },
  ];

  // Action configuration with paths and colors
  const actionConfigs = [
    { 
      title: "Add Property", 
      icon: "🏠", 
      path: "/dashboard/properties",
      tint: "bg-green-50 text-green-700 border-green-200",
      hover: "hover:bg-green-100"
    },
    { 
      title: "My Listings", 
      icon: "📋", 
      path: "/dashboard/my-listings",
      tint: "bg-emerald-50 text-emerald-700 border-emerald-200",
      hover: "hover:bg-emerald-100"
    },
    { 
      title: "Viewings", 
      icon: "👁️", 
      path: "/dashboard/viewings",
      tint: "bg-blue-50 text-blue-700 border-blue-200",
      hover: "hover:bg-blue-100"
    },
    { 
      title: "Create Booking", 
      icon: "🗓️", 
      path: "/dashboard/bookings",
      tint: "bg-violet-50 text-violet-700 border-violet-200",
      hover: "hover:bg-violet-100"
    },
    { 
      title: "Record Payment", 
      icon: "💳", 
      path: "/dashboard/payments",
      tint: "bg-amber-50 text-amber-700 border-amber-200",
      hover: "hover:bg-amber-100"
    },
    { 
      title: "Buy Token", 
      icon: "🪙", 
      path: "/dashboard/payments?plan=basic",
      tint: "bg-rose-50 text-rose-700 border-rose-200",
      hover: "hover:bg-rose-100"
    },
  ];

  const handleActionClick = (action) => {
    if (action.title === "Buy Token") {
      navigate("/dashboard/payments?plan=basic");
    } else if (action.title === "Add Property") {
      navigate("/dashboard/properties");
    } else if (action.title === "My Listings") {
      navigate("/dashboard/my-listings");
    } else if (action.title === "Viewings") {
      navigate("/dashboard/viewings");
    } else if (action.title === "Create Booking") {
      navigate("/dashboard/bookings");
    } else if (action.title === "Record Payment") {
      navigate("/dashboard/payments");
    } else {
      navigate(action.path);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="bg-gradient-to-r from-blue-900 via-blue-700 to-sky-600 text-white rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-blue-100">ThikanaBD Workspace</p>
            <h1 className="text-3xl font-bold mt-2">Welcome back, {userName} 👋</h1>
            <p className="mt-2 text-blue-50 max-w-2xl">
              Manage your rental properties, track bookings, and keep payment workflows organised from one reliable dashboard.
            </p>
          </div>
          <div className="bg-white/15 backdrop-blur rounded-2xl p-4 min-w-[260px] border border-white/20">
            <div className="text-xs uppercase tracking-[0.25em] text-blue-100">Account Snapshot</div>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4"><span>Name</span><span className="font-semibold">{userName}</span></div>
              <div className="flex justify-between gap-4"><span>Email</span><span className="font-semibold">{userEmail}</span></div>
              <div className="flex justify-between gap-4"><span>Role</span><span className="font-semibold">Property Manager</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Properties", value: "18", tone: "from-blue-500 to-blue-700" },
          { label: "Bookings This Month", value: "12", tone: "from-emerald-500 to-green-700" },
          { label: "Pending Payments", value: "04", tone: "from-amber-500 to-orange-600" },
          { label: "Occupied Units", value: "91%", tone: "from-violet-500 to-purple-700" },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <div className={`w-10 h-2 rounded-full bg-gradient-to-r ${item.tone}`}></div>
            <div className="mt-4 text-3xl font-bold text-slate-900">{item.value}</div>
            <div className="text-sm text-slate-500">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.9fr] gap-6">
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Rent Details</h2>
              <p className="text-sm text-slate-500">Interactive property and ledger overview</p>
            </div>
            <button 
              onClick={() => navigate("/dashboard/rent-ledger")}
              className="rounded-full bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800 transition"
            >
              View Ledger
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            {sampleRentDetails.map((property) => (
              <button
                key={property.id}
                onClick={() => setSelectedProperty(property)}
                className={`rounded-2xl border text-left p-4 transition ${
                  selectedProperty.id === property.id
                    ? "border-blue-600 bg-blue-50 shadow-sm"
                    : "border-slate-200 bg-slate-50 hover:border-slate-300"
                }`}
              >
                <div className="font-semibold text-slate-900">{property.title}</div>
                <div className="mt-1 text-xs text-slate-500">{property.location}</div>
                <div className="mt-3 text-sm"><span className="font-semibold">Unit:</span> {property.unit}</div>
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Selected Property</div>
                <div className="text-xl font-bold text-slate-900">{selectedProperty.title}</div>
                <div className="text-sm text-slate-500">{selectedProperty.location}</div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Monthly Rent</div>
                <div className="text-2xl font-bold text-slate-900">{selectedProperty.rent}</div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="bg-white rounded-xl p-3 border border-slate-200">
                <div className="text-slate-500">Rental Unit</div>
                <div className="font-semibold text-slate-900">{selectedProperty.unit}</div>
              </div>
              <div className="bg-white rounded-xl p-3 border border-slate-200">
                <div className="text-slate-500">Payment Status</div>
                <div className={`font-semibold ${selectedProperty.status === "Paid" ? "text-emerald-600" : "text-amber-600"}`}>
                  {selectedProperty.status}
                </div>
              </div>
              <div className="bg-white rounded-xl p-3 border border-slate-200">
                <div className="text-slate-500">Next Due</div>
                <div className="font-semibold text-slate-900">{selectedProperty.nextDue}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="mb-5">
            <h2 className="text-2xl font-bold text-slate-900">Quick Actions</h2>
            <p className="text-sm text-slate-500 mt-1">Common rental operations for your team</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {actionConfigs.map((action) => (
              <button
                key={action.title}
                onClick={() => handleActionClick(action)}
                className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${action.tint} ${action.hover}`}
              >
                <div className="w-12 h-12 rounded-xl bg-white/80 flex items-center justify-center text-2xl shadow-sm mb-3">
                  {action.icon}
                </div>
                <div className="font-semibold text-base">{action.title}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {quickActions.find((item) => item.title === action.title)?.subtitle}
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Rental Activity</h2>
            <p className="text-sm text-slate-500">Recent status highlights for your portfolio</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: "New Booking", details: "2 new bookings requested this week", color: "bg-emerald-500" },
            { title: "Late Payment", details: "1 unit still pending confirmation", color: "bg-amber-500" },
            { title: "Maintenance", details: "3 service requests need review", color: "bg-sky-500" },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className={`w-10 h-2 rounded-full ${item.color}`}></div>
              <div className="mt-4 font-semibold text-slate-900">{item.title}</div>
              <div className="text-sm text-slate-500 mt-1">{item.details}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default DashboardHome;