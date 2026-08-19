import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const menus = {
  tenant: [
    ['Home', '/tenant/dashboard'],
    ['Search', '/dashboard/properties'],
    ['My Viewings', '/dashboard/viewings'],
    ['My Applications', '/dashboard/applications'],
    ['Messages', '/dashboard/messages'],
    ['Reviews', '/dashboard/reviews'],
    ['Profile', '/dashboard/profile'],
  ],
  owner: [
    ['My Properties', '/dashboard/my-listings'],
    ['Add Property', '/owner/add-property'],
    ['Viewing Requests', '/dashboard/viewings'],
    ['Applications', '/dashboard/owner-applications'],
    ['Verification', '/owner/verification'],
    ['Messages', '/dashboard/messages'],
    ['Profile', '/dashboard/profile'],
  ],
  admin: [
    ['Dashboard', '/admin/dashboard'],
    ['Users', '/admin/users'],
    ['Verifications', '/admin/verifications'],
    ['Fraud Reports', '/admin/fraud-reports'],
  ],
};

function RoleNavbar() {
  const { role, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <nav className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
      <strong className="mr-3 text-slate-900">ThikanaBD</strong>
      {(menus[role] || []).map(([label, path]) => <Link className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100" key={path} to={path}>{label}</Link>)}
      <button className="ml-auto rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
    </nav>
  );
}

export default RoleNavbar;
