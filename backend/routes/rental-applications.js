// routes/rental-applications.js
const express = require('express');
const router = express.Router();
const RentalApplication = require('../models/RentalApplication');
const Booking = require('../models/Booking');
const crypto = require('crypto');
const Listing = require('../models/Listing');
const User = require('../models/User');
const ViewingAppointment = require('../models/ViewingAppointment');
const Notification = require('../models/Notification');
const ApplicationComparison = require('../models/ApplicationComparison');
const { authMiddleware } = require('../middleware/auth');

// ============================================
// TENANT ROUTES
// ============================================

// Submit a rental application (tenant)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const tenant_id = req.userId;
    const {
      listing_id,
      viewing_appointment_id,
      move_in_date,
      number_of_occupants,
      tenant_type,
      occupation,
      employer_institution,
      job_title,
      income_range,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relationship,
      preferred_lease_duration,
      additional_notes,
      pet_policy,
      smoking_allowed,
      supporting_documents
    } = req.body;

    // Validate required fields
    if (!listing_id || !move_in_date || !number_of_occupants || !tenant_type ||
        !occupation || !income_range || !emergency_contact_name ||
        !emergency_contact_phone || !emergency_contact_relationship ||
        !preferred_lease_duration) {
      return res.status(400).json({ 
        msg: 'All required fields must be filled' 
      });
    }

    // Verify listing exists and get owner
    const listing = await Listing.findById(listing_id);
    if (!listing) {
      return res.status(404).json({ msg: 'Listing not found' });
    }

    // Check if listing is available for applications (not rented)
    if (listing.status === 'rented') {
      return res.status(400).json({ msg: 'This property is already rented' });
    }

    // Get tenant details
    const tenant = await User.findById(tenant_id);
    if (!tenant) {
      return res.status(404).json({ msg: 'Tenant not found' });
    }

    // Check if tenant has already applied
    const hasApplied = await RentalApplication.hasApplied(listing_id, tenant_id);
    if (hasApplied) {
      return res.status(400).json({ 
        msg: 'You have already submitted an application for this property' 
      });
    }

    // If viewing_appointment_id is provided, verify it exists and is completed
    if (viewing_appointment_id) {
      const viewing = await ViewingAppointment.findOne({
        _id: viewing_appointment_id,
        tenant_id: tenant_id,
        listing_id: listing_id,
        status: 'completed'
      });
      
      if (!viewing) {
        return res.status(400).json({ 
          msg: 'Valid completed viewing appointment is required' 
        });
      }
    }

    // Create application
    const application = new RentalApplication({
      listing_id,
      tenant_id,
      owner_id: listing.owner_id,
      viewing_appointment_id: viewing_appointment_id || null,
      move_in_date: new Date(move_in_date),
      number_of_occupants,
      tenant_type,
      occupation,
      employer_institution: employer_institution || '',
      job_title: job_title || '',
      income_range,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relationship,
      preferred_lease_duration: preferred_lease_duration || '1_year',
      additional_notes: additional_notes || '',
      pet_policy: pet_policy || 'no_pets',
      smoking_allowed: smoking_allowed || false,
      supporting_documents: supporting_documents || [],
      status: 'pending',
      status_history: [{
        status: 'pending',
        changed_at: new Date(),
        changed_by: tenant_id,
        notes: 'Application submitted'
      }],
      submitted_at: new Date()
    });

    // Calculate completion
    application.calculateCompletion();

    await application.save();

    // Create notification for OWNER
    await Notification.create({
      user_id: listing.owner_id,
      listing_id: listing._id,
      type: 'application_submitted',
      message: `New rental application from ${tenant.name} for "${listing.title}"`,
      data: {
        application_id: application._id,
        tenant_name: tenant.name,
        tenant_email: tenant.email,
        tenant_phone: tenant.phone,
        move_in_date: move_in_date,
        listing_title: listing.title,
        listing_id: listing._id,
        owner_id: listing.owner_id
      }
    });

    res.status(201).json({
      msg: 'Application submitted successfully',
      application
    });
  } catch (err) {
    console.error('Application submission error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get tenant's applications
router.get('/tenant', authMiddleware, async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    const query = { tenant_id: req.userId };
    
    if (status) {
      query.status = status;
    }

    const applications = await RentalApplication.find(query)
      .populate('listing_id', 'title area city monthly_rent_bdt images owner_name owner_email')
      .populate('owner_id', 'name email phone')
      .sort({ submitted_at: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await RentalApplication.countDocuments(query);

    res.json({
      applications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get tenant's application status for a listing
router.get('/tenant/status/:listingId', authMiddleware, async (req, res) => {
  try {
    const { listingId } = req.params;
    
    if (!listingId || listingId === 'undefined' || listingId === 'null') {
      return res.status(400).json({ 
        hasApplied: false,
        msg: 'Invalid listing ID' 
      });
    }

    const application = await RentalApplication.findOne({
      listing_id: listingId,
      tenant_id: req.userId
    }).sort({ submitted_at: -1 });

    if (!application) {
      return res.json({ 
        hasApplied: false,
        msg: 'No application found for this listing' 
      });
    }

    res.json({
      hasApplied: true,
      status: application.status,
      applicationId: application._id,
      submittedAt: application.submitted_at,
      completionPercentage: application.completion_percentage
    });
  } catch (err) {
    console.error('Error in get application status:', err);
    if (err.name === 'CastError') {
      return res.status(400).json({ 
        hasApplied: false,
        msg: 'Invalid listing ID format' 
      });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get tenant's application by viewing appointment ID
router.get('/tenant/by-viewing/:viewingId', authMiddleware, async (req, res) => {
  try {
    const { viewingId } = req.params;
    
    if (!viewingId || viewingId === 'undefined' || viewingId === 'null') {
      return res.status(400).json({ 
        hasApplication: false,
        msg: 'Invalid viewing ID' 
      });
    }

    // First find the viewing to get listing_id and tenant_id
    const viewing = await ViewingAppointment.findById(viewingId);
    if (!viewing) {
      return res.status(404).json({ 
        hasApplication: false,
        msg: 'Viewing appointment not found' 
      });
    }

    // Find application for this viewing
    const application = await RentalApplication.findOne({
      viewing_appointment_id: viewingId,
      tenant_id: req.userId
    }).populate('listing_id', 'title area city monthly_rent_bdt images owner_name owner_email')
      .populate('owner_id', 'name email phone');

    if (!application) {
      return res.json({ 
        hasApplication: false,
        msg: 'No application found for this viewing' 
      });
    }

    res.json({
      hasApplication: true,
      application: {
        _id: application._id,
        status: application.status,
        submitted_at: application.submitted_at,
        move_in_date: application.move_in_date,
        number_of_occupants: application.number_of_occupants,
        tenant_type: application.tenant_type,
        income_range: application.income_range,
        preferred_lease_duration: application.preferred_lease_duration,
        emergency_contact_name: application.emergency_contact_name,
        emergency_contact_phone: application.emergency_contact_phone,
        employer_institution: application.employer_institution,
        job_title: application.job_title,
        additional_notes: application.additional_notes,
        completion_percentage: application.completion_percentage,
        listing_id: application.listing_id,
        owner_id: application.owner_id,
        tenant_id: application.tenant_id,
        viewing_appointment_id: application.viewing_appointment_id
      }
    });
  } catch (err) {
    console.error('Error in get application by viewing:', err);
    if (err.name === 'CastError') {
      return res.status(400).json({ 
        hasApplication: false,
        msg: 'Invalid viewing ID format' 
      });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update/withdraw application (tenant)
router.patch('/:id/withdraw', authMiddleware, async (req, res) => {
  try {
    const { notes } = req.body;
    const application = await RentalApplication.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ msg: 'Application not found' });
    }

    if (application.tenant_id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    if (application.status === 'approved' || application.status === 'rejected') {
      return res.status(400).json({ 
        msg: `Cannot withdraw application with status: ${application.status}` 
      });
    }

    await application.updateStatus('withdrawn', req.userId, notes || 'Application withdrawn');

    const listing = await Listing.findById(application.listing_id);
    const tenant = await User.findById(application.tenant_id);
    
    await Notification.create({
      user_id: application.owner_id,
      listing_id: application.listing_id,
      type: 'application_withdrawn',
      message: `${tenant.name} has withdrawn their application for "${listing.title}"`,
      data: {
        application_id: application._id,
        tenant_name: tenant.name,
        listing_title: listing.title
      }
    });

    res.json({
      msg: 'Application withdrawn successfully',
      application
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ============================================
// OWNER ROUTES
// ============================================

// Send application to tenant (Owner sends application after viewing)
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const owner_id = req.userId;
    const {
      viewing_appointment_id,
      listing_id,
      tenant_id
    } = req.body;

    // Validate required fields
    if (!viewing_appointment_id || !listing_id || !tenant_id) {
      return res.status(400).json({ 
        msg: 'Viewing appointment ID, Listing ID, and Tenant ID are required' 
      });
    }

    // Verify the viewing appointment exists and is completed
    const viewing = await ViewingAppointment.findOne({
      _id: viewing_appointment_id,
      listing_id: listing_id,
      tenant_id: tenant_id,
      owner_id: owner_id,
      status: 'completed'
    });

    if (!viewing) {
      return res.status(400).json({ 
        msg: 'Valid completed viewing appointment is required' 
      });
    }

    // Verify listing exists and belongs to owner
    const listing = await Listing.findById(listing_id);
    if (!listing) {
      return res.status(404).json({ msg: 'Listing not found' });
    }

    if (listing.owner_id.toString() !== owner_id) {
      return res.status(403).json({ msg: 'Not authorized to send applications for this listing' });
    }

    // Check if listing is already rented
    if (listing.status === 'rented') {
      return res.status(400).json({ msg: 'This property is already rented' });
    }

    // Get tenant details
    const tenant = await User.findById(tenant_id);
    if (!tenant) {
      return res.status(404).json({ msg: 'Tenant not found' });
    }

    // Check if tenant already has an application for this listing
    const hasApplied = await RentalApplication.hasApplied(listing_id, tenant_id);
    if (hasApplied) {
      return res.status(400).json({ 
        msg: 'This tenant already has an application for this property' 
      });
    }

    // Create a pending application with tenant details populated
    const application = new RentalApplication({
      listing_id,
      tenant_id,
      owner_id: listing.owner_id,
      viewing_appointment_id: viewing_appointment_id,
      move_in_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      number_of_occupants: 1,
      tenant_type: 'family',
      occupation: 'employed',
      income_range: '20000_40000',
      emergency_contact_name: tenant.name || 'Pending',
      emergency_contact_phone: tenant.phone || 'Pending',
      emergency_contact_relationship: 'Pending',
      preferred_lease_duration: '1_year',
      status: 'pending',
      status_history: [{
        status: 'pending',
        changed_at: new Date(),
        changed_by: owner_id,
        notes: 'Application sent by owner after viewing'
      }],
      submitted_at: new Date()
    });

    // Calculate completion (will be low since required fields are minimal)
    application.calculateCompletion();

    await application.save();

    // Create notification for TENANT
    await Notification.create({
      user_id: tenant_id,
      listing_id: listing._id,
      type: 'application_submitted',
      message: `You have received a rental application for "${listing.title}" from the owner. Please complete the application.`,
      data: {
        application_id: application._id,
        listing_title: listing.title,
        listing_id: listing._id,
        owner_name: listing.owner_name || 'Property Owner',
        owner_id: listing.owner_id,
        viewing_appointment_id: viewing_appointment_id,
        requires_completion: true
      }
    });

    res.status(201).json({
      msg: 'Application sent to tenant successfully',
      application
    });
  } catch (err) {
    console.error('Send application error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get applications for owner
router.get('/owner', authMiddleware, async (req, res) => {
  try {
    const { status, listingId, limit = 50, page = 1 } = req.query;
    const query = { owner_id: req.userId };
    
    if (status) {
      query.status = status;
    }
    
    if (listingId && listingId !== 'undefined' && listingId !== 'null') {
      query.listing_id = listingId;
    }

    const applications = await RentalApplication.find(query)
      .populate('tenant_id', 'name email phone currentLocation')
      .populate('listing_id', 'title monthly_rent_bdt area city')
      .populate('viewing_appointment_id', 'requested_date requested_time status')
      .sort({ submitted_at: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await RentalApplication.countDocuments(query);

    res.json({
      applications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get application statistics for owner
router.get('/owner/stats', authMiddleware, async (req, res) => {
  try {
    const { listingId } = req.query;
    const query = { owner_id: req.userId };
    
    if (listingId && listingId !== 'undefined' && listingId !== 'null') {
      query.listing_id = listingId;
    }

    const stats = await RentalApplication.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const total = await RentalApplication.countDocuments(query);
    const pending = await RentalApplication.countDocuments({ 
      ...query, 
      status: 'pending' 
    });
    const underReview = await RentalApplication.countDocuments({ 
      ...query, 
      status: 'under_review' 
    });
    const approved = await RentalApplication.countDocuments({ 
      ...query, 
      status: 'approved' 
    });
    const rejected = await RentalApplication.countDocuments({ 
      ...query, 
      status: 'rejected' 
    });

    res.json({
      total,
      pending,
      underReview,
      approved,
      rejected,
      byStatus: stats.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {})
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get applications for a specific listing (owner)
router.get('/owner/listing/:listingId', authMiddleware, async (req, res) => {
  try {
    const { listingId } = req.params;
    const { status } = req.query;

    if (!listingId || listingId === 'undefined' || listingId === 'null') {
      return res.status(400).json({ msg: 'Invalid listing ID' });
    }

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ msg: 'Listing not found' });
    }
    
    if (listing.owner_id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const query = { listing_id: listingId, owner_id: req.userId };
    if (status) {
      query.status = status;
    }

    const applications = await RentalApplication.find(query)
      .populate('tenant_id', 'name email phone currentLocation')
      .populate('viewing_appointment_id', 'requested_date requested_time status')
      .sort({ submitted_at: -1 });

    res.json({ applications });
  } catch (err) {
    console.error(err);
    if (err.name === 'CastError') {
      return res.status(400).json({ msg: 'Invalid listing ID format' });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update application status (owner)
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const application = await RentalApplication.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ msg: 'Application not found' });
    }

    if (application.owner_id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    if (!['pending', 'under_review', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }

    const listing = await Listing.findById(application.listing_id);
    if (!listing) {
      return res.status(400).json({ msg: 'Listing no longer exists' });
    }

    // Special handling for approved applications
    if (status === 'approved') {
      // If listing is already rented, don't allow approval
      if (listing.status === 'rented') {
        return res.status(400).json({ 
          msg: 'This property has already been rented' 
        });
      }

      const existingBooking = await Booking.findOne({
        listing: listing._id,
        status: { $in: ['Pending', 'Paid'] },
      });
      if (existingBooking && existingBooking.tenant.toString() !== application.tenant_id.toString()) {
        return res.status(400).json({ msg: 'This property already has an active booking' });
      }

      // Reject all other pending applications for this listing
      const otherApplications = await RentalApplication.find({
        listing_id: application.listing_id,
        _id: { $ne: application._id },
        status: { $in: ['pending', 'under_review'] }
      });

      for (const otherApp of otherApplications) {
        await otherApp.updateStatus('rejected', req.userId, 'Auto-rejected: Another application was accepted');
        
        // Notify other applicants
        await Notification.create({
          user_id: otherApp.tenant_id,
          listing_id: otherApp.listing_id,
          type: 'application_rejected',
          message: `Your application for "${listing.title}" has been automatically rejected as another tenant was approved.`,
          data: {
            application_id: otherApp._id,
            listing_title: listing.title,
            listing_id: listing._id
          }
        });
      }

    }

    await application.updateStatus(status, req.userId, notes || '');

    let booking = null;
    if (status === 'approved') {
      booking = await Booking.findOne({
        listing: listing._id,
        tenant: application.tenant_id,
        status: { $in: ['Pending', 'Paid'] },
      });
      if (!booking) {
        booking = await Booking.create({
          bookingToken: `BK-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
          listing: listing._id,
          tenant: application.tenant_id,
          owner: application.owner_id,
          viewingAppointment: application.viewing_appointment_id,
          amount: Number(listing.advance_bdt || listing.monthly_rent_bdt || 0),
          moveInDate: application.move_in_date,
          leaseDuration: application.preferred_lease_duration,
        });
      }
    }

    // Notify tenant
    const tenant = await User.findById(application.tenant_id);
    
    const notificationType = status === 'approved' ? 'application_approved' : 
                           status === 'rejected' ? 'application_rejected' : 
                           'application_status_updated';

    await Notification.create({
      user_id: application.tenant_id,
      listing_id: application.listing_id,
      type: notificationType,
      message: status === 'approved' 
        ? `Your application for "${listing.title}" has been approved!`
        : status === 'rejected'
        ? `Your application for "${listing.title}" has been rejected`
        : `Your application for "${listing.title}" is now ${status}`,
      data: {
        application_id: application._id,
        status: status,
        notes: notes || '',
        listing_title: listing.title,
        listing_id: listing._id,
        booking_id: booking?._id,
        booking_token: booking?.bookingToken,
      }
    });

    res.json({
      msg: `Application ${status} successfully`,
      application,
      booking
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Add review notes (owner)
router.patch('/:id/review-notes', authMiddleware, async (req, res) => {
  try {
    const { review_notes } = req.body;
    const application = await RentalApplication.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ msg: 'Application not found' });
    }

    if (application.owner_id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    application.review_notes = review_notes;
    await application.save();

    res.json({
      msg: 'Review notes updated',
      application
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ============================================
// APPLICATION COMPARISON ROUTES
// ============================================

// Create a comparison
router.post('/compare', authMiddleware, async (req, res) => {
  try {
    const { listing_id, application_ids, name, notes } = req.body;

    if (!listing_id || !application_ids || application_ids.length < 2) {
      return res.status(400).json({ 
        msg: 'Listing ID and at least 2 application IDs are required' 
      });
    }

    const applications = await RentalApplication.find({
      _id: { $in: application_ids },
      owner_id: req.userId
    });

    if (applications.length !== application_ids.length) {
      return res.status(403).json({ 
        msg: 'You do not have access to all specified applications' 
      });
    }

    let comparison = await ApplicationComparison.findOne({
      owner_id: req.userId,
      listing_id: listing_id,
      application_ids: { $all: application_ids }
    });

    if (comparison) {
      return res.status(400).json({ 
        msg: 'This comparison already exists' 
      });
    }

    comparison = new ApplicationComparison({
      owner_id: req.userId,
      listing_id,
      application_ids,
      name: name || 'Untitled Comparison',
      notes: notes || ''
    });

    await comparison.save();

    res.status(201).json({
      msg: 'Comparison created successfully',
      comparison
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get all comparisons for owner
router.get('/compare', authMiddleware, async (req, res) => {
  try {
    const comparisons = await ApplicationComparison.find({
      owner_id: req.userId
    })
    .populate('listing_id', 'title monthly_rent_bdt area city')
    .populate('application_ids', 'tenant_id status move_in_date number_of_occupants')
    .sort({ updated_at: -1 });

    res.json({ comparisons });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get a specific comparison with full details
router.get('/compare/:id', authMiddleware, async (req, res) => {
  try {
    const comparison = await ApplicationComparison.findOne({
      _id: req.params.id,
      owner_id: req.userId
    });

    if (!comparison) {
      return res.status(404).json({ msg: 'Comparison not found' });
    }

    const applications = await RentalApplication.find({
      _id: { $in: comparison.application_ids },
      owner_id: req.userId
    })
    .populate('tenant_id', 'name email phone currentLocation')
    .populate('listing_id', 'title monthly_rent_bdt area city');

    const listing = await Listing.findById(comparison.listing_id);

    res.json({
      comparison,
      applications,
      listing
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Delete comparison
router.delete('/compare/:id', authMiddleware, async (req, res) => {
  try {
    const comparison = await ApplicationComparison.findOne({
      _id: req.params.id,
      owner_id: req.userId
    });

    if (!comparison) {
      return res.status(404).json({ msg: 'Comparison not found' });
    }

    await comparison.deleteOne();

    res.json({ msg: 'Comparison deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get application details (owner or tenant)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const application = await RentalApplication.findById(req.params.id)
      .populate('tenant_id', 'name email phone currentLocation')
      .populate('owner_id', 'name email phone')
      .populate('listing_id', 'title monthly_rent_bdt area city images description')
      .populate('viewing_appointment_id', 'requested_date requested_time status duration_minutes')
      .populate('status_history.changed_by', 'name email');

    if (!application) {
      return res.status(404).json({ msg: 'Application not found' });
    }

    if (application.tenant_id._id.toString() !== req.userId && 
        application.owner_id._id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    if (application.tenant_id._id.toString() === req.userId) {
      const appObj = application.toObject();
      delete appObj.review_notes;
      delete appObj.rejection_reason;
      return res.json(appObj);
    }

    res.json(application);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;