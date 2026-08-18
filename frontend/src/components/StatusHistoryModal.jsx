// src/components/StatusHistoryModal.jsx
import StatusBadge from './StatusBadge';

function StatusHistoryModal({ isOpen, onClose, listing }) {
  if (!isOpen || !listing) return null;

  const formatDate = (date) => {
    return date ? new Date(date).toLocaleString() : 'N/A';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[80vh] p-6 overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-4 border-b border-slate-200">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Status History</h3>
            <p className="text-sm text-slate-500">{listing.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl hover:text-slate-700 transition"
          >
            ✕
          </button>
        </div>

        {!listing.status_history || listing.status_history.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <div className="text-4xl mb-3">📋</div>
            <p>No status history available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {listing.status_history.map((history, index) => (
              <div key={index} className="relative pl-6 pb-4 border-l-2 border-blue-200 last:border-l-0 last:pb-0">
                <div className="absolute left-[-6px] top-0 w-3 h-3 rounded-full bg-blue-500"></div>
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={history.status} />
                  <span className="text-xs text-slate-500">
                    {formatDate(history.changed_at)}
                  </span>
                </div>
                {history.changed_by && (
                  <div className="text-xs text-slate-600 ml-1">
                    By: {history.changed_by.name || history.changed_by.email || 'System'}
                  </div>
                )}
                {history.notes && (
                  <div className="text-sm text-slate-700 mt-1 ml-1 p-2 bg-slate-50 rounded-lg">
                    📝 {history.notes}
                  </div>
                )}
                {index < listing.status_history.length - 1 && (
                  <div className="absolute left-[-1px] top-3 w-0.5 h-full bg-blue-200"></div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default StatusHistoryModal;