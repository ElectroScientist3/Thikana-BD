const mongoose = require('mongoose');

const MaintenanceIssueSchema = new mongoose.Schema({
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: {
    type: String,
    enum: ['Water', 'Gas', 'Electrical', 'Lift', 'Leakage', 'Security', 'Internet', 'Other'],
    default: 'Other',
  },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  status: {
    type: String,
    enum: ['Submitted', 'Acknowledged', 'In Progress', 'Resolved', 'Closed'],
    default: 'Submitted',
  },
  statusUpdatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

MaintenanceIssueSchema.index({ tenant: 1, createdAt: -1 });
MaintenanceIssueSchema.index({ owner: 1, listing: 1, createdAt: -1 });

module.exports = mongoose.model('MaintenanceIssue', MaintenanceIssueSchema);
