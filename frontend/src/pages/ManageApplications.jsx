// src/pages/ManageApplications.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApplications } from '../hooks/useApplications';
import { useListings } from '../hooks/useListings';
import ApplicationStatusBadge from '../components/ApplicationStatusBadge';
import ApplicationComparisonModal from '../components/ApplicationComparisonModal';

function ManageApplications() {
  const { listingId } = useParams();
  const navigate = useNavigate();
  const { listings, fetchMyListings } = useListings();
  const {
    applications,
    loading,
    stats,
    fetchListingApplications,
    fetchStats,
    updateApplicationStatus,
    addReviewNotes
  } = useApplications();

  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [reviewNotes, setReviewNotes] = useState({});
  const [listing, setListing] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    
    // Find the listing
    if (listings.length > 0) {
      const found = listings.find(l => l._id === listingId);
      setListing(found);
    }
    
    loadData();
  }, [listingId, selectedStatus, listings]);

  const loadData = async () => {
    await fetchMyListings();
    await fetchListingApplications(listingId, selectedStatus);
    await fetchStats(listingId);
  };

  const handleStatusChange = async (applicationId, status, notes = '') => {
    setActionLoading(applicationId);
    try {
      await updateApplicationStatus(applicationId, status, notes);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveReviewNotes = async (applicationId) => {
    const notes = reviewNotes[applicationId] || '';
    try {
      await addReviewNotes(applicationId, notes);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to save review notes');
    }
  };

  const formatDate = (date) => {
    return date ? new Date(date).toLocaleDateString() : 'N/A';
  };

  const formatDateTime = (date) => {
    return date ? new Date(date).toLocaleString() : 'N/A';
  };

  const getIncomeLabel = (range) => {
    const labels = {
      'below_20000': 'Below ৳20,000',
      '20000_40000': '৳20,000 - ৳40,000',
      '40000_60000': '৳40,000 - ৳60,000',
      '60000_80000': '৳60,000 - ৳80,000',
      '80000_100000': '৳80,000 - ৳100,000',
      '100000_150000': '৳100,000 - ৳150,000',
      '150000_above': 'Above ৳150,000'
    };
    return labels[range] || range;
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

  const getLeaseDurationLabel = (duration) => {
    const labels = {
      '3_months': '3 Months',
      '6_months': '6 Months',
      '1_year': '1 Year',
      '2_years': '2 Years',
      'flexible': 'Flexible'
    };
    return labels[duration] || duration;
  };

  const getBudgetCompatibility = (application) => {
    const income = {
      'below_20000': 20000,
      '20000_40000': 40000,
      '40000_60000': 60000,
      '60000_80000': 80000,
      '80000_100000': 100000,
      '100000_150000': 150000,
      '150000_above': 150000
    }[application.income_range] || 0;

    const rent = application.listing_id?.monthly_rent_bdt || 0;
    
    if (!income || !rent) return { score: 0, label: 'N/A' };
    
    const ratio = rent / income;
    let score, label;
    
    if (ratio <= 0.3) { score = 100; label = 'Excellent'; }
    else if (ratio <= 0.4) { score = 80; label = 'Good'; }
    else if (ratio <= 0.5) { score = 60; label = 'Fair'; }
    else if (ratio <= 0.6) { score = 40; label = 'Stretched'; }
    else if (ratio <= 0.7) { score = 20; label = 'Tight'; }
    else { score = 10; label = 'Very Tight'; }
    
    return { score, label };
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-amber-50 border-amber-200',
      'under_review': 'bg-blue-50 border-blue-200',
      'approved': 'bg-emerald-50 border-emerald-200',
      'rejected': 'bg-red-50 border-red-200',
      'withdrawn': 'bg-gray-50 border-gray-200'
    };
    return colors[status] || 'bg-gray-50 border-gray-200';
  };

  if (loading && applications.length === 0) {
    return (
      <div className="p-6 md:p-8">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Loading applications...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-900 px-6 py-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-emerald-100">Owner Dashboard</div>
              <h1 className="text-3xl font-bold mt-2">Manage Applications</h1>
              <p className="mt-1 text-emerald-100/80">
                {listing ? `${listing.title} - ${listing.area}, ${listing.city}` : 'Loading...'}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => navigate('/dashboard/my-listings')}
                className="px-4 py-2 bg-white/20 rounded-xl hover:bg-white/30 transition"
              >
                Back to Listings
              </button>
              <button
                onClick={() => {
                  const activeApps = applications.filter(a => a.status !== 'rejected' && a.status !== 'withdrawn');
                  if (activeApps.length >= 2) {
                    setShowComparisonModal(true);
                  } else {
                    alert('Need at least 2 active applications to compare');
                  }
                }}
                className="px-4 py-2 bg-blue-600 rounded-xl hover:bg-blue-700 transition"
              >
                Compare Applications
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3 border-b border-slate-200 bg-slate-50">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">{stats.total || 0}</div>
              <div className="text-xs text-slate-500">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">{stats.pending || 0}</div>
              <div className="text-xs text-slate-500">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.underReview || 0}</div>
              <div className="text-xs text-slate-500">Under Review</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">{stats.approved || 0}</div>
              <div className="text-xs text-slate-500">Approved</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.rejected || 0}</div>
              <div className="text-xs text-slate-500">Rejected</div>
            </div>
          </div>
        )}

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
              onClick={loadData}
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
                onClick={loadData}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Retry
              </button>
            </div>
          ) : applications.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📄</div>
              <h3 className="text-xl font-semibold text-slate-900">No applications yet</h3>
              <p className="text-slate-500 mt-2">No tenants have applied for this property</p>
            </div>
          ) : (
            <div className="space-y-4">
              {applications.map((app) => {
                const budget = getBudgetCompatibility(app);
                return (
                  <div
                    key={app._id}
                    className={`rounded-xl border-2 p-4 ${getStatusColor(app.status)}`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      {/* Tenant Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-slate-900">
                            {app.tenant_id?.name || 'Unknown Tenant'}
                          </h4>
                          <ApplicationStatusBadge status={app.status} />
                          <span className="text-xs text-slate-500">
                            Submitted: {formatDateTime(app.submitted_at)}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-sm">
                          <div>
                            <span className="text-slate-500">Move-in:</span>
                            <span className="ml-1 font-medium">{formatDate(app.move_in_date)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Occupants:</span>
                            <span className="ml-1 font-medium">{app.number_of_occupants}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Type:</span>
                            <span className="ml-1 font-medium">{getTenantTypeLabel(app.tenant_type)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Income:</span>
                            <span className="ml-1 font-medium">{getIncomeLabel(app.income_range)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Occupation:</span>
                            <span className="ml-1 font-medium capitalize">{app.occupation?.replace('_', ' ')}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Lease:</span>
                            <span className="ml-1 font-medium">{getLeaseDurationLabel(app.preferred_lease_duration)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Budget:</span>
                            <span className={`ml-1 font-medium ${
                              budget.score >= 80 ? 'text-emerald-600' :
                              budget.score >= 60 ? 'text-amber-600' :
                              'text-red-600'
                            }`}>
                              {budget.label}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">Completion:</span>
                            <span className="ml-1 font-medium">{app.completion_percentage || 0}%</span>
                          </div>
                        </div>

                        {/* Employer Info */}
                        {(app.employer_institution || app.job_title) && (
                          <div className="mt-2 text-sm text-slate-600">
                            {app.employer_institution && <span>🏢 {app.employer_institution}</span>}
                            {app.job_title && <span className="ml-2">💼 {app.job_title}</span>}
                          </div>
                        )}

                        {/* Emergency Contact */}
                        <div className="mt-1 text-sm text-slate-600">
                          <span className="text-slate-500">Emergency:</span>
                          <span className="ml-1">{app.emergency_contact_name}</span>
                          <span className="ml-2">📞 {app.emergency_contact_phone}</span>
                          <span className="ml-2">({app.emergency_contact_relationship})</span>
                        </div>

                        {/* Additional Notes */}
                        {app.additional_notes && (
                          <div className="mt-2 text-sm text-slate-600 bg-white/50 p-2 rounded-lg">
                            📝 {app.additional_notes}
                          </div>
                        )}

                        {/* Review Notes */}
                        <div className="mt-3 flex items-center gap-2">
                          <input
                            type="text"
                            value={reviewNotes[app._id] || app.review_notes || ''}
                            onChange={(e) => setReviewNotes(prev => ({
                              ...prev,
                              [app._id]: e.target.value
                            }))}
                            placeholder="Add review notes..."
                            className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            onClick={() => handleSaveReviewNotes(app._id)}
                            className="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 transition"
                          >
                            Save
                          </button>
                        </div>
                        {app.review_notes && (
                          <div className="mt-1 text-xs text-slate-500">
                            Notes: {app.review_notes}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 min-w-[200px]">
                        {app.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(app._id, 'under_review')}
                              disabled={actionLoading === app._id}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition disabled:opacity-50"
                            >
                              Start Review
                            </button>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  const notes = prompt('Enter approval notes (optional):');
                                  handleStatusChange(app._id, 'approved', notes || '');
                                }}
                                disabled={actionLoading === app._id}
                                className="flex-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  const reason = prompt('Enter rejection reason:');
                                  if (reason !== null) {
                                    handleStatusChange(app._id, 'rejected', reason || 'No reason provided');
                                  }
                                }}
                                disabled={actionLoading === app._id}
                                className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          </>
                        )}
                        {app.status === 'under_review' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const notes = prompt('Enter approval notes (optional):');
                                handleStatusChange(app._id, 'approved', notes || '');
                              }}
                              disabled={actionLoading === app._id}
                              className="flex-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt('Enter rejection reason:');
                                if (reason !== null) {
                                  handleStatusChange(app._id, 'rejected', reason || 'No reason provided');
                                }
                              }}
                              disabled={actionLoading === app._id}
                              className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {app.status === 'approved' && (
                          <div className="text-sm text-emerald-600 font-medium text-center py-2 bg-emerald-50 rounded-lg">
                            ✅ Approved
                          </div>
                        )}
                        {app.status === 'rejected' && (
                          <div className="text-sm text-red-600 font-medium text-center py-2 bg-red-50 rounded-lg">
                            ❌ Rejected
                          </div>
                        )}
                        {app.status === 'withdrawn' && (
                          <div className="text-sm text-gray-600 font-medium text-center py-2 bg-gray-50 rounded-lg">
                            Withdrawn by Tenant
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Comparison Modal */}
      {showComparisonModal && listing && (
        <ApplicationComparisonModal
          isOpen={showComparisonModal}
          onClose={() => setShowComparisonModal(false)}
          listing={listing}
          applications={applications.filter(a => a.status !== 'rejected' && a.status !== 'withdrawn')}
          onCompare={() => {
            setShowComparisonModal(false);
            // Refresh data
            loadData();
          }}
        />
      )}
    </div>
  );
}

export default ManageApplications;