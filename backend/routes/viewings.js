// routes/viewings.js
const express = require('express');
const router = express.Router();
const ViewingAppointment = require('../models/ViewingAppointment');
const Listing = require('../models/Listing');
const User = require('../models/User');
const Notification = require('../models/Notification');
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

    // Create notification for owner
    await Notification.create({
      user_id: listing.owner_id,
      listing_id: listing._id,
      type: 'viewing_requested',
      message: `📅 New viewing request from ${tenant.name} for "${listing.title}"`,
      data: {
        appointment_id: appointment._id,
        tenant_name: tenant.name,
        tenant_email: tenant.email,
        requested_date: requested_date,
        requested_time: requested_time,
        listing_title: listing.title
      }
    });

    res.status(201).json({
      msg: 'Viewing request sent successfully',
      appointment
    });
  } catch (err) {
    console.error(err);
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
      .populate('listing_id', 'title area city monthly_rent_bdt images')
      .populate('owner_id', 'name email phone')
      .sort({ requested_date: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await ViewingAppointment.countDocuments(query);

    res.json({
      appointments,
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
      .populate('listing_id', 'title area city monthly_rent_bdt images')
      .populate('tenant_id', 'name email phone')
      .sort({ requested_date: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await ViewingAppointment.countDocuments(query);

    res.json({
      appointments,
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
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
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

    // Update status
    await appointment.updateStatus('approved', req.userId, notes || 'Appointment approved');

    // Get related data
    const listing = await Listing.findById(appointment.listing_id);
    const tenant = await User.findById(appointment.tenant_id);
    const owner = await User.findById(appointment.owner_id);

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
        // Don't fail the approval, just log the error
      }
    }

    // Create notification for tenant
    await Notification.create({
      user_id: appointment.tenant_id,
      listing_id: appointment.listing_id,
      type: 'viewing_approved',
      message: `✅ Viewing request for "${listing.title}" has been approved`,
      data: {
        appointment_id: appointment._id,
        requested_date: appointment.requested_date,
        requested_time: appointment.requested_time,
        calendar_link: appointment.google_calendar_link,
        listing_title: listing.title
      }
    });

    res.json({
      msg: 'Appointment approved successfully',
      appointment,
      calendar_event: calendarEvent
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
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

    await Notification.create({
      user_id: appointment.tenant_id,
      listing_id: appointment.listing_id,
      type: 'viewing_rejected',
      message: `❌ Viewing request for "${listing.title}" has been rejected`,
      data: {
        appointment_id: appointment._id,
        reason: notes || 'No reason provided',
        listing_title: listing.title
      }
    });

    res.json({
      msg: 'Appointment rejected',
      appointment
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
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

    await Notification.create({
      user_id: appointment.tenant_id,
      listing_id: appointment.listing_id,
      type: 'viewing_rescheduled',
      message: `🔄 New viewing time suggested for "${listing.title}"`,
      data: {
        appointment_id: appointment._id,
        suggested_date,
        suggested_time,
        notes,
        listing_title: listing.title
      }
    });

    res.json({
      msg: 'Reschedule suggested successfully',
      appointment
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ============================================
// TENANT & OWNER ROUTES
// ============================================

// Get appointment by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const appointment = await ViewingAppointment.findById(req.params.id)
      .populate('listing_id', 'title area city monthly_rent_bdt images description')
      .populate('tenant_id', 'name email phone')
      .populate('owner_id', 'name email phone')
      .populate('status_history.changed_by', 'name email');

    if (!appointment) {
      return res.status(404).json({ msg: 'Appointment not found' });
    }

    // Check if user is authorized to view this appointment
    if (appointment.tenant_id._id.toString() !== req.userId && 
        appointment.owner_id._id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized to view this appointment' });
    }

    res.json(appointment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
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

    // Update with suggested time
    appointment.requested_date = appointment.suggested_date;
    appointment.requested_time = appointment.suggested_time;
    appointment.status = 'approved';
    appointment.suggested_date = undefined;
    appointment.suggested_time = undefined;
    appointment.suggested_notes = undefined;

    appointment.status_history.push({
      status: 'approved',
      changed_at: new Date(),
      changed_by: req.userId,
      notes: 'Accepted reschedule suggestion'
    });

    await appointment.save();

    const listing = await Listing.findById(appointment.listing_id);
    const tenant = await User.findById(appointment.tenant_id);
    const owner = await User.findById(appointment.owner_id);

    // Update Google Calendar event if it exists
    if (appointment.google_calendar_event_id) {
      try {
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

    await Notification.create({
      user_id: appointment.owner_id,
      listing_id: appointment.listing_id,
      type: 'reschedule_accepted',
      message: `✅ ${tenant.name} accepted the new viewing time for "${listing.title}"`,
      data: {
        appointment_id: appointment._id,
        listing_title: listing.title
      }
    });

    res.json({
      msg: 'Reschedule accepted successfully',
      appointment
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
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

    // Check if user is authorized (either tenant or owner can cancel)
    if (appointment.tenant_id.toString() !== req.userId && 
        appointment.owner_id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized to cancel this appointment' });
    }

    if (appointment.status === 'completed' || appointment.status === 'cancelled') {
      return res.status(400).json({ msg: 'Cannot cancel a completed or already cancelled appointment' });
    }

    await appointment.updateStatus('cancelled', req.userId, notes || 'Appointment cancelled');

    // Delete Google Calendar event if it exists
    if (appointment.google_calendar_event_id) {
      try {
        await googleCalendarService.deleteEvent(appointment.google_calendar_event_id);
      } catch (error) {
        console.error('Failed to delete Google Calendar event:', error);
      }
    }

    // Notify the other party
    const notifyUserId = appointment.tenant_id.toString() === req.userId 
      ? appointment.owner_id 
      : appointment.tenant_id;

    const listing = await Listing.findById(appointment.listing_id);

    await Notification.create({
      user_id: notifyUserId,
      listing_id: appointment.listing_id,
      type: 'viewing_cancelled',
      message: `❌ Viewing appointment for "${listing.title}" has been cancelled`,
      data: {
        appointment_id: appointment._id,
        cancelled_by: req.userId,
        reason: notes || 'No reason provided',
        listing_title: listing.title
      }
    });

    res.json({
      msg: 'Appointment cancelled successfully',
      appointment
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
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

    res.json({
      msg: 'Appointment marked as completed',
      appointment
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;