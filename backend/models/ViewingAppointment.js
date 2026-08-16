// models/ViewingAppointment.js
const mongoose = require('mongoose');

const ViewingAppointmentSchema = new mongoose.Schema({
  listing_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Listing', 
    required: [true, 'Listing ID is required'] 
  },
  tenant_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Tenant ID is required'] 
  },
  owner_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Owner ID is required'] 
  },
  
  // Appointment details
  requested_date: { 
    type: Date, 
    required: [true, 'Requested date is required'],
    validate: {
      validator: function(value) {
        return value >= new Date();
      },
      message: 'Requested date must be in the future'
    }
  },
  requested_time: { 
    type: String, 
    required: [true, 'Requested time is required'],
    validate: {
      validator: function(value) {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value);
      },
      message: 'Time must be in HH:MM format (e.g., 14:30)'
    }
  },
  duration_minutes: { 
    type: Number, 
    default: 30,
    min: [15, 'Duration must be at least 15 minutes'],
    max: [120, 'Duration cannot exceed 120 minutes']
  },
  notes: { type: String, maxlength: 500 },
  
  // Status management
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled', 'rescheduled', 'completed'],
    default: 'pending'
  },
  
  // Suggested new time (for rescheduling)
  suggested_date: {
    type: Date,
    validate: {
      validator: function(value) {
        if (!value) return true;
        return value >= new Date();
      },
      message: 'Suggested date must be in the future'
    }
  },
  suggested_time: {
    type: String,
    validate: {
      validator: function(value) {
        if (!value) return true;
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value);
      },
      message: 'Suggested time must be in HH:MM format'
    }
  },
  suggested_notes: { type: String, maxlength: 500 },
  
  // Google Calendar integration
  google_calendar_event_id: { type: String },
  google_calendar_link: { type: String },
  synced_to_calendar: { type: Boolean, default: false },
  calendar_sync_date: { type: Date },
  calendar_sync_error: { type: String },
  
  // Status history
  status_history: [{
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled', 'rescheduled', 'completed']
    },
    changed_at: { type: Date, default: Date.now },
    changed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, maxlength: 500 }
  }],
  
  // Additional metadata
  tenant_phone: { 
    type: String,
    validate: {
      validator: function(value) {
        if (!value) return true;
        // Allow any phone number format (not just Bangladeshi)
        // Remove strict validation to accept any phone number
        return true;
      },
      message: 'Please enter a valid phone number'
    }
  },
  tenant_email: { 
    type: String,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(value) {
        if (!value) return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      },
      message: 'Please enter a valid email address'
    }
  },
  owner_response_date: { type: Date },
  completed_at: { type: Date },
  cancellation_reason: { type: String, maxlength: 500 },
  viewed_at: { type: Date },
  
}, { timestamps: true });

// ============================================
// INDEXES
// ============================================
ViewingAppointmentSchema.index({ listing_id: 1 });
ViewingAppointmentSchema.index({ tenant_id: 1 });
ViewingAppointmentSchema.index({ owner_id: 1 });
ViewingAppointmentSchema.index({ status: 1 });
ViewingAppointmentSchema.index({ requested_date: 1 });
ViewingAppointmentSchema.index({ created_at: -1 });
ViewingAppointmentSchema.index({ 
  owner_id: 1, 
  status: 1, 
  requested_date: -1 
});

// ============================================
// VIRTUALS
// ============================================

// Check if appointment is upcoming
ViewingAppointmentSchema.virtual('is_upcoming').get(function() {
  if (this.status !== 'approved') return false;
  const appointmentDateTime = this.getAppointmentDateTime();
  return appointmentDateTime > new Date();
});

// Check if appointment is past
ViewingAppointmentSchema.virtual('is_past').get(function() {
  if (this.status !== 'approved') return false;
  const appointmentDateTime = this.getAppointmentDateTime();
  return appointmentDateTime < new Date();
});

// Get full appointment date time
ViewingAppointmentSchema.virtual('appointment_datetime').get(function() {
  return this.getAppointmentDateTime();
});

// Get status display name
ViewingAppointmentSchema.virtual('status_display').get(function() {
  const statusMap = {
    'pending': 'Pending',
    'approved': 'Approved',
    'rejected': 'Rejected',
    'cancelled': 'Cancelled',
    'rescheduled': 'Rescheduled',
    'completed': 'Completed'
  };
  return statusMap[this.status] || this.status;
});

// ============================================
// INSTANCE METHODS
// ============================================

// Get appointment date time as Date object
ViewingAppointmentSchema.methods.getAppointmentDateTime = function() {
  const dateTime = new Date(this.requested_date);
  const [hours, minutes] = this.requested_time.split(':').map(Number);
  dateTime.setHours(hours, minutes, 0, 0);
  return dateTime;
};

// Get end time of appointment
ViewingAppointmentSchema.methods.getEndTime = function() {
  const startTime = this.getAppointmentDateTime();
  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + (this.duration_minutes || 30));
  return endTime;
};

