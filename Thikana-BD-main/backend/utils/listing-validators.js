const VALID_STATUSES = ['available_now', 'available_from_date', 'on_hold', 'reserved', 'rented'];

const validateListingStatus = (status) => {
  return VALID_STATUSES.includes(status);
};

const validateStatusTransition = (currentStatus, newStatus, extraData = {}) => {
  // Define allowed transitions
  const transitions = {
    'available_now': ['available_from_date', 'on_hold', 'reserved', 'rented'],
    'available_from_date': ['available_now', 'on_hold', 'reserved', 'rented'],
    'on_hold': ['available_now', 'available_from_date', 'reserved', 'rented'],
    'reserved': ['available_now', 'available_from_date', 'on_hold', 'rented'],
    'rented': ['available_now'] // Can only go back to available
  };

  if (!transitions[currentStatus]) {
    return { valid: false, message: 'Invalid current status' };
  }

  if (!transitions[currentStatus].includes(newStatus)) {
    return { 
      valid: false, 
      message: `Cannot transition from ${currentStatus} to ${newStatus}` 
    };
  }

  // Additional validation for specific transitions
  if (newStatus === 'rented' && !extraData.rented_to_user_id) {
    return { valid: false, message: 'User ID required when marking as rented' };
  }

  if (newStatus === 'available_from_date' && !extraData.available_from) {
    return { valid: false, message: 'Available from date required' };
  }

  return { valid: true };
};

const getDefaultExpiryDate = (status) => {
  const now = new Date();
  switch(status) {
    case 'on_hold':
      return new Date(now.setDate(now.getDate() + 7)); // 7 days
    case 'reserved':
      return new Date(now.setDate(now.getDate() + 3)); // 3 days
    default:
      return null;
  }
};

const isListingAvailable = (listing) => {
  if (listing.status === 'rented') return false;
  if (listing.status === 'on_hold') {
    return listing.hold_expiry_date ? new Date() > listing.hold_expiry_date : false;
  }
  if (listing.status === 'reserved') {
    return listing.reservation_expiry_date ? new Date() > listing.reservation_expiry_date : false;
  }
  if (listing.status === 'available_from_date') {
    return listing.available_from ? new Date() >= listing.available_from : false;
  }
  return listing.status === 'available_now';
};

module.exports = {
  VALID_STATUSES,
  validateListingStatus,
  validateStatusTransition,
  getDefaultExpiryDate,
  isListingAvailable
};