// routes/viewings.js
const express = require('express');
const router = express.Router();
const ViewingAppointment = require('../models/ViewingAppointment');
const Listing = require('../models/Listing');
const User = require('../models/User');
const Notification = require('../models/Notification');
const RentalApplication = require('../models/RentalApplication');
const Booking = require('../models/Booking');
const crypto = require('crypto');
const { authMiddleware } = require('../middleware/auth');
const googleCalendarService = require('../services/googleCalendar');

// ============================================
// TENANT ROUTES
// ============================================

// Request a viewing (tenant)
router.post('/request', authMiddleware, async (req, res) => {
  try {
    const { listing_id, requested_date, requested_time, duration_minutes, notes, tenant_phone } = req.body;
    const tenant_id = req.userId;

    // Validate required fields
    if (!listing_id || !requested_date || !requested_time) {
      return res.status(400).json({ 
        msg: 'Listing ID, date, and time are required' 
      });
    }

    // Verify listing exists and get owner
    const listing = await Listing.findById(listing_id);
    if (!listing) {
      return res.status(404).json({ msg: 'Listing not found' });
    }

    // Check if listing is available
    if (!listing.isVisibleToTenant()) {
      return res.status(400).json({ msg: 'This listing is not available for viewing' });
    }

    // Check for duplicate pending appointments
    const existingAppointment = await ViewingAppointment.findOne({
      listing_id,
      tenant_id,
      status: { $in: ['pending', 'approved', 'rescheduled'] }
    });

    if (existingAppointment) {
      return res.status(400).json({ 
        msg: 'You already have a pending or approved appointment for this property' 
      });
    }

    // Get tenant details
    const tenant = await User.findById(tenant_id);
    if (!tenant) {
      return res.status(404).json({ msg: 'Tenant not found' });
    }

    // Create appointment
    const appointment = new ViewingAppointment({
      listing_id,
      tenant_id,
      owner_id: listing.owner_id,
      requested_date: new Date(requested_date),
      requested_time,
      duration_minutes: duration_minutes || 30,
      notes: notes || '',
      tenant_phone: tenant_phone || tenant.phone,
      tenant_email: tenant.email,
      status: 'pending',
      status_history: [{
        status: 'pending',
        changed_at: new Date(),
        changed_by: tenant_id,
        notes: 'Viewing requested'
      }]
    });

    await appointment.save();

    // Create notification for OWNER
    await Notification.create({
      user_id: listing.owner_id,
      listing_id: listing._id,
      type: 'viewing_requested',
      message: `New viewing request from ${tenant.name} for "${listing.title}"`,
      data: {
        appointment_id: appointment._id,
        tenant_name: tenant.name,
        tenant_email: tenant.email,
        tenant_phone: tenant_phone || tenant.phone,
        requested_date: requested_date,
        requested_time: requested_time,
        listing_title: listing.title,
        listing_id: listing._id,
        owner_id: listing.owner_id,
        owner_name: listing.owner_name || 'Property Owner',
        owner_email: listing.owner_email || '',
        appointment: {
          id: appointment._id,
          status: appointment.status,
          duration_minutes: appointment.duration_minutes
        }
      }
    });

    res.status(201).json({
      msg: 'Viewing request sent successfully. The owner has been notified.',
      appointment
    });
  } catch (err) {
    console.error('Viewing request error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get tenant's appointments
router.get('/tenant', authMiddleware, async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    const query = { tenant_id: req.userId };
    
    if (status) {
      query.status = status;
    }

    const appointments = await ViewingAppointment.find(query)
      .populate('listing_id', 'title area city monthly_rent_bdt images owner_name owner_email')
      .populate('owner_id', 'name email phone')
      .sort({ requested_date: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await ViewingAppointment.countDocuments(query);

    // For each appointment, check if there's a pending application
    const appointmentsWithApplication = await Promise.all(appointments.map(async (app) => {
      const appObj = app.toObject();
      try {
        // Check if tenant has an application for this listing
        const existingApplication = await RentalApplication.findOne({
          listing_id: app.listing_id._id,
          tenant_id: req.userId,
          status: { $in: ['pending', 'under_review'] }
        });
        
        if (existingApplication) {
          appObj.hasPendingApplication = true;
          appObj.applicationId = existingApplication._id;
          appObj.applicationStatus = existingApplication.status;
        } else {
          appObj.hasPendingApplication = false;
        }
      } catch (err) {
        console.error('Error checking application for appointment:', err);
        appObj.hasPendingApplication = false;
        appObj.applicationError = true;
      }
      
      return appObj;
    }));

    res.json({
      appointments: appointmentsWithApplication,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Error in GET /tenant:', err);
    res.status(500).json({ msg: 'Server error: ' + err.message });
  }
});

// ============================================
// OWNER ROUTES
// ============================================

// Get owner's appointments
router.get('/owner', authMiddleware, async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    const query = { owner_id: req.userId };
    
    if (status) {
      query.status = status;
    }

    const appointments = await ViewingAppointment.find(query)
      .populate('listing_id', 'title area city monthly_rent_bdt images owner_name owner_email')
      .populate('tenant_id', 'name email phone')
      .sort({ requested_date: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await ViewingAppointment.countDocuments(query);

    // For each appointment, check if there's an application
    const appointmentsWithApplication = await Promise.all(appointments.map(async (app) => {
      const appObj = app.toObject();
      
      try {
        // Check if there's an application for this tenant and listing
        const existingApplication = await RentalApplication.findOne({
          listing_id: app.listing_id._id,
          tenant_id: app.tenant_id._id
        });
        
        if (existingApplication) {
          appObj.hasApplication = true;
          appObj.applicationId = existingApplication._id;
          appObj.applicationStatus = existingApplication.status;
          appObj.applicationSubmittedAt = existingApplication.submitted_at;
        } else {
          appObj.hasApplication = false;
        }
        
        // Check if there are other applications for this listing
        const otherApplications = await RentalApplication.find({
          listing_id: app.listing_id._id,
          status: { $in: ['pending', 'under_review', 'approved'] }
        }).populate('tenant_id', 'name email phone');
        
        appObj.otherApplications = otherApplications.filter(a => 
          a.tenant_id._id.toString() !== app.tenant_id._id.toString()
        );
      } catch (err) {
        console.error('Error checking applications for appointment:', err);
        appObj.hasApplication = false;
        appObj.applicationError = true;
      }
      
      return appObj;
    }));

    res.json({
      appointments: appointmentsWithApplication,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Error in GET /owner:', err);
    res.status(500).json({ msg: 'Server error: ' + err.message });
  }
});

// Get appointment statistics for owner
router.get('/owner/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await ViewingAppointment.aggregate([
      { $match: { owner_id: req.userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const total = await ViewingAppointment.countDocuments({ owner_id: req.userId });
    const pending = await ViewingAppointment.countDocuments({ 
      owner_id: req.userId, 
      status: 'pending' 
    });
    const approved = await ViewingAppointment.countDocuments({ 
      owner_id: req.userId, 
      status: 'approved' 
    });
    const completed = await ViewingAppointment.countDocuments({ 
      owner_id: req.userId, 
      status: 'completed' 
    });

    res.json({
      total,
      pending,
      approved,
      completed,
      byStatus: stats.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {})
    });
  } catch (err) {
    console.error('Error in GET /owner/stats:', err);
    res.status(500).json({ msg: 'Server error: ' + err.message });
  }
});

// Get completed viewings for owner (for sending applications)
router.get('/owner/completed', authMiddleware, async (req, res) => {
  try {
    const { listingId } = req.query;
    const query = { 
      owner_id: req.userId, 
      status: 'completed' 
    };
    
    if (listingId && listingId !== 'undefined' && listingId !== 'null') {
      query.listing_id = listingId;
    }

    const completedViewings = await ViewingAppointment.find(query)
      .populate('listing_id', 'title area city monthly_rent_bdt images owner_name owner_email status')
      .populate('tenant_id', 'name email phone currentLocation')
      .sort({ completed_at: -1 });

    // Filter out tenants who already have an application
    const viewingsWithApplicationStatus = await Promise.all(completedViewings.map(async (viewing) => {
      const viewingObj = viewing.toObject();
      
      try {
        const existingApplication = await RentalApplication.findOne({
          listing_id: viewing.listing_id._id,
          tenant_id: viewing.tenant_id._id,
          status: { $in: ['pending', 'under_review', 'approved'] }
        });
        
        viewingObj.hasApplication = !!existingApplication;
        viewingObj.applicationId = existingApplication?._id || null;
        viewingObj.applicationStatus = existingApplication?.status || null;
      } catch (err) {
        console.error('Error checking application for completed viewing:', err);
        viewingObj.hasApplication = false;
        viewingObj.applicationError = true;
      }
      
      return viewingObj;
    }));

    res.json({
      completedViewings: viewingsWithApplicationStatus
    });
  } catch (err) {
    console.error('Error in GET /owner/completed:', err);
    res.status(500).json({ msg: 'Server error: ' + err.message });
  }
});

// Get completed viewings for a specific listing
router.get('/owner/completed/:listingId', authMiddleware, async (req, res) => {
  try {
    const { listingId } = req.params;
    
    // Verify ownership
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ msg: 'Listing not found' });
    }
    
    if (listing.owner_id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const completedViewings = await ViewingAppointment.find({
      owner_id: req.userId,
      listing_id: listingId,
      status: 'completed'
    }).populate('tenant_id', 'name email phone currentLocation');

    // Filter out tenants who already have an application
    const viewingsWithApplicationStatus = await Promise.all(completedViewings.map(async (viewing) => {
      const viewingObj = viewing.toObject();
      
      try {
        const existingApplication = await RentalApplication.findOne({
          listing_id: listingId,
          tenant_id: viewing.tenant_id._id,
          status: { $in: ['pending', 'under_review', 'approved'] }
        });
        
        viewingObj.hasApplication = !!existingApplication;
        viewingObj.applicationId = existingApplication?._id || null;
        viewingObj.applicationStatus = existingApplication?.status || null;
      } catch (err) {
        console.error('Error checking application for completed viewing:', err);
        viewingObj.hasApplication = false;
        viewingObj.applicationError = true;
      }
      
      return viewingObj;
    }));

    res.json({
      completedViewings: viewingsWithApplicationStatus
    });
  } catch (err) {
    console.error('Error in GET /owner/completed/:listingId:', err);
    if (err.name === 'CastError') {
      return res.status(400).json({ msg: 'Invalid listing ID format' });
    }
    res.status(500).json({ msg: 'Server error: ' + err.message });
  }
});

// Approve viewing (owner)
router.patch('/:id/approve', authMiddleware, async (req, res) => {
  try {
    const { notes } = req.body;
    const appointment = await ViewingAppointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ msg: 'Appointment not found' });
    }

    if (appointment.owner_id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized to approve this appointment' });
    }

    if (appointment.status !== 'pending') {
      return res.status(400).json({ 
        msg: `Cannot approve appointment with status: ${appointment.status}` 
      });
    }

    const listing = await Listing.findById(appointment.listing_id);
    if (!listing) return res.status(404).json({ msg: 'Listing not found' });
    if (listing.status === 'rented') {
      return res.status(409).json({ msg: 'This property has already been rented' });
    }

    const tenant = await User.findById(appointment.tenant_id);
    const owner = await User.findById(appointment.owner_id);

    let booking = await Booking.findOne({ viewingAppointment: appointment._id });
    if (!booking) {
      const activeBooking = await Booking.findOne({
        listing: listing._id,
        status: { $in: ['Pending', 'Paid'] },
      });
      if (activeBooking) {
        return res.status(409).json({ msg: 'This property already has an active booking' });
      }
      booking = await Booking.create({
        bookingToken: `BK-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
        listing: listing._id,
        tenant: appointment.tenant_id,
        owner: appointment.owner_id,
        viewingAppointment: appointment._id,
        amount: Number(listing.advance_bdt || listing.monthly_rent_bdt || 0),
        moveInDate: listing.available_from && listing.available_from > new Date() ? listing.available_from : new Date(),
        leaseDuration: '1_year',
      });
    }
    await appointment.updateStatus('approved', req.userId, notes || 'Appointment approved');


    // Sync with Google Calendar
    let calendarEvent = null;
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN) {
      try {
        calendarEvent = await googleCalendarService.createEvent(
          appointment,
          listing,
          tenant,
          owner
        );

        if (calendarEvent) {
          appointment.google_calendar_event_id = calendarEvent.eventId;
          appointment.google_calendar_link = calendarEvent.htmlLink;
          appointment.synced_to_calendar = true;
          appointment.calendar_sync_date = new Date();
          await appointment.save();
        }
      } catch (error) {
        console.error('Failed to sync with Google Calendar:', error);
      }
    }

    // Create notification for TENANT
    await Notification.create({
      user_id: appointment.tenant_id,
      listing_id: appointment.listing_id,
      type: 'viewing_approved',
      message: `Your viewing request for "${listing.title}" has been approved by the owner`,
      data: {
        appointment_id: appointment._id,
        requested_date: appointment.requested_date,
        requested_time: appointment.requested_time,
        calendar_link: appointment.google_calendar_link,
        listing_title: listing.title,
        owner_name: owner.name || listing.owner_name || 'Property Owner',
        owner_email: owner.email || listing.owner_email || '',
        approved_by: req.userId,
        approved_at: new Date()
        ,booking_id: booking._id
        ,booking_token: booking.bookingToken
      }
    });

    res.json({
      msg: 'Appointment approved successfully',
      appointment,
      booking,
      calendar_event: calendarEvent
    });
  } catch (err) {
    console.error('Error in PATCH /:id/approve:', err);
    res.status(500).json({ msg: 'Server error: ' + err.message });
  }
});

// Reject viewing (owner)
router.patch('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const { notes } = req.body;
    const appointment = await ViewingAppointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ msg: 'Appointment not found' });
    }

    if (appointment.owner_id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized to reject this appointment' });
    }

    if (appointment.status !== 'pending') {
      return res.status(400).json({ 
        msg: `Cannot reject appointment with status: ${appointment.status}` 
      });
    }

    await appointment.updateStatus('rejected', req.userId, notes || 'Appointment rejected');

    const listing = await Listing.findById(appointment.listing_id);
    const owner = await User.findById(appointment.owner_id);

    // Create notification for TENANT
    await Notification.create({
      user_id: appointment.tenant_id,
      listing_id: appointment.listing_id,
      type: 'viewing_rejected',
      message: `Your viewing request for "${listing.title}" has been rejected by the owner`,
      data: {
        appointment_id: appointment._id,
        reason: notes || 'No reason provided',
        listing_title: listing.title,
        owner_name: owner.name || listing.owner_name || 'Property Owner',
        rejected_by: req.userId,
        rejected_at: new Date()
      }
    });

    res.json({
      msg: 'Appointment rejected',
      appointment
    });
  } catch (err) {
    console.error('Error in PATCH /:id/reject:', err);
    res.status(500).json({ msg: 'Server error: ' + err.message });
  }
});

// Suggest new time (owner)
router.patch('/:id/reschedule', authMiddleware, async (req, res) => {
  try {
    const { suggested_date, suggested_time, notes } = req.body;
    const appointment = await ViewingAppointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ msg: 'Appointment not found' });
    }

    if (appointment.owner_id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized to reschedule this appointment' });
    }

    if (appointment.status !== 'pending' && appointment.status !== 'approved') {
      return res.status(400).json({ 
        msg: `Cannot reschedule appointment with status: ${appointment.status}` 
      });
    }

    if (!suggested_date || !suggested_time) {
      return res.status(400).json({ 
        msg: 'Suggested date and time are required' 
      });
    }

    await appointment.reschedule(suggested_date, suggested_time, notes, req.userId);

    const listing = await Listing.findById(appointment.listing_id);
    const owner = await User.findById(appointment.owner_id);

    // Create notification for TENANT
    await Notification.create({
      user_id: appointment.tenant_id,
      listing_id: appointment.listing_id,
      type: 'viewing_rescheduled',
      message: `The owner has suggested a new viewing time for "${listing.title}"`,
      data: {
        appointment_id: appointment._id,
        suggested_date,
        suggested_time,
        notes,
        listing_title: listing.title,
        owner_name: owner.name || listing.owner_name || 'Property Owner',
        rescheduled_by: req.userId,
        rescheduled_at: new Date()
      }
    });

    res.json({
      msg: 'Reschedule suggested successfully',
      appointment
    });
  } catch (err) {
    console.error('Error in PATCH /:id/reschedule:', err);
    res.status(500).json({ msg: 'Server error: ' + err.message });
  }
});

// ============================================
// TENANT & OWNER ROUTES
// ============================================

// Get appointment by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const appointment = await ViewingAppointment.findById(req.params.id)
      .populate('listing_id', 'title area city monthly_rent_bdt images description owner_name owner_email')
      .populate('tenant_id', 'name email phone')
      .populate('owner_id', 'name email phone')
      .populate('status_history.changed_by', 'name email');

    if (!appointment) {
      return res.status(404).json({ msg: 'Appointment not found' });
    }

    if (appointment.tenant_id._id.toString() !== req.userId && 
        appointment.owner_id._id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized to view this appointment' });
    }

    res.json(appointment);
  } catch (err) {
    console.error('Error in GET /:id:', err);
    res.status(500).json({ msg: 'Server error: ' + err.message });
  }
});

// Accept reschedule (tenant)
router.patch('/:id/accept-reschedule', authMiddleware, async (req, res) => {
  try {
    const appointment = await ViewingAppointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ msg: 'Appointment not found' });
    }

    if (appointment.tenant_id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized to accept this reschedule' });
    }

    if (appointment.status !== 'rescheduled') {
      return res.status(400).json({ msg: 'No pending reschedule to accept' });
    }

    await appointment.acceptReschedule(req.userId);

    const listing = await Listing.findById(appointment.listing_id);
    const tenant = await User.findById(appointment.tenant_id);

    // Update Google Calendar event if it exists
    if (appointment.google_calendar_event_id) {
      try {
        const owner = await User.findById(appointment.owner_id);
        await googleCalendarService.updateEvent(
          appointment.google_calendar_event_id,
          appointment,
          listing,
          tenant,
          owner
        );
      } catch (error) {
        console.error('Failed to update Google Calendar event:', error);
      }
    }

    // Create notification for OWNER
    await Notification.create({
      user_id: appointment.owner_id,
      listing_id: appointment.listing_id,
      type: 'reschedule_accepted',
      message: `${tenant.name} accepted the new viewing time for "${listing.title}"`,
      data: {
        appointment_id: appointment._id,
        listing_title: listing.title,
        tenant_name: tenant.name,
        tenant_email: tenant.email,
        accepted_by: req.userId,
        accepted_at: new Date()
      }
    });

    res.json({
      msg: 'Reschedule accepted successfully',
      appointment
    });
  } catch (err) {
    console.error('Error in PATCH /:id/accept-reschedule:', err);
    res.status(500).json({ msg: 'Server error: ' + err.message });
  }
});

// Cancel appointment (tenant or owner)
router.patch('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const { notes } = req.body;
    const appointment = await ViewingAppointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ msg: 'Appointment not found' });
    }

    if (appointment.tenant_id.toString() !== req.userId && 
        appointment.owner_id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized to cancel this appointment' });
    }

    if (appointment.status === 'completed' || appointment.status === 'cancelled') {
      return res.status(400).json({ msg: 'Cannot cancel a completed or already cancelled appointment' });
    }

    const cancelledBy = appointment.tenant_id.toString() === req.userId ? 'tenant' : 'owner';
    await appointment.updateStatus('cancelled', req.userId, notes || 'Appointment cancelled');

    // Delete Google Calendar event if it exists
    if (appointment.google_calendar_event_id) {
      try {
        await googleCalendarService.deleteEvent(appointment.google_calendar_event_id);
      } catch (error) {
        console.error('Failed to delete Google Calendar event:', error);
      }
    }

    const notifyUserId = appointment.tenant_id.toString() === req.userId 
      ? appointment.owner_id 
      : appointment.tenant_id;

    const listing = await Listing.findById(appointment.listing_id);
    const canceller = await User.findById(req.userId);

    await Notification.create({
      user_id: notifyUserId,
      listing_id: appointment.listing_id,
      type: 'viewing_cancelled',
      message: `Viewing appointment for "${listing.title}" has been cancelled by ${canceller.name || 'the ' + cancelledBy}`,
      data: {
        appointment_id: appointment._id,
        cancelled_by: req.userId,
        cancelled_by_name: canceller.name || cancelledBy,
        cancelled_by_role: cancelledBy,
        reason: notes || 'No reason provided',
        listing_title: listing.title
      }
    });

    res.json({
      msg: 'Appointment cancelled successfully',
      appointment
    });
  } catch (err) {
    console.error('Error in PATCH /:id/cancel:', err);
    res.status(500).json({ msg: 'Server error: ' + err.message });
  }
});

// Mark appointment as completed (owner)
router.patch('/:id/complete', authMiddleware, async (req, res) => {
  try {
    const { notes } = req.body;
    const appointment = await ViewingAppointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ msg: 'Appointment not found' });
    }

    if (appointment.owner_id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized to complete this appointment' });
    }

    if (appointment.status !== 'approved') {
      return res.status(400).json({ msg: 'Only approved appointments can be marked as completed' });
    }

    await appointment.updateStatus('completed', req.userId, notes || 'Viewing completed');

    // Create notification for TENANT
    const listing = await Listing.findById(appointment.listing_id);
    await Notification.create({
      user_id: appointment.tenant_id,
      listing_id: appointment.listing_id,
      type: 'viewing_completed',
      message: `Viewing for "${listing.title}" has been marked as completed by the owner`,
      data: {
        appointment_id: appointment._id,
        listing_title: listing.title,
        completed_by: req.userId,
        completed_at: new Date()
      }
    });

    res.json({
      msg: 'Appointment marked as completed',
      appointment
    });
  } catch (err) {
    console.error('Error in PATCH /:id/complete:', err);
    res.status(500).json({ msg: 'Server error: ' + err.message });
  }
});

module.exports = router;