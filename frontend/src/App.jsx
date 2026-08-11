import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import MapSearch from "./pages/MapSearch";
import MyListings from "./pages/MyListings";
import Viewings from "./pages/Viewings"; // NEW
import RentCalculator from "./pages/RentCalculator";
import Payment from "./pages/Payment";
import PaymentResult from "./pages/PaymentResult";
import DashboardHome from "./pages/DashboardHome";
import Profile from "./pages/Profile";
import Agent from "./pages/Agent";
import Booking from "./pages/Booking";
import Message from "./pages/Message";

function PrivateRoute() {
  const token = localStorage.getItem("token");
  return token ? <Outlet /> : <Navigate to="/login" />;
}

function PublicRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? <Navigate to="/dashboard" /> : children;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/signup" />} />
        <Route path="/login" element={
          <PublicRoute>
            <Auth />
          </PublicRoute>
        } />
        <Route path="/signup" element={
          <PublicRoute>
            <Auth />
          </PublicRoute>
        } />
        <Route path="/payment-result" element={<PaymentResult />} />
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<Dashboard />}>
            <Route index element={<DashboardHome />} />
            <Route path="properties" element={<MapSearch />} />
            <Route path="my-listings" element={<MyListings />} />
            <Route path="viewings" element={<Viewings />} /> {/* NEW */}
            <Route path="rent-calculator" element={<RentCalculator />} />
            <Route path="bookings" element={<Booking />} />
            <Route path="messages" element={<Message />} />
            <Route path="payments" element={<Payment />} />
            <Route path="agent" element={<Agent />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default App;