// Update status with history
ViewingAppointmentSchema.methods.updateStatus = async function(newStatus, userId, notes = '') {
  const oldStatus = this.status;
  const validTransitions = {
    'pending': ['approved', 'rejected', 'cancelled', 'rescheduled'],
    'approved': ['completed', 'cancelled', 'rescheduled'],
    'rescheduled': ['approved', 'cancelled', 'rejected'],
    'rejected': [],
    'cancelled': [],
    'completed': []
  };

  if (!validTransitions[oldStatus] || !validTransitions[oldStatus].includes(newStatus)) {
    throw new Error(`Cannot transition from ${oldStatus} to ${newStatus}`);
  }

  this.status = newStatus;
  
  if (newStatus === 'completed') {
    this.completed_at = new Date();
    this.viewed_at = new Date();
  }
  
  if (newStatus === 'cancelled' || newStatus === 'rejected') {
    this.cancellation_reason = notes;
  }
  
  if (newStatus === 'approved') {
    this.owner_response_date = new Date();
  }
  
  this.status_history.push({
    status: newStatus,
    changed_at: new Date(),
    changed_by: userId,
    notes: notes || `Status changed from ${oldStatus} to ${newStatus}`
  });
  
  await this.save();
  return { oldStatus, newStatus };
};

// Reschedule appointment
ViewingAppointmentSchema.methods.reschedule = async function(newDate, newTime, notes = '', userId) {
  const newDateTime = new Date(newDate);
  if (newDateTime < new Date()) {
    throw new Error('New date must be in the future');
  }
  
  if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(newTime)) {
    throw new Error('Time must be in HH:MM format');
  }

  this.status = 'rescheduled';
  this.suggested_date = newDateTime;
  this.suggested_time = newTime;
  this.suggested_notes = notes || '';
  
  this.status_history.push({
    status: 'rescheduled',
    changed_at: new Date(),
    changed_by: userId,
    notes: `Rescheduled to ${newDate} at ${newTime}${notes ? ': ' + notes : ''}`
  });
  
  await this.save();
  return this;
};

// Accept reschedule
ViewingAppointmentSchema.methods.acceptReschedule = async function(userId) {
  if (this.status !== 'rescheduled') {
    throw new Error('No pending reschedule to accept');
  }
  
  if (!this.suggested_date || !this.suggested_time) {
    throw new Error('No suggested date/time found');
  }

  this.requested_date = this.suggested_date;
  this.requested_time = this.suggested_time;
  this.status = 'approved';
  this.suggested_date = undefined;
  this.suggested_time = undefined;
  this.suggested_notes = undefined;

  this.status_history.push({
    status: 'approved',
    changed_at: new Date(),
    changed_by: userId,
    notes: 'Accepted reschedule suggestion'
  });

  await this.save();
  return this;
};

// Check if appointment can be cancelled
ViewingAppointmentSchema.methods.canCancel = function() {
  return ['pending', 'approved', 'rescheduled'].includes(this.status);
};

// Check if appointment can be rescheduled
ViewingAppointmentSchema.methods.canReschedule = function() {
  return ['pending', 'approved'].includes(this.status);
};

// Get status color for UI
ViewingAppointmentSchema.methods.getStatusColor = function() {
  const colorMap = {
    'pending': '#F59E0B',
    'approved': '#10B981',
    'rejected': '#EF4444',
    'cancelled': '#6B7280',
    'rescheduled': '#3B82F6',
    'completed': '#8B5CF6'
  };
  return colorMap[this.status] || '#6B7280';
};

// ============================================
// STATIC METHODS
// ============================================

// Get appointments by date range
ViewingAppointmentSchema.statics.getByDateRange = async function(ownerId, startDate, endDate) {
  return this.find({
    owner_id: ownerId,
    requested_date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    },
    status: { $in: ['approved', 'pending'] }
  }).populate('listing_id', 'title area city')
    .populate('tenant_id', 'name email phone')
    .sort({ requested_date: 1, requested_time: 1 });
};

// Get upcoming appointments for owner
ViewingAppointmentSchema.statics.getUpcomingForOwner = async function(ownerId, limit = 10) {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  
  return this.find({
    owner_id: ownerId,
    status: 'approved',
    requested_date: { $gte: today }
  })
  .populate('listing_id', 'title area city')
  .populate('tenant_id', 'name email phone')
  .sort({ requested_date: 1, requested_time: 1 })
  .limit(limit);
};

// Get pending count for owner
ViewingAppointmentSchema.statics.getPendingCount = async function(ownerId) {
  return this.countDocuments({
    owner_id: ownerId,
    status: 'pending'
  });
};

// ============================================
// MIDDLEWARE
// ============================================

// Pre-save middleware to ensure requested_date is at least today
ViewingAppointmentSchema.pre('save', function(next) {
  if (this.isNew && this.requested_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const requestedDate = new Date(this.requested_date);
    requestedDate.setHours(0, 0, 0, 0);
    
    if (requestedDate < today) {
      next(new Error('Requested date cannot be in the past'));
    }
  }
  next();
});

// Pre-save middleware to set tenant_email if not provided
ViewingAppointmentSchema.pre('save', async function(next) {
  if (!this.tenant_email && this.tenant_id) {
    try {
      const User = mongoose.model('User');
      const tenant = await User.findById(this.tenant_id);
      if (tenant) {
        this.tenant_email = tenant.email;
      }
    } catch (error) {
      // Silently fail - email will be populated later
    }
  }
  next();
});

// ============================================
// TO JSON TRANSFORM
// ============================================
ViewingAppointmentSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

ViewingAppointmentSchema.set('toObject', {
  virtuals: true
});

module.exports = mongoose.model('ViewingAppointment', ViewingAppointmentSchema);