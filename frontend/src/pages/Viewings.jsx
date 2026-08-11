// src/pages/Viewings.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useViewings } from '../hooks/useViewings';
import { useListings } from '../hooks/useListings';

const STATUS_COLORS = {
  'pending': 'bg-amber-100 text-amber-700 border-amber-200',
  'approved': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'rejected': 'bg-red-100 text-red-700 border-red-200',
  'cancelled': 'bg-gray-100 text-gray-700 border-gray-200',
  'rescheduled': 'bg-blue-100 text-blue-700 border-blue-200',
  'completed': 'bg-purple-100 text-purple-700 border-purple-200'
};

const STATUS_LABELS = {
  'pending': 'Pending',
  'approved': 'Approved',
  'rejected': 'Rejected',
  'cancelled': 'Cancelled',
  'rescheduled': 'Rescheduled',
  'completed': 'Completed'
};

// Property Type Labels
const PROPERTY_TYPE_LABELS = {
  'apartment': 'Apartment',
  'flat': 'Flat',
  'bachelor_room': 'Bachelor Room',
  'sublet': 'Sublet',
  'shared_room': 'Shared Room',
  'mess_seat': 'Mess Seat',
  'duplex': 'Duplex',
  'penthouse': 'Penthouse',
  'studio': 'Studio',
  'villa': 'Villa',
  'bunglow': 'Bungalow',
  'townhouse': 'Townhouse'
};

function Viewings() {
  const navigate = useNavigate();
  const { listings, loading: listingsLoading, fetchAllListings } = useListings();
  const {
    appointments,
    loading: appointmentsLoading,
    error,
    stats,
    fetchTenantAppointments,
    fetchOwnerAppointments,
    fetchStats,
    requestViewing,
    approveViewing,
    rejectViewing,
    rescheduleViewing,
    acceptReschedule,
    cancelAppointment,
    completeAppointment
  } = useViewings();

  const [userRole, setUserRole] = useState('tenant');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [actionType, setActionType] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);

  // Form states
  const [requestForm, setRequestForm] = useState({
    listing_id: '',
    requested_date: '',
    requested_time: '',
    duration_minutes: 30,
    notes: '',
    tenant_phone: ''
  });

  const [rescheduleForm, setRescheduleForm] = useState({
    suggested_date: '',
    suggested_time: '',
    notes: ''
  });

  const [notesInput, setNotesInput] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('');

  // Get property type display label
  const getPropertyTypeLabel = (type) => {
    return PROPERTY_TYPE_LABELS[type] || type || 'Unknown Type';
  };

  // Check if user has real listings
  const hasRealListings = listings && listings.length > 0;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
  }, [navigate]);

  useEffect(() => {
    // Check user role from localStorage or default to tenant
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    // For demo, we'll default to tenant
    setUserRole('tenant');
  }, []);

  useEffect(() => {
    loadAppointments();
    fetchAllListings();
    if (userRole === 'owner') {
      fetchStats();
    }
  }, [userRole, selectedStatus]);

  const loadAppointments = async () => {
    if (userRole === 'owner') {
      await fetchOwnerAppointments(selectedStatus);
    } else {
      await fetchTenantAppointments(selectedStatus);
    }
  };

  const handleRequestViewing = async (e) => {
    e.preventDefault();
    
    if (!requestForm.listing_id) {
      alert('Please select a property');
      return;
    }

    setLoadingAction(true);
    try {
      const result = await requestViewing(requestForm);
      if (result) {
        setNotificationMessage('Viewing request sent successfully! The owner will review your request.');
        setNotificationType('success');
        setShowRequestModal(false);
        setRequestForm({
          listing_id: '',
          requested_date: '',
          requested_time: '',
          duration_minutes: 30,
          notes: '',
          tenant_phone: ''
        });
        await loadAppointments();
        // Clear notification after 5 seconds
        setTimeout(() => {
          setNotificationMessage('');
          setNotificationType('');
        }, 5000);
      }
    } catch (err) {
      setNotificationMessage(err.message || 'Failed to send viewing request');
      setNotificationType('error');
      setTimeout(() => {
        setNotificationMessage('');
        setNotificationType('');
      }, 5000);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleApprove = async () => {
    setLoadingAction(true);
    try {
      const result = await approveViewing(selectedAppointment._id, notesInput);
      if (result) {
        setNotificationMessage('Viewing approved successfully! Google Calendar event created.');
        setNotificationType('success');
        setShowActionModal(false);
        await loadAppointments();
        if (userRole === 'owner') await fetchStats();
        setTimeout(() => {
          setNotificationMessage('');
          setNotificationType('');
        }, 5000);
      }
    } catch (err) {
      setNotificationMessage(err.message || 'Failed to approve viewing');
      setNotificationType('error');
      setTimeout(() => {
        setNotificationMessage('');
        setNotificationType('');
      }, 5000);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleReject = async () => {
    setLoadingAction(true);
    try {
      const result = await rejectViewing(selectedAppointment._id, notesInput);
      if (result) {
        setNotificationMessage('Viewing request rejected.');
        setNotificationType('info');
        setShowActionModal(false);
        await loadAppointments();
        if (userRole === 'owner') await fetchStats();
        setTimeout(() => {
          setNotificationMessage('');
          setNotificationType('');
        }, 5000);
      }
    } catch (err) {
      setNotificationMessage(err.message || 'Failed to reject viewing');
      setNotificationType('error');
      setTimeout(() => {
        setNotificationMessage('');
        setNotificationType('');
      }, 5000);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleReschedule = async (e) => {
    e.preventDefault();
    setLoadingAction(true);
    try {
      const result = await rescheduleViewing(
        selectedAppointment._id,
        rescheduleForm.suggested_date,
        rescheduleForm.suggested_time,
        rescheduleForm.notes
      );
      if (result) {
        setNotificationMessage('New time suggested successfully! The tenant will be notified.');
        setNotificationType('success');
        setShowActionModal(false);
        setRescheduleForm({ suggested_date: '', suggested_time: '', notes: '' });
        await loadAppointments();
        setTimeout(() => {
          setNotificationMessage('');
          setNotificationType('');
        }, 5000);
      }
    } catch (err) {
      setNotificationMessage(err.message || 'Failed to suggest new time');
      setNotificationType('error');
      setTimeout(() => {
        setNotificationMessage('');
        setNotificationType('');
      }, 5000);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleAcceptReschedule = async () => {
    setLoadingAction(true);
    try {
      const result = await acceptReschedule(selectedAppointment._id);
      if (result) {
        setNotificationMessage('Reschedule accepted! The new time is confirmed.');
        setNotificationType('success');
        setShowActionModal(false);
        await loadAppointments();
        setTimeout(() => {
          setNotificationMessage('');
          setNotificationType('');
        }, 5000);
      }
    } catch (err) {
      setNotificationMessage(err.message || 'Failed to accept reschedule');
      setNotificationType('error');
      setTimeout(() => {
        setNotificationMessage('');
        setNotificationType('');
      }, 5000);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleCancel = async () => {
    setLoadingAction(true);
    try {
      const result = await cancelAppointment(selectedAppointment._id, notesInput);
      if (result) {
        setNotificationMessage('Appointment cancelled successfully.');
        setNotificationType('info');
        setShowActionModal(false);
        await loadAppointments();
        if (userRole === 'owner') await fetchStats();
        setTimeout(() => {
          setNotificationMessage('');
          setNotificationType('');
        }, 5000);
      }
    } catch (err) {
      setNotificationMessage(err.message || 'Failed to cancel appointment');
      setNotificationType('error');
      setTimeout(() => {
        setNotificationMessage('');
        setNotificationType('');
      }, 5000);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleComplete = async () => {
    setLoadingAction(true);
    try {
      const result = await completeAppointment(selectedAppointment._id, notesInput);
      if (result) {
        setNotificationMessage('Viewing marked as completed.');
        setNotificationType('success');
        setShowActionModal(false);
        await loadAppointments();
        if (userRole === 'owner') await fetchStats();
        setTimeout(() => {
          setNotificationMessage('');
          setNotificationType('');
        }, 5000);
      }
    } catch (err) {
      setNotificationMessage(err.message || 'Failed to complete viewing');
      setNotificationType('error');
      setTimeout(() => {
        setNotificationMessage('');
        setNotificationType('');
      }, 5000);
    } finally {
      setLoadingAction(false);
    }
  };

  const openActionModal = (appointment, action) => {
    setSelectedAppointment(appointment);
    setActionType(action);
    setNotesInput('');
    setShowActionModal(true);
  };

  const formatDate = (date) => {
    return date ? new Date(date).toLocaleDateString() : 'N/A';
  };

  const formatDateTime = (date, time) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    const [hours, minutes] = time ? time.split(':').map(Number) : [0, 0];
    d.setHours(hours, minutes, 0, 0);
    return d.toLocaleString();
  };

  const getStatusBadge = (status) => {
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}`}>
        {STATUS_LABELS[status] || status}
      </span>
    );
  };

  const renderActionButtons = (appointment) => {
    const isOwner = userRole === 'owner';
    const isTenant = userRole === 'tenant';

    if (isOwner) {
      switch (appointment.status) {
        case 'pending':
          return (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => openActionModal(appointment, 'approve')}
                className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700 transition"
              >
                Approve
              </button>
              <button
                onClick={() => openActionModal(appointment, 'reject')}
                className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700 transition"
              >
                Reject
              </button>
              <button
                onClick={() => openActionModal(appointment, 'reschedule')}
                className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 transition"
              >
                Reschedule
              </button>
              <button
                onClick={() => openActionModal(appointment, 'cancel')}
                className="px-3 py-1 bg-gray-600 text-white rounded-lg text-xs hover:bg-gray-700 transition"
              >
                Cancel
              </button>
            </div>
          );
        case 'approved':
          return (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => openActionModal(appointment, 'complete')}
                className="px-3 py-1 bg-purple-600 text-white rounded-lg text-xs hover:bg-purple-700 transition"
              >
                Complete
              </button>
              <button
                onClick={() => openActionModal(appointment, 'cancel')}
                className="px-3 py-1 bg-gray-600 text-white rounded-lg text-xs hover:bg-gray-700 transition"
              >
                Cancel
              </button>
            </div>
          );
        case 'rescheduled':
          return (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => openActionModal(appointment, 'cancel')}
                className="px-3 py-1 bg-gray-600 text-white rounded-lg text-xs hover:bg-gray-700 transition"
              >
                Cancel
              </button>
            </div>
          );
        default:
          return null;
      }
    }

    if (isTenant) {
      switch (appointment.status) {
        case 'pending':
          return (
            <button
              onClick={() => openActionModal(appointment, 'cancel')}
              className="px-3 py-1 bg-gray-600 text-white rounded-lg text-xs hover:bg-gray-700 transition"
            >
              Cancel Request
            </button>
          );
        case 'rescheduled':
          return (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => openActionModal(appointment, 'accept-reschedule')}
                className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700 transition"
              >
                Accept New Time
              </button>
              <button
                onClick={() => openActionModal(appointment, 'cancel')}
                className="px-3 py-1 bg-gray-600 text-white rounded-lg text-xs hover:bg-gray-700 transition"
              >
                Cancel
              </button>
            </div>
          );
        case 'approved':
          return (
            <button
              onClick={() => openActionModal(appointment, 'cancel')}
              className="px-3 py-1 bg-gray-600 text-white rounded-lg text-xs hover:bg-gray-700 transition"
            >
              Cancel
            </button>
          );
        default:
          return null;
      }
    }
    return null;
  };

  const isLoading = appointmentsLoading || listingsLoading;

  if (isLoading && appointments.length === 0) {
    return (
      <div className="p-6 md:p-8">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Loading appointments...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Notification Banner */}
      {notificationMessage && (
        <div className={`p-4 rounded-lg ${
          notificationType === 'success' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
          notificationType === 'error' ? 'bg-red-100 text-red-700 border border-red-200' :
          'bg-blue-100 text-blue-700 border border-blue-200'
        }`}>
          {notificationMessage}
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-900 px-6 py-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-blue-100">Property Viewings</div>
              <h1 className="text-3xl font-bold mt-2">Viewing Appointments</h1>
              <p className="mt-1 text-blue-100/80">
                {userRole === 'owner' ? 'Manage viewing requests from tenants' : 'Your property viewing requests'}
              </p>
            </div>
            {userRole === 'tenant' && (
              <button
                onClick={() => setShowRequestModal(true)}
                className="px-6 py-2 bg-blue-600 rounded-xl hover:bg-blue-700 transition"
              >
                + Request Viewing
              </button>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setUserRole(userRole === 'owner' ? 'tenant' : 'owner');
                  setSelectedStatus('');
                }}
                className="px-4 py-2 bg-white/20 rounded-xl text-white hover:bg-white/30 transition text-sm"
              >
                Switch to {userRole === 'owner' ? 'Tenant' : 'Owner'} View
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards (Owner Only) */}
        {userRole === 'owner' && stats && (
          <div className="p-6 grid grid-cols-1 md:grid-cols-5 gap-4 bg-slate-50 border-b border-slate-200">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
              <div className="text-sm text-slate-500">Total</div>
              <div className="text-2xl font-bold text-slate-900">{stats.total || 0}</div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
              <div className="text-sm text-slate-500">Pending</div>
              <div className="text-2xl font-bold text-amber-600">{stats.pending || 0}</div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
              <div className="text-sm text-slate-500">Approved</div>
              <div className="text-2xl font-bold text-emerald-600">{stats.approved || 0}</div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
              <div className="text-sm text-slate-500">Completed</div>
              <div className="text-2xl font-bold text-purple-600">{stats.completed || 0}</div>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm font-medium text-slate-700">Filter by status:</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
              <option value="rescheduled">Rescheduled</option>
              <option value="completed">Completed</option>
            </select>
            <button
              onClick={loadAppointments}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Apply Filter
            </button>
          </div>
        </div>

        {/* Appointments Table */}
        <div className="p-6 overflow-x-auto">
          {error ? (
            <div className="text-center py-12 text-red-600">
              <p className="text-xl font-semibold">Error loading appointments</p>
              <p className="mt-2">{error}</p>
              <button
                onClick={loadAppointments}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Retry
              </button>
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📅</div>
              <h3 className="text-xl font-semibold text-slate-900">No appointments found</h3>
              <p className="text-slate-500 mt-2">
                {userRole === 'owner' 
                  ? 'No viewing requests from tenants yet' 
                  : 'You have not requested any viewings yet'}
              </p>
              {userRole === 'tenant' && (
                <button
                  onClick={() => setShowRequestModal(true)}
                  className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
                >
                  Request a Viewing
                </button>
              )}
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  <th className="px-3 py-3 font-semibold">Property</th>
                  <th className="px-3 py-3 font-semibold">Tenant/Owner</th>
                  <th className="px-3 py-3 font-semibold">Date & Time</th>
                  <th className="px-3 py-3 font-semibold">Duration</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Calendar</th>
                  <th className="px-3 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appointment) => (
                  <tr key={appointment._id} className="border-t border-slate-200 hover:bg-slate-50 transition">
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-900">
                        {appointment.listing_id?.title || 'Unknown'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {appointment.listing_id?.area}, {appointment.listing_id?.city}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {userRole === 'owner' ? (
                        <div>
                          <div className="font-medium">{appointment.tenant_id?.name}</div>
                          <div className="text-xs text-slate-500">{appointment.tenant_id?.email}</div>
                          <div className="text-xs text-slate-500">{appointment.tenant_phone || 'No phone'}</div>
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium">{appointment.owner_id?.name}</div>
                          <div className="text-xs text-slate-500">{appointment.owner_id?.email}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div>{formatDateTime(appointment.requested_date, appointment.requested_time)}</div>
                      {appointment.status === 'rescheduled' && appointment.suggested_date && (
                        <div className="text-xs text-blue-600 mt-1">
                          Suggested: {formatDateTime(appointment.suggested_date, appointment.suggested_time)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">{appointment.duration_minutes || 30} min</td>
                    <td className="px-3 py-3">{getStatusBadge(appointment.status)}</td>
                    <td className="px-3 py-3">
                      {appointment.synced_to_calendar ? (
                        <a
                          href={appointment.google_calendar_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                        >
                          View Event
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">Not synced</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {renderActionButtons(appointment)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Request Viewing Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900">Request a Viewing</h3>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-2xl hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRequestViewing}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Select Property *</label>
                  <select
                    value={requestForm.listing_id}
                    onChange={(e) => setRequestForm({ ...requestForm, listing_id: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select a property</option>
                    {hasRealListings ? (
                      listings.map((listing) => {
                        const typeLabel = getPropertyTypeLabel(listing.property_type);
                        const statusDisplay = listing.status === 'available_now' ? '(Available Now)' : 
                                            listing.status === 'available_from_date' ? '(Available From Date)' : '';
                        return (
                          <option key={listing._id} value={listing._id}>
                            {typeLabel} - {listing.title} - ৳{listing.monthly_rent_bdt} {statusDisplay}
                          </option>
                        );
                      })
                    ) : (
                      <option value="" disabled>No properties available. Please create a property first.</option>
                    )}
                  </select>
                  {!hasRealListings && (
                    <p className="text-xs text-amber-600 mt-1">
                      No properties found. Please create a property in the Properties page first.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={requestForm.requested_date}
                    onChange={(e) => setRequestForm({ ...requestForm, requested_date: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Time *</label>
                  <input
                    type="time"
                    value={requestForm.requested_time}
                    onChange={(e) => setRequestForm({ ...requestForm, requested_time: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Duration (minutes)</label>
                  <select
                    value={requestForm.duration_minutes}
                    onChange={(e) => setRequestForm({ ...requestForm, duration_minutes: Number(e.target.value) })}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                    <option value="120">2 hours</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={requestForm.tenant_phone}
                    onChange={(e) => setRequestForm({ ...requestForm, tenant_phone: e.target.value })}
                    placeholder="017XXXXXXXX"
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                  <textarea
                    value={requestForm.notes}
                    onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
                    placeholder="Any special requests or questions..."
                    rows="3"
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loadingAction || !hasRealListings}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {loadingAction ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Action Modal */}
      {showActionModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900">
                {actionType === 'approve' && 'Approve Viewing'}
                {actionType === 'reject' && 'Reject Viewing'}
                {actionType === 'reschedule' && 'Suggest New Time'}
                {actionType === 'accept-reschedule' && 'Accept Reschedule'}
                {actionType === 'cancel' && 'Cancel Appointment'}
                {actionType === 'complete' && 'Complete Viewing'}
              </h3>
              <button
                onClick={() => setShowActionModal(false)}
                className="text-2xl hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 p-3 bg-slate-50 rounded-xl">
              <div className="text-sm text-slate-600">
                <div><strong>Property:</strong> {selectedAppointment.listing_id?.title}</div>
                <div><strong>Date:</strong> {formatDateTime(selectedAppointment.requested_date, selectedAppointment.requested_time)}</div>
                {userRole === 'owner' && (
                  <div><strong>Tenant:</strong> {selectedAppointment.tenant_id?.name}</div>
                )}
                {userRole === 'tenant' && (
                  <div><strong>Owner:</strong> {selectedAppointment.owner_id?.name}</div>
                )}
                <div><strong>Status:</strong> {getStatusBadge(selectedAppointment.status)}</div>
              </div>
            </div>

            {actionType === 'reschedule' && (
              <form onSubmit={handleReschedule} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">New Date *</label>
                  <input
                    type="date"
                    value={rescheduleForm.suggested_date}
                    onChange={(e) => setRescheduleForm({ ...rescheduleForm, suggested_date: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">New Time *</label>
                  <input
                    type="time"
                    value={rescheduleForm.suggested_time}
                    onChange={(e) => setRescheduleForm({ ...rescheduleForm, suggested_time: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Reason for Reschedule</label>
                  <textarea
                    value={rescheduleForm.notes}
                    onChange={(e) => setRescheduleForm({ ...rescheduleForm, notes: e.target.value })}
                    placeholder="Explain why you are suggesting a new time..."
                    rows="2"
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowActionModal(false)}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-xl hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loadingAction}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {loadingAction ? 'Sending...' : 'Suggest New Time'}
                  </button>
                </div>
              </form>
            )}

            {actionType === 'accept-reschedule' && (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 rounded-xl">
                  <p className="text-sm text-blue-800">
                    The owner has suggested a new time for this viewing.
                  </p>
                  <div className="mt-2 text-sm">
                    <strong>Suggested:</strong> {formatDateTime(selectedAppointment.suggested_date, selectedAppointment.suggested_time)}
                  </div>
                  {selectedAppointment.suggested_notes && (
                    <div className="mt-1 text-sm text-slate-600">
                      <strong>Reason:</strong> {selectedAppointment.suggested_notes}
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowActionModal(false)}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-xl hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAcceptReschedule}
                    disabled={loadingAction}
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    {loadingAction ? 'Accepting...' : 'Accept New Time'}
                  </button>
                </div>
              </div>
            )}

            {(actionType === 'approve' || actionType === 'reject' || actionType === 'cancel' || actionType === 'complete') && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
                  <textarea
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder={
                      actionType === 'approve' ? 'Add any instructions for the tenant...' :
                      actionType === 'reject' ? 'Provide a reason for rejection...' :
                      actionType === 'cancel' ? 'Provide a reason for cancellation...' :
                      'Add any notes about the viewing...'
                    }
                    rows="3"
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowActionModal(false)}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-xl hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={
                      actionType === 'approve' ? handleApprove :
                      actionType === 'reject' ? handleReject :
                      actionType === 'cancel' ? handleCancel :
                      handleComplete
                    }
                    disabled={loadingAction}
                    className={`flex-1 px-4 py-2 text-white rounded-xl transition disabled:opacity-50 ${
                      actionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' :
                      actionType === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                      actionType === 'complete' ? 'bg-purple-600 hover:bg-purple-700' :
                      'bg-gray-600 hover:bg-gray-700'
                    }`}
                  >
                    {loadingAction ? 'Processing...' : 
                      actionType === 'approve' ? 'Approve' :
                      actionType === 'reject' ? 'Reject' :
                      actionType === 'complete' ? 'Complete' :
                      'Cancel'
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Viewings;