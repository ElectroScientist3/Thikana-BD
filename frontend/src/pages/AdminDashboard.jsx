import { Link } from 'react-router-dom';
import RoleNavbar from '../components/RoleNavbar';

function AdminDashboard() {
  return (
    <><RoleNavbar /><section className="p-6 md:p-10 space-y-6">
      <div className="rounded-3xl bg-slate-900 p-8 text-white">
        <p className="text-sm uppercase tracking-[0.25em] text-slate-300">Admin console</p>
        <h1 className="mt-2 text-3xl font-bold">Platform oversight</h1>
        <p className="mt-3 max-w-2xl text-slate-300">Review users, owner verification, fraud reports, and duplicate listings.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Link className="rounded-2xl border bg-white p-5 shadow-sm hover:border-slate-900" to="/admin/users">Users</Link>
        <Link className="rounded-2xl border bg-white p-5 shadow-sm hover:border-slate-900" to="/admin/verifications">Verifications</Link>
        <Link className="rounded-2xl border bg-white p-5 shadow-sm hover:border-slate-900" to="/admin/fraud-reports">Fraud reports</Link>
        <Link className="rounded-2xl border bg-white p-5 shadow-sm hover:border-slate-900" to="/admin/duplicates">Duplicates</Link>
      </div>
    </section></>
  );
}

export default AdminDashboard;
