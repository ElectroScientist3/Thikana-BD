// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import RoleRoute from "./components/RoleRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import MapSearch from "./pages/MapSearch";
import MyListings from "./pages/MyListings";
import Viewings from "./pages/Viewings";
import Recommendations from "./pages/Recommendations";
import RentCalculator from "./pages/RentCalculator";
import RentLedger from "./pages/RentLedger";
import Payment from "./pages/Payment";
import PaymentResult from "./pages/PaymentResult";
import DashboardHome from "./pages/DashboardHome";
import Profile from "./pages/Profile";
import Agent from "./pages/Agent";
import Booking from "./pages/Booking";
import Message from "./pages/Message";
import MyApplications from "./pages/MyApplications";
import ManageApplications from "./pages/ManageApplications";
import TenantDashboard from "./pages/TenantDashboard";
import OwnerDashboard from "./pages/OwnerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import NotificationHistory from "./pages/NotificationHistory";
import Messages from "./pages/Messages";
import ChatWindow from "./pages/ChatWindow";
import VerifyProperty from "./pages/VerifyProperty";
import VerificationReview from "./pages/admin/VerificationReview";
import DuplicateListings from "./pages/admin/DuplicateListings";
import FraudReports from "./pages/admin/FraudReports";

function PrivateRoute() {
  const { token } = useAuth();
  return token ? <Outlet /> : <Navigate to="/login" />;
}

function PublicRoute({ children }) {
  const { token, role } = useAuth();
  return token ? <Navigate to={`/${role || "dashboard"}/dashboard`} /> : children;
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
        <Route element={<RoleRoute allowedRoles={["tenant"]} />}>
          <Route path="/tenant/dashboard" element={<TenantDashboard />} />
        </Route>
        <Route element={<RoleRoute allowedRoles={["owner"]} />}>
          <Route path="/owner/dashboard" element={<OwnerDashboard />} />
          <Route path="/owner/add-property" element={<MapSearch />} />
          <Route path="/owner/verification" element={<Profile />} />
          <Route path="/verify-property" element={<VerifyProperty />} />
        </Route>
        <Route element={<RoleRoute allowedRoles={["admin"]} />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminDashboard />} />
          <Route path="/admin/verifications" element={<VerificationReview />} />
          <Route path="/admin/fraud-reports" element={<FraudReports />} />
          <Route path="/admin/duplicates" element={<DuplicateListings />} />
        </Route>
        <Route element={<PrivateRoute />}>
          <Route path="/notifications" element={<NotificationHistory />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:conversationId" element={<ChatWindow />} />
          <Route path="/dashboard" element={<Dashboard />}>
            <Route index element={<DashboardHome />} />
            <Route path="properties" element={<MapSearch />} />
            <Route path="my-listings" element={<RoleRoute allowedRoles={["owner"]}><MyListings /></RoleRoute>} />
            <Route path="viewings" element={<Viewings />} />
            <Route path="applications" element={<RoleRoute allowedRoles={["tenant"]}><MyApplications /></RoleRoute>} />
            <Route path="owner-applications" element={<RoleRoute allowedRoles={["owner"]}><ManageApplications /></RoleRoute>} />
            <Route path="reviews" element={<RoleRoute allowedRoles={["tenant"]}><Profile /></RoleRoute>} />
            <Route path="recommendations" element={<Recommendations />} />
            <Route path="rent-calculator" element={<RentCalculator />} />
            <Route path="rent-ledger" element={<RentLedger />} />
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