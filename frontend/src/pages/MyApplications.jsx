// src/pages/MyApplications.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApplications } from '../hooks/useApplications';
import ApplicationStatusBadge from '../components/ApplicationStatusBadge';

function MyApplications() {
  const navigate = useNavigate();
  const {
    applications,
    loading,
    error,
    pagination,
    fetchTenantApplications,
    withdrawApplication
  } = useApplications();

  const [selectedStatus, setSelectedStatus] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    loadApplications();
  }, [selectedStatus]);

  const loadApplications = async () => {
    await fetchTenantApplications(selectedStatus);
  };

  const handleWithdraw = async (applicationId) => {
    if (!confirm('Are you sure you want to withdraw this application?')) return;
    
    setActionLoading(applicationId);
    try {
      await withdrawApplication(applicationId);
      await loadApplications();
    } catch (err) {
      alert(err.message || 'Failed to withdraw application');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (date) => {
    return date ? new Date(date).toLocaleDateString() : 'N/A';
  };

  const formatDateTime = (date) => {
    return date ? new Date(date).toLocaleString() : 'N/A';
  };

  const getTenantTypeLabel = (type) => {
    const labels = {
      'family': 'Family',
      'couple': 'Couple',
      'single_professional': 'Single Professional',
      'student': 'Student',
      'group': 'Group'
    };
    return labels[type] || type;
  };

  const getStatusActions = (app) => {
    if (app.status === 'pending' || app.status === 'under_review') {
      return (
        <button
          onClick={() => handleWithdraw(app._id)}
          disabled={actionLoading === app._id}
          className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700 transition disabled:opacity-50"
        >
          {actionLoading === app._id ? 'Processing...' : 'Withdraw'}
        </button>
      );
    }
    return null;
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-900 px-6 py-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-blue-100">Tenant Dashboard</div>
              <h1 className="text-3xl font-bold mt-2">My Applications</h1>
              <p className="mt-1 text-blue-100/80">
                Track the status of your rental applications
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard/properties')}
              className="px-6 py-2 bg-blue-600 rounded-xl hover:bg-blue-700 transition"
            >
              Browse Properties
            </button>
          </div>
        </div>

        {/* Filter */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm font-medium text-slate-700">Filter by status:</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
            <button
              onClick={loadApplications}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Apply Filter
            </button>
          </div>
        </div>

        {/* Applications Table */}
        <div className="p-6 overflow-x-auto">
          {error ? (
            <div className="text-center py-12 text-red-600">
              <p className="text-xl font-semibold">Error loading applications</p>
              <p className="mt-2">{error}</p>
              <button
                onClick={loadApplications}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Retry
              </button>
            </div>
          ) : loading && applications.length === 0 ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-slate-600">Loading applications...</p>
            </div>
          ) : applications.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📄</div>
              <h3 className="text-xl font-semibold text-slate-900">No applications found</h3>
              <p className="text-slate-500 mt-2">You haven't submitted any rental applications yet</p>
              <button
                onClick={() => navigate('/dashboard/properties')}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
              >
                Browse Properties
              </button>
            </div>
          ) : (
            <>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-slate-600">
                    <th className="px-3 py-3 font-semibold">Property</th>
                    <th className="px-3 py-3 font-semibold">Move-in Date</th>
                    <th className="px-3 py-3 font-semibold">Tenant Type</th>
                    <th className="px-3 py-3 font-semibold">Occupants</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Completion</th>
                    <th className="px-3 py-3 font-semibold">Submitted</th>
                    <th className="px-3 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => (
                    <tr key={app._id} className="border-t border-slate-200 hover:bg-slate-50 transition">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-900">
                          {app.listing_id?.title || 'Unknown'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {app.listing_id?.area}, {app.listing_id?.city}
                        </div>
                        <div className="text-xs text-slate-500">
                          ৳{app.listing_id?.monthly_rent_bdt?.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-3 py-3">{formatDate(app.move_in_date)}</td>
                      <td className="px-3 py-3">{getTenantTypeLabel(app.tenant_type)}</td>
                      <td className="px-3 py-3">{app.number_of_occupants}</td>
                      <td className="px-3 py-3">
                        <ApplicationStatusBadge status={app.status} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${app.completion_percentage || 0}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">
                            {app.completion_percentage || 0}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm">{formatDateTime(app.submitted_at)}</td>
                      <td className="px-3 py-3">
                        {getStatusActions(app)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex justify-between items-center mt-4 text-sm text-slate-600">
                  <span>
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchTenantApplications(selectedStatus, pagination.page - 1)}
                      disabled={pagination.page <= 1}
                      className="px-3 py-1 border rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => fetchTenantApplications(selectedStatus, pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                      className="px-3 py-1 border rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default MyApplications;