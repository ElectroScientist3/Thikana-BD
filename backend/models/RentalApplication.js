// backend/models/RentalApplication.js
const mongoose = require('mongoose');

const RentalApplicationSchema = new mongoose.Schema({
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
  viewing_appointment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ViewingAppointment'
  },
  
  // Application Details
  move_in_date: {
    type: Date,
    required: [true, 'Move-in date is required'],
    validate: {
      validator: function(value) {
        return value >= new Date();
      },
      message: 'Move-in date must be in the future'
    }
  },
  number_of_occupants: {
    type: Number,
    required: [true, 'Number of occupants is required'],
    min: [1, 'Must have at least 1 occupant'],
    max: [20, 'Cannot have more than 20 occupants']
  },
  tenant_type: {
    type: String,
    enum: ['family', 'couple', 'single_professional', 'student', 'group'],
    required: [true, 'Tenant type is required']
  },
  
  // Employment/Institution Information
  occupation: {
    type: String,
    enum: ['employed', 'self_employed', 'student', 'retired', 'unemployed', 'business_owner'],
    required: [true, 'Occupation status is required']
  },
  employer_institution: {
    type: String,
    trim: true
  },
  job_title: {
    type: String,
    trim: true
  },
  income_range: {
    type: String,
    enum: [
      'below_20000', '20000_40000', '40000_60000', '60000_80000',
      '80000_100000', '100000_150000', '150000_above'
    ],
    required: [true, 'Income range is required']
  },
  income_proof_document: {
    type: String
  },
  
  // Personal Information
  emergency_contact_name: {
    type: String,
    required: [true, 'Emergency contact name is required']
  },
  emergency_contact_phone: {
    type: String,
    required: [true, 'Emergency contact phone is required']
  },
  emergency_contact_relationship: {
    type: String,
    required: [true, 'Emergency contact relationship is required']
  },
  
  // Additional Information
  preferred_lease_duration: {
    type: String,
    enum: ['3_months', '6_months', '1_year', '2_years', 'flexible'],
    required: [true, 'Preferred lease duration is required']
  },
  additional_notes: {
    type: String,
    maxlength: 1000
  },
  pet_policy: {
    type: String,
    enum: ['no_pets', 'small_pets', 'large_pets', 'any_pets'],
    default: 'no_pets'
  },
  smoking_allowed: {
    type: Boolean,
    default: false
  },
  
  // Supporting Documents
  supporting_documents: [{
    name: { type: String },
    url: { type: String },
    uploaded_at: { type: Date, default: Date.now }
  }],
  
  // Status Management
  status: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected', 'withdrawn'],
    default: 'pending'
  },
  status_history: [{
    status: {
      type: String,
      enum: ['pending', 'under_review', 'approved', 'rejected', 'withdrawn']
    },
    changed_at: { type: Date, default: Date.now },
    changed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, maxlength: 500 }
  }],
  
  // Review Notes (for owner)
  review_notes: {
    type: String,
    maxlength: 1000
  },
  rejection_reason: {
    type: String,
    maxlength: 500
  },
  
  // Timestamps
  submitted_at: { type: Date, default: Date.now },
  reviewed_at: Date,
  approved_at: Date,
  rejected_at: Date,
  
  // Application completion tracking
  completion_percentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  }
}, { timestamps: true });

// ============================================
// INDEXES
// ============================================
RentalApplicationSchema.index({ listing_id: 1, status: 1 });
RentalApplicationSchema.index({ tenant_id: 1 });
RentalApplicationSchema.index({ owner_id: 1, status: 1 });
RentalApplicationSchema.index({ submitted_at: -1 });
RentalApplicationSchema.index({ listing_id: 1, status: 1, move_in_date: 1 });

// ============================================
// VIRTUALS
// ============================================

RentalApplicationSchema.virtual('status_display').get(function() {
  const statusMap = {
    'pending': 'Pending',
    'under_review': 'Under Review',
    'approved': 'Approved',
    'rejected': 'Rejected',
    'withdrawn': 'Withdrawn'
  };
  return statusMap[this.status] || this.status;
});

RentalApplicationSchema.virtual('status_color').get(function() {
  const colorMap = {
    'pending': '#F59E0B',
    'under_review': '#3B82F6',
    'approved': '#10B981',
    'rejected': '#EF4444',
    'withdrawn': '#6B7280'
  };
  return colorMap[this.status] || '#6B7280';
});

RentalApplicationSchema.virtual('is_active').get(function() {
  return ['pending', 'under_review'].includes(this.status);
});

// ============================================
// INSTANCE METHODS
// ============================================

RentalApplicationSchema.methods.updateStatus = async function(newStatus, userId, notes = '') {
  const validTransitions = {
    'pending': ['under_review', 'approved', 'rejected', 'withdrawn'],
    'under_review': ['approved', 'rejected', 'withdrawn'],
    'approved': [],
    'rejected': [],
    'withdrawn': []
  };

  if (!validTransitions[this.status] || !validTransitions[this.status].includes(newStatus)) {
    throw new Error(`Cannot transition from ${this.status} to ${newStatus}`);
  }

  const oldStatus = this.status;
  this.status = newStatus;
  
  if (newStatus === 'approved') {
    this.approved_at = new Date();
    this.reviewed_at = new Date();
  }
  if (newStatus === 'rejected') {
    this.rejected_at = new Date();
    this.reviewed_at = new Date();
  }
  if (newStatus === 'under_review') {
    this.reviewed_at = new Date();
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

RentalApplicationSchema.methods.calculateCompletion = function() {
  const requiredFields = [
    'move_in_date',
    'number_of_occupants',
    'tenant_type',
    'occupation',
    'income_range',
    'emergency_contact_name',
    'emergency_contact_phone',
    'emergency_contact_relationship',
    'preferred_lease_duration'
  ];
  
  let filled = 0;
  requiredFields.forEach(field => {
    if (this[field]) filled++;
  });
  
  let bonus = 0;
  if (this.employer_institution) bonus += 1;
  if (this.job_title) bonus += 1;
  if (this.income_proof_document) bonus += 2;
  if (this.additional_notes) bonus += 1;
  if (this.supporting_documents && this.supporting_documents.length > 0) bonus += 2;
  
  const basePercentage = (filled / requiredFields.length) * 100;
  const bonusPercentage = Math.min(bonus, 20);
  
  this.completion_percentage = Math.min(Math.round(basePercentage + bonusPercentage), 100);
  return this.completion_percentage;
};

RentalApplicationSchema.methods.isEligible = function(listing) {
  const incomeThresholds = {
    'below_20000': 20000,
    '20000_40000': 40000,
    '40000_60000': 60000,
    '60000_80000': 80000,
    '80000_100000': 100000,
    '100000_150000': 150000,
    '150000_above': 150000
  };
  
  const income = incomeThresholds[this.income_range] || 0;
  const monthlyRent = listing.monthly_rent_bdt || 0;
  
  if (income > 0 && monthlyRent > income * 0.4) {
    return false;
  }
  
  return true;
};

// ============================================
// STATIC METHODS
// ============================================

RentalApplicationSchema.statics.getForListing = async function(listingId, ownerId) {
  return this.find({ listing_id: listingId, owner_id: ownerId })
    .populate('tenant_id', 'name email phone currentLocation')
    .populate('listing_id', 'title monthly_rent_bdt area city')
    .sort({ submitted_at: -1 });
};

RentalApplicationSchema.statics.getPendingCount = async function(ownerId) {
  return this.countDocuments({
    owner_id: ownerId,
    status: { $in: ['pending', 'under_review'] }
  });
};

RentalApplicationSchema.statics.getByStatus = async function(ownerId, status, limit = 50) {
  return this.find({ owner_id: ownerId, status })
    .populate('tenant_id', 'name email phone currentLocation')
    .populate('listing_id', 'title monthly_rent_bdt area city')
    .sort({ submitted_at: -1 })
    .limit(limit);
};

RentalApplicationSchema.statics.getForTenant = async function(tenantId) {
  return this.find({ tenant_id: tenantId })
    .populate('listing_id', 'title monthly_rent_bdt area city images owner_name owner_email')
    .populate('owner_id', 'name email phone')
    .sort({ submitted_at: -1 });
};

RentalApplicationSchema.statics.hasApplied = async function(listingId, tenantId) {
  const count = await this.countDocuments({
    listing_id: listingId,
    tenant_id: tenantId,
    status: { $in: ['pending', 'under_review', 'approved'] }
  });
  return count > 0;
};

// ============================================
// MIDDLEWARE
// ============================================

RentalApplicationSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('move_in_date') || 
      this.isModified('number_of_occupants') || this.isModified('tenant_type') ||
      this.isModified('occupation') || this.isModified('income_range') ||
      this.isModified('emergency_contact_name') || this.isModified('emergency_contact_phone') ||
      this.isModified('emergency_contact_relationship') || this.isModified('preferred_lease_duration')) {
    this.calculateCompletion();
  }
  next();
});

RentalApplicationSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

RentalApplicationSchema.set('toObject', {
  virtuals: true
});

module.exports = mongoose.model('RentalApplication', RentalApplicationSchema);