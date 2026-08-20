// src/components/ApplicationStatusBadge.jsx
const STATUS_CONFIG = {
  'pending': { label: 'Pending', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  'under_review': { label: 'Under Review', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  'approved': { label: 'Approved', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  'rejected': { label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-200' },
  'withdrawn': { label: 'Withdrawn', color: 'bg-gray-100 text-gray-700 border-gray-200' }
};

function ApplicationStatusBadge({ status, showLabel = true, size = 'sm' }) {
  const config = STATUS_CONFIG[status] || { 
    label: status || 'Unknown', 
    color: 'bg-gray-100 text-gray-700 border-gray-200' 
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base'
  };

  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${sizeClasses[size]} ${config.color}`}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-60"></span>
      {showLabel && config.label}
    </span>
  );
}

export default ApplicationStatusBadge;