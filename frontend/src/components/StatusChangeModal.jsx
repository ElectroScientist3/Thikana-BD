// src/components/StatusChangeModal.jsx
import { useState } from 'react';
import StatusBadge from './StatusBadge';

const STATUS_OPTIONS = [
  { value: 'available_now', label: 'Available Now' },
  { value: 'available_from_date', label: 'Available From Date' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'rented', label: 'Rented' },
];

function StatusChangeModal({ 
  isOpen, 
  onClose, 
  listing, 
  onStatusChange, 
  currentStatus 
}) {
  const [notes, setNotes] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);

  if (!isOpen || !listing) return null;

  const handleSubmit = async () => {
    if (selectedStatus === currentStatus) {
      alert('This is already the current status');
      return;
    }

    setLoading(true);
    try {
      await onStatusChange(listing._id, selectedStatus, notes);
      setNotes('');
      setSelectedStatus(currentStatus);
      onClose();
    } catch (error) {
      alert(error.message || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Change Status</h3>
            <p className="text-sm text-slate-500 mt-1">{listing.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl hover:text-slate-700 transition"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>Current:</span>
            <StatusBadge status={currentStatus} />
          </div>
        </div>

        <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSelectedStatus(opt.value)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                selectedStatus === opt.value
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{opt.label}</span>
                <StatusBadge status={opt.value} size="sm" />
              </div>
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Add notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-4 py-2 border rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-xl hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || selectedStatus === currentStatus}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Status'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default StatusChangeModal;