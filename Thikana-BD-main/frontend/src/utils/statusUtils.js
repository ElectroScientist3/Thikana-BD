// src/utils/statusUtils.js
export const STATUS_OPTIONS = [
  { value: 'available_now', label: 'Available Now', color: 'emerald', icon: 'AN' },
  { value: 'available_from_date', label: 'Available From Date', color: 'blue', icon: 'FD' },
  { value: 'on_hold', label: 'On Hold', color: 'amber', icon: 'OH' },
  { value: 'reserved', label: 'Reserved', color: 'purple', icon: 'RS' },
  { value: 'rented', label: 'Rented', color: 'red', icon: 'RT' },
];

export const STATUS_CONFIG = {
  'available_now': {
    label: 'Available Now',
    color: 'emerald',
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    icon: 'AN'
  },
  'available_from_date': {
    label: 'Available From Date',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    icon: 'FD'
  },
  'on_hold': {
    label: 'On Hold',
    color: 'amber',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    icon: 'OH'
  },
  'reserved': {
    label: 'Reserved',
    color: 'purple',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200',
    icon: 'RS'
  },
  'rented': {
    label: 'Rented',
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    borderColor: 'border-red-200',
    icon: 'RT'
  }
};

export const getStatusConfig = (status) => {
  return STATUS_CONFIG[status] || {
    label: status || 'Unknown',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-200',
    icon: 'UN'
  };
};

export const isListingAvailable = (listing) => {
  if (listing.status === 'rented') return false;
  if (listing.status === 'on_hold') {
    return listing.hold_expiry_date ? new Date() > new Date(listing.hold_expiry_date) : false;
  }
  if (listing.status === 'reserved') {
    return listing.reservation_expiry_date ? new Date() > new Date(listing.reservation_expiry_date) : false;
  }
  if (listing.status === 'available_from_date') {
    return listing.available_from ? new Date() >= new Date(listing.available_from) : false;
  }
  return listing.status === 'available_now';
};

export const getStatusTransitions = (currentStatus) => {
  const transitions = {
    'available_now': ['available_from_date', 'on_hold', 'reserved', 'rented'],
    'available_from_date': ['available_now', 'on_hold', 'reserved', 'rented'],
    'on_hold': ['available_now', 'available_from_date', 'reserved', 'rented'],
    'reserved': ['available_now', 'available_from_date', 'on_hold', 'rented'],
    'rented': ['available_now']
  };
  return transitions[currentStatus] || [];
};

export const getDefaultExpiryDays = (status) => {
  switch(status) {
    case 'on_hold': return 7;
    case 'reserved': return 3;
    default: return null;
  }
};