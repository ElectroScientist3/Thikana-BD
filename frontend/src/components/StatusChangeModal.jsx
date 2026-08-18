// src/components/StatusChangeModal.jsx
import { useState, useEffect } from 'react';
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
  const [availableFromDate, setAvailableFromDate] = useState('');
  const [holdExpiryDate, setHoldExpiryDate] = useState('');
  const [reservationExpiryDate, setReservationExpiryDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Reset form when modal opens or listing changes
  useEffect(() => {
    if (isOpen && listing) {
      setSelectedStatus(currentStatus);
      setNotes('');
      setAvailableFromDate('');
      setHoldExpiryDate('');
      setReservationExpiryDate('');
      setShowDatePicker(false);
      
      // Pre-fill dates if they exist
      if (listing.available_from) {
        setAvailableFromDate(new Date(listing.available_from).toISOString().split('T')[0]);
      }
      if (listing.hold_expiry_date) {
        setHoldExpiryDate(new Date(listing.hold_expiry_date).toISOString().split('T')[0]);
      }
      if (listing.reservation_expiry_date) {
        setReservationExpiryDate(new Date(listing.reservation_expiry_date).toISOString().split('T')[0]);
      }
    }
  }, [isOpen, listing, currentStatus]);

  if (!isOpen || !listing) return null;

  const handleStatusSelect = (status) => {
    setSelectedStatus(status);
    // Show date picker for statuses that require dates
    if (status === 'available_from_date') {
      setShowDatePicker(true);
    } else if (status === 'on_hold') {
      setShowDatePicker(true);
    } else if (status === 'reserved') {
      setShowDatePicker(true);
    } else {
      setShowDatePicker(false);
    }
  };

  const handleSubmit = async () => {
    // Validation for available_from_date
    if (selectedStatus === 'available_from_date' && !availableFromDate) {
      alert('Please select a date for "Available From Date"');
      return;
    }

    // Validation for on_hold
    if (selectedStatus === 'on_hold' && !holdExpiryDate) {
      alert('Please select a hold expiry date');
      return;
    }

    // Validation for reserved
    if (selectedStatus === 'reserved' && !reservationExpiryDate) {
      alert('Please select a reservation expiry date');
      return;
    }

    if (selectedStatus === currentStatus) {
      alert('This is already the current status');
      return;
    }

    setLoading(true);
    try {
      // Prepare the data based on selected status
      const statusData = {
        status: selectedStatus,
        notes: notes || ''
      };

      // Add date fields based on status
      if (selectedStatus === 'available_from_date' && availableFromDate) {
        statusData.available_from = availableFromDate;
      }
      if (selectedStatus === 'on_hold' && holdExpiryDate) {
        statusData.hold_expiry_date = holdExpiryDate;
      }
      if (selectedStatus === 'reserved' && reservationExpiryDate) {
        statusData.reservation_expiry_date = reservationExpiryDate;
      }

      await onStatusChange(listing._id, selectedStatus, notes, statusData);
      setNotes('');
      setSelectedStatus(currentStatus);
      setAvailableFromDate('');
      setHoldExpiryDate('');
      setReservationExpiryDate('');
      setShowDatePicker(false);
      onClose();
    } catch (error) {
      alert(error.message || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  // Get today's date for min attribute
  const today = new Date().toISOString().split('T')[0];

  // Check if status requires a date
  const requiresDate = (status) => {
    return ['available_from_date', 'on_hold', 'reserved'].includes(status);
  };

  // Get date field label
  const getDateLabel = (status) => {
    switch(status) {
      case 'available_from_date':
        return 'Available From Date';
      case 'on_hold':
        return 'Hold Expiry Date';
      case 'reserved':
        return 'Reservation Expiry Date';
      default:
        return 'Date';
    }
  };

  // Get date field value
  const getDateValue = (status) => {
    switch(status) {
      case 'available_from_date':
        return availableFromDate;
      case 'on_hold':
        return holdExpiryDate;
      case 'reserved':
        return reservationExpiryDate;
      default:
        return '';
    }
  };

  // Set date field value
  const setDateValue = (status, value) => {
    switch(status) {
      case 'available_from_date':
        setAvailableFromDate(value);
        break;
      case 'on_hold':
        setHoldExpiryDate(value);
        break;
      case 'reserved':
        setReservationExpiryDate(value);
        break;
      default:
        break;
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
              onClick={() => handleStatusSelect(opt.value)}
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

        {/* Date Picker - Shows when status requires a date */}
        {showDatePicker && requiresDate(selectedStatus) && (
          <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {getDateLabel(selectedStatus)} <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={getDateValue(selectedStatus)}
              onChange={(e) => setDateValue(selectedStatus, e.target.value)}
              min={today}
              className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              {selectedStatus === 'available_from_date' && 'Select the date when the property will become available'}
              {selectedStatus === 'on_hold' && 'Select the date when the hold will expire'}
              {selectedStatus === 'reserved' && 'Select the date when the reservation will expire'}
            </p>
          </div>
        )}

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