import { Link } from 'react-router-dom';
import RoleNavbar from '../components/RoleNavbar';

function OwnerDashboard() {
  return (
    <><RoleNavbar /><section className="p-6 md:p-10 space-y-6">
      <div className="rounded-3xl bg-emerald-900 p-8 text-white">
        <p className="text-sm uppercase tracking-[0.25em] text-emerald-200">Owner workspace</p>
        <h1 className="mt-2 text-3xl font-bold">Manage your properties</h1>
        <p className="mt-3 max-w-2xl text-emerald-100">Keep listings available, respond to viewing requests, and review applicants.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Link className="rounded-2xl border bg-white p-5 shadow-sm hover:border-emerald-500" to="/owner/add-property">Add property</Link>
        <Link className="rounded-2xl border bg-white p-5 shadow-sm hover:border-emerald-500" to="/dashboard/viewings">Viewing requests</Link>
        <Link className="rounded-2xl border bg-white p-5 shadow-sm hover:border-emerald-500" to="/dashboard/owner-applications">Applications</Link>
      </div>
    </section></>
  );
}

export default OwnerDashboard;
