// src/components/ApplicationComparisonModal.jsx
import { useState } from 'react';
import { useApplications } from '../hooks/useApplications';
import ApplicationStatusBadge from './ApplicationStatusBadge';

function ApplicationComparisonModal({ isOpen, onClose, listing, applications, onCompare }) {
  const { createComparison, loading } = useApplications();
  const [selectedIds, setSelectedIds] = useState([]);
  const [comparisonName, setComparisonName] = useState('');
  const [notes, setNotes] = useState('');

  if (!isOpen || !listing) return null;

  const toggleSelection = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleCompare = async () => {
    if (selectedIds.length < 2) {
      alert('Please select at least 2 applications to compare');
      return;
    }

    try {
      const result = await createComparison(
        listing._id,
        selectedIds,
        comparisonName || `Comparison for ${listing.title}`,
        notes
      );
      
      if (result) {
        onCompare && onCompare(result);
        onClose();
      }
    } catch (err) {
      alert(err.message || 'Failed to create comparison');
    }
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

  const formatDate = (date) => {
    return date ? new Date(date).toLocaleDateString() : 'N/A';
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-2 border-b border-slate-200">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Compare Applications</h3>
            <p className="text-sm text-slate-500">{listing.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl hover:text-slate-700 p-1"
          >
            ×
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Comparison Name
          </label>
          <input
            type="text"
            value={comparisonName}
            onChange={(e) => setComparisonName(e.target.value)}
            placeholder="e.g., Top Candidates for August"
            className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows="2"
            placeholder="Any notes about this comparison..."
            className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4 text-sm text-slate-600">
          Select at least 2 applications to compare. Selected: {selectedIds.length}
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {applications.map(app => (
            <div
              key={app._id}
              className={`p-4 rounded-xl border-2 cursor-pointer transition ${getStatusColor(app.status)} ${
                selectedIds.includes(app._id) ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent'
              }`}
              onClick={() => toggleSelection(app._id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(app._id)}
                      onChange={() => toggleSelection(app._id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded"
                    />
                    <span className="font-semibold text-slate-900">
                      {app.tenant_id?.name || 'Unknown Tenant'}
                    </span>
                    <ApplicationStatusBadge status={app.status} size="sm" />
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
                      <span className="text-slate-500">Tenant Type:</span>
                      <span className="ml-1 font-medium">{getTenantTypeLabel(app.tenant_type)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Income:</span>
                      <span className="ml-1 font-medium">{getIncomeLabel(app.income_range)}</span>
                    </div>
                  </div>
                  {app.completion_percentage > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Completion:</span>
                        <div className="flex-1 max-w-[100px] h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${app.completion_percentage}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">{app.completion_percentage}%</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-right text-sm">
                  <div className="text-slate-500">Submitted</div>
                  <div className="font-medium">{formatDate(app.submitted_at)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-xl hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleCompare}
            disabled={selectedIds.length < 2 || loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Compare Selected'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApplicationComparisonModal;