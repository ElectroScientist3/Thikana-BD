const mongoose = require('mongoose');

const MoveOutRequestSchema = new mongoose.Schema({
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, trim: true, maxlength: 1000 },
  inspectionRequested: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['Pending', 'Accepted', 'Rejected'],
    default: 'Pending',
  },
  decidedAt: Date,
}, { timestamps: true });

MoveOutRequestSchema.index({ tenant: 1, createdAt: -1 });
MoveOutRequestSchema.index({ owner: 1, listing: 1, createdAt: -1 });

module.exports = mongoose.model('MoveOutRequest', MoveOutRequestSchema);
