import { useEffect, useState, useRef } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";

function Dashboard() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef();
  const notificationRef = useRef();

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }

      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const isDashboard = location.pathname === "/dashboard";
  const isProperties = location.pathname.endsWith("/properties");
  const isMyListings = location.pathname.endsWith("/my-listings");
  const isViewings = location.pathname.endsWith("/viewings");
  const isBookings = location.pathname.endsWith("/bookings");
  const isMessages = location.pathname.endsWith("/messages");
  const isPayments = location.pathname.endsWith("/payments");
  const isRentLedger = location.pathname.endsWith("/rent-ledger");
  const isAgent = location.pathname.endsWith("/agent");
  const isProfile = location.pathname.endsWith("/profile");

  return (
    <div className="flex h-screen bg-slate-100 text-slate-900">
      <aside
        className={`bg-slate-950 text-white flex flex-col py-6 transition-all duration-300 ${
          sidebarOpen ? "w-72" : "w-24"
        }`}
        onMouseEnter={() => setSidebarOpen(true)}
        onMouseLeave={() => setSidebarOpen(false)}
        style={{ minWidth: sidebarOpen ? "18rem" : "6rem" }}
      >
        <div className="px-4 pb-6 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img
              src="/thikana-brand.svg"
              alt="ThikanaBD logo"
              className="w-14 h-14 object-contain rounded-xl bg-white/95 p-1 shadow-lg"
            />
            {sidebarOpen && (
              <div>
                <div className="text-lg font-extrabold tracking-wide text-white">ThikanaBD</div>
                <div className="text-xs text-slate-400">Rental Hub</div>
              </div>
            )}
          </div>
        </div>

        {/* Dashboard */}
        <button
          className={`flex items-center gap-3 px-4 py-3 text-left text-base font-semibold hover:bg-slate-800 rounded-r-full mb-2 transition-colors ${
            isDashboard ? "bg-blue-600 text-white" : "text-slate-200"
          }`}
          onClick={() => navigate("/dashboard")}
        >
          <span className="text-xl">🏠</span>
          {sidebarOpen && "Dashboard"}
        </button>

        {/* Browse Properties */}
        <button
          className={`flex items-center gap-3 px-4 py-3 text-left text-base font-semibold hover:bg-slate-800 rounded-r-full mb-2 transition-colors ${
            isProperties ? "bg-amber-500 text-slate-950" : "text-slate-200"
          }`}
          onClick={() => navigate("/dashboard/properties")}
        >
          <span className="text-xl">🏘️</span>
          {sidebarOpen && "Browse Properties"}
        </button>

        {/* My Listings */}
        <button
          className={`flex items-center gap-3 px-4 py-3 text-left text-base font-semibold hover:bg-slate-800 rounded-r-full mb-2 transition-colors ${
            isMyListings ? "bg-emerald-500 text-slate-950" : "text-slate-200"
          }`}
          onClick={() => navigate("/dashboard/my-listings")}
        >
          <span className="text-xl">📋</span>
          {sidebarOpen && "My Listings"}
        </button>

        {/* Viewings - NEW */}
        <button
          className={`flex items-center gap-3 px-4 py-3 text-left text-base font-semibold hover:bg-slate-800 rounded-r-full mb-2 transition-colors ${
            isViewings ? "bg-blue-500 text-white" : "text-slate-200"
          }`}
          onClick={() => navigate("/dashboard/viewings")}
        >
          <span className="text-xl">👁️</span>
          {sidebarOpen && "Viewings"}
        </button>

        {/* Rent Calculator */}
        <button
          className={`flex items-center gap-3 px-4 py-3 text-left text-base font-semibold hover:bg-slate-800 rounded-r-full mb-2 transition-colors ${
            location.pathname.endsWith("/rent-calculator") ? "bg-amber-500 text-slate-950" : "text-slate-200"
          }`}
          onClick={() => navigate("/dashboard/rent-calculator")}
        >
          <span className="text-xl">🧮</span>
          {sidebarOpen && "Rent Calculator"}
        </button>

        {/* Bookings */}
        <button
          className={`flex items-center gap-3 px-4 py-3 text-left text-base font-semibold hover:bg-slate-800 rounded-r-full mb-2 transition-colors ${
            isBookings ? "bg-indigo-500 text-white" : "text-slate-200"
          }`}
          onClick={() => navigate("/dashboard/bookings")}
        >
          <span className="text-xl">📋</span>
          {sidebarOpen && "Bookings"}
        </button>

        {/* Rent Ledger */}
        <button
          className={`flex items-center gap-3 px-4 py-3 text-left text-base font-semibold hover:bg-slate-800 rounded-r-full mb-2 transition-colors ${
            isRentLedger ? "bg-amber-500 text-slate-950" : "text-slate-200"
          }`}
          onClick={() => navigate("/dashboard/rent-ledger")}
        >
          <span className="text-xl">📊</span>
          {sidebarOpen && "Rent Ledger"}
        </button>

        {/* Messages */}
        <button
          className={`flex items-center gap-3 px-4 py-3 text-left text-base font-semibold hover:bg-slate-800 rounded-r-full mb-2 transition-colors ${
            isMessages ? "bg-pink-500 text-white" : "text-slate-200"
          }`}
          onClick={() => navigate("/dashboard/messages")}
        >
          <span className="text-xl">💬</span>
          {sidebarOpen && "Messages"}
        </button>

        {/* Payments */}
        <button
          className={`flex items-center gap-3 px-4 py-3 text-left text-base font-semibold hover:bg-slate-800 rounded-r-full mb-2 transition-colors ${
            isPayments ? "bg-emerald-500 text-slate-950" : "text-slate-200"
          }`}
          onClick={() => navigate("/dashboard/payments")}
        >
          <span className="text-xl">💳</span>
          {sidebarOpen && "Payments"}
        </button>

        {/* AI Agent */}
        <button
          className={`flex items-center gap-3 px-4 py-3 text-left text-base font-semibold hover:bg-slate-800 rounded-r-full mb-2 transition-colors ${
            isAgent ? "bg-cyan-500 text-slate-950" : "text-slate-200"
          }`}
          onClick={() => navigate("/dashboard/agent")}
        >
          <span className="text-xl">🤖</span>
          {sidebarOpen && "AI Agent"}
        </button>

        {/* Profile */}
        <button
          className={`flex items-center gap-3 px-4 py-3 text-left text-base font-semibold hover:bg-slate-800 rounded-r-full transition-colors ${
            isProfile ? "bg-violet-500 text-white" : "text-slate-200"
          }`}
          onClick={() => navigate("/dashboard/profile")}
        >
          <span className="text-xl">👤</span>
          {sidebarOpen && "Profile"}
        </button>

        <div className="mt-auto px-4 pt-6 text-xs text-slate-400">
          {sidebarOpen ? (
            <div className="space-y-2">
              <div>© 2026 ThikanaBD</div>
              <div>All rights reserved.</div>
            </div>
          ) : (
            <div className="text-center">©</div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex justify-between items-center px-6 py-4 bg-white shadow-sm border-b border-slate-200">
          <div>
            <div className="text-xs uppercase tracking-[0.32em] text-slate-500">Property Booking Platform</div>
            <div className="text-lg font-semibold text-slate-900">Welcome to your rental workspace</div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setNotificationsOpen((open) => !open)}
                className="w-11 h-11 rounded-full bg-slate-100 text-slate-700 text-xl shadow-sm hover:bg-slate-200 transition-colors relative"
                title="Notifications"
              >
                🔔
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                  3
                </span>
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl z-10 border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-semibold text-slate-900">Notifications</div>
                  <div className="p-3 space-y-2">
                    <div className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-slate-700">
                      <div className="font-semibold text-blue-900">Property request</div>
                      <div className="text-xs text-slate-500">A new renter requested a viewing for Skyline Residency.</div>
                    </div>
                    <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-slate-700">
                      <div className="font-semibold text-amber-900">Payment pending</div>
                      <div className="text-xs text-slate-500">One rent ledger item is still awaiting confirmation.</div>
                    </div>
                    <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-slate-700">
                      <div className="font-semibold text-emerald-900">Message received</div>
                      <div className="text-xs text-slate-500">The property owner replied with the latest viewing time.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((open) => !open)}
                className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white text-xl shadow hover:scale-105 transition-transform"
                title="Account"
              >
                👤
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl z-10 border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => navigate("/dashboard/profile")}
                    className="block w-full text-left px-4 py-3 text-slate-700 hover:bg-slate-100"
                  >
                    Profile
                  </button>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-3 text-red-600 hover:bg-red-50"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-slate-100">
          <Outlet />
        </main>

        <footer className="bg-slate-950 text-slate-300 px-6 py-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="font-semibold text-white">ThikanaBD</div>
              <div className="text-sm">© 2026 ThikanaBD. All rights reserved.</div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <a href="https://facebook.com" target="_blank" rel="noreferrer" className="hover:text-white">Find us on Facebook</a>
              <a href="#" className="hover:text-white">About Us</a>
              <a href="#" className="hover:text-white">Our Team</a>
              <a href="#" className="hover:text-white">Support</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default Dashboard;