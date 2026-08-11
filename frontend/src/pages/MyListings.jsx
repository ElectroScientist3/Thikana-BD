import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import StatusBadge from '../components/StatusBadge';
import StatusChangeModal from '../components/StatusChangeModal';
import StatusHistoryModal from '../components/StatusHistoryModal';
import { useListings } from '../hooks/useListings';
import { STATUS_OPTIONS } from '../utils/statusUtils';

function MyListings() {
  const { listings, loading, error, stats, updateStatus, bulkUpdateStatus, fetchMyListings, fetchStats } = useListings();
  const [selectedListing, setSelectedListing] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [statusNotes, setStatusNotes] = useState('');
  const navigate = useNavigate();

  // Handle status change
  const handleStatusChange = async (listingId, newStatus, notes) => {
    try {
      await updateStatus(listingId, newStatus, notes);
      setShowStatusModal(false);
      setSelectedListing(null);
      setStatusNotes('');
    } catch (err) {
      alert(err.message || 'Failed to update status');
    }
  };

  // Handle bulk status update
  const handleBulkUpdate = async (status) => {
    if (selectedIds.length === 0) return;
    
    const confirmUpdate = window.confirm(
      `Are you sure you want to update ${selectedIds.length} listings to "${STATUS_OPTIONS.find(s => s.value === status)?.label}"?`
    );
    
    if (!confirmUpdate) return;

    try {
      await bulkUpdateStatus(selectedIds, status, statusNotes || 'Bulk status update');
      setSelectedIds([]);
      setBulkMode(false);
      setStatusNotes('');
    } catch (err) {
      alert(err.message || 'Failed to update statuses');
    }
  };

  // Toggle selection for bulk mode
  const toggleSelection = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Select/deselect all
  const toggleSelectAll = () => {
    if (selectedIds.length === listings.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(listings.map(l => l._id));
    }
  };

  // Format date
  const formatDate = (date) => {
    return date ? new Date(date).toLocaleDateString() : 'N/A';
  };

  // Format currency
  const formatCurrency = (amount) => {
    return amount ? `৳${amount.toLocaleString()}` : 'N/A';
  };

  // Refresh data
  const refreshData = async () => {
    await fetchMyListings();
    await fetchStats();
  };

  // Load data on mount
  useEffect(() => {
    refreshData();
  }, []);

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Loading your listings...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 md:p-8">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-8">
          <div className="text-center text-red-600">
            <p className="text-xl font-semibold">Error loading listings</p>
            <p className="mt-2">{error}</p>
            <button
              onClick={refreshData}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <div className="text-sm text-slate-500">Total Listings</div>
            <div className="text-2xl font-bold text-slate-900">{stats.total || 0}</div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <div className="text-sm text-slate-500">Available Now</div>
            <div className="text-2xl font-bold text-emerald-600">{stats.byStatus?.available_now || 0}</div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <div className="text-sm text-slate-500">On Hold</div>
            <div className="text-2xl font-bold text-amber-600">{stats.byStatus?.on_hold || 0}</div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <div className="text-sm text-slate-500">Reserved</div>
            <div className="text-2xl font-bold text-purple-600">{stats.byStatus?.reserved || 0}</div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <div className="text-sm text-slate-500">Rented</div>
            <div className="text-2xl font-bold text-red-600">{stats.byStatus?.rented || 0}</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-900 px-6 py-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-emerald-100">Property Management</div>
              <h1 className="text-3xl font-bold mt-2">My Listings</h1>
              <p className="mt-1 text-emerald-100/80">Manage your rental units and their availability status</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => navigate('/dashboard/properties')}
                className="px-4 py-2 bg-white/20 rounded-xl text-white hover:bg-white/30 transition"
              >
                Browse Properties
              </button>
              {listings.length > 0 && (
                <button
                  onClick={() => {
                    setBulkMode(!bulkMode);
                    if (bulkMode) setSelectedIds([]);
                  }}
                  className="px-4 py-2 bg-emerald-600 rounded-xl hover:bg-emerald-700 transition"
                >
                  {bulkMode ? 'Exit Bulk Mode' : 'Bulk Actions'}
                </button>
              )}
              <button
                onClick={refreshData}
                className="px-4 py-2 bg-blue-600 rounded-xl hover:bg-blue-700 transition"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-x-auto">
          {listings.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🏠</div>
              <h3 className="text-xl font-semibold text-slate-900">No listings yet</h3>
              <p className="text-slate-500 mt-2">Create your first property listing to get started</p>
              <button
                onClick={() => navigate('/dashboard/properties')}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
              >
                Create Listing
              </button>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  {bulkMode && (
                    <th className="px-3 py-3 font-semibold">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === listings.length && listings.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="px-3 py-3 font-semibold">Title</th>
                  <th className="px-3 py-3 font-semibold">Location</th>
                  <th className="px-3 py-3 font-semibold">Rent</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Available From</th>
                  <th className="px-3 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((listing) => (
                  <tr key={listing._id} className="border-t border-slate-200 hover:bg-slate-50 transition">
                    {bulkMode && (
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(listing._id)}
                          onChange={() => toggleSelection(listing._id)}
                          className="rounded cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-3 py-3 font-semibold text-slate-900">{listing.title}</td>
                    <td className="px-3 py-3">
                      {listing.area}, {listing.city}
                    </td>
                    <td className="px-3 py-3 font-semibold">{formatCurrency(listing.monthly_rent_bdt)}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={listing.status} />
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {listing.status === 'available_from_date' 
                        ? formatDate(listing.available_from)
                        : listing.status === 'available_now'
                        ? 'Immediate'
                        : 'N/A'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => {
                            setSelectedListing(listing);
                            setShowStatusModal(true);
                          }}
                          className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 transition"
                        >
                          Change Status
                        </button>
                        <button
                          onClick={() => {
                            setSelectedListing(listing);
                            setShowHistoryModal(true);
                          }}
                          className="px-3 py-1 bg-gray-600 text-white rounded-lg text-xs hover:bg-gray-700 transition"
                        >
                          History
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Bulk Actions */}
          {bulkMode && selectedIds.length > 0 && (
            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold text-slate-700">
                  {selectedIds.length} listing{selectedIds.length > 1 ? 's' : ''} selected:
                </span>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkUpdate(e.target.value);
                    }
                  }}
                  className="px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  defaultValue=""
                >
                  <option value="">Bulk Update Status</option>
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.icon} {opt.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Add notes..."
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  className="flex-1 min-w-[200px] px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => {
                    setSelectedIds([]);
                    setStatusNotes('');
                  }}
                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Change Modal */}
      <StatusChangeModal
        isOpen={showStatusModal}
        onClose={() => {
          setShowStatusModal(false);
          setSelectedListing(null);
          setStatusNotes('');
        }}
        listing={selectedListing}
        currentStatus={selectedListing?.status}
        onStatusChange={handleStatusChange}
      />

      {/* Status History Modal */}
      <StatusHistoryModal
        isOpen={showHistoryModal}
        onClose={() => {
          setShowHistoryModal(false);
          setSelectedListing(null);
        }}
        listing={selectedListing}
      />
    </div>
  );
}

export default MyListings;