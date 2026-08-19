import { Link } from 'react-router-dom';
import RoleNavbar from '../components/RoleNavbar';

function TenantDashboard() {
  return (
    <><RoleNavbar /><section className="p-6 md:p-10 space-y-6">
      <div className="rounded-3xl bg-blue-900 p-8 text-white">
        <p className="text-sm uppercase tracking-[0.25em] text-blue-200">Tenant workspace</p>
        <h1 className="mt-2 text-3xl font-bold">Find your next home</h1>
        <p className="mt-3 max-w-2xl text-blue-100">Search verified properties, arrange viewings, and keep your applications together.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Link className="rounded-2xl border bg-white p-5 shadow-sm hover:border-blue-500" to="/dashboard/properties">Search properties</Link>
        <Link className="rounded-2xl border bg-white p-5 shadow-sm hover:border-blue-500" to="/dashboard/viewings">My viewings</Link>
        <Link className="rounded-2xl border bg-white p-5 shadow-sm hover:border-blue-500" to="/dashboard/applications">My applications</Link>
      </div>
    </section></>
  );
}

export default TenantDashboard;
