import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function RoleRoute({ allowedRoles, children }) {
  const { token, role } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(role)) return <Navigate to={`/${role || 'login'}/dashboard`} replace />;
  return children || <Outlet />;
}

export default RoleRoute;
