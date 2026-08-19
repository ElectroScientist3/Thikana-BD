// src/pages/Viewings.jsx
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useViewings } from '../hooks/useViewings';
import { useListings } from '../hooks/useListings';
import { useApplications } from '../hooks/useApplications';
import TenantApplicationForm from '../components/TenantApplicationForm';
import ApplicationStatusBadge from '../components/ApplicationStatusBadge';
import { useAuth } from '../context/AuthContext';

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

// Application Status Labels for display in the status column
const APPLICATION_STATUS_LABELS = {
  'pending': 'Pending Application',
  'under_review': 'Under Review',
  'approved': 'Application Accepted',
  'rejected': 'Application Rejected'
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
  const { role } = useAuth();
  const { listings, loading: listingsLoading, fetchAllListings } = useListings();
  const {
    appointments,
    loading: appointmentsLoading,
    error,
    stats,
    fetchTenantAppointments,
    fetchOwnerAppointments,
    fetchStats,
    fetchCompletedViewings,
    sendApplication,
    requestViewing,
    approveViewing,
    rejectViewing,
    rescheduleViewing,
    acceptReschedule,
    cancelAppointment,
    completeAppointment
  } = useViewings();

  const {
    submitApplication,
    fetchListingApplications,
    updateApplicationStatus,
    getApplicationStatus,
    getApplicationByViewing
  } = useApplications();

  const [userRole, setUserRole] = useState(role || 'tenant');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showTenantApplicationModal, setShowTenantApplicationModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedListingForApplication, setSelectedListingForApplication] = useState(null);
  const [selectedViewingId, setSelectedViewingId] = useState(null);
  const [actionType, setActionType] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  const [tenantApplications, setTenantApplications] = useState([]);
  const [showApplicationDetails, setShowApplicationDetails] = useState(false);
  const [applicationSent, setApplicationSent] = useState(false);
  const [completedViewings, setCompletedViewings] = useState([]);
  const [showCompletedViewings, setShowCompletedViewings] = useState(false);
  // Store application status for each appointment
  const [applicationStatusMap, setApplicationStatusMap] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);

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
    if (role) setUserRole(role);
  }, [role]);

  // Load data when role or status changes
  useEffect(() => {
    loadAllData();
  }, [userRole, selectedStatus]);

  const checkApplicationStatuses = useCallback(async () => {
    // Get fresh appointments data
    const currentAppointments = appointments;
    const statusMap = {};
    
    for (const app of currentAppointments) {
      try {
        const result = await getApplicationByViewing(app._id);
        if (result && result.hasApplication) {
          statusMap[app._id] = result.application.status;
        }
      } catch (err) {
        // Ignore errors
      }
    }
    setApplicationStatusMap(statusMap);
  }, [appointments, getApplicationByViewing]);

  const loadAppointments = async () => {
    if (userRole === 'owner') {
      await fetchOwnerAppointments(selectedStatus);
    } else {
      await fetchTenantAppointments(selectedStatus);
    }
  };

  const loadAllData = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await fetchAllListings();
      await loadAppointments();
      if (userRole === 'owner') {
        await fetchStats();
        await loadCompletedViewings();
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // When appointments change, check their statuses
  useEffect(() => {
    if (userRole === 'tenant' && appointments.length > 0) {
      checkApplicationStatuses();
    }
  }, [appointments, userRole, checkApplicationStatuses]);

  const loadCompletedViewings = async () => {
    try {
      const viewings = await fetchCompletedViewings();
      setCompletedViewings(viewings);
    } catch (err) {
      console.error('Failed to load completed viewings:', err);
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
        await loadAllData();
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
        await loadAllData();
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
        await loadAllData();
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
        await loadAllData();
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
        await loadAllData();
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
        await loadAllData();
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
        setNotificationMessage('Viewing marked as completed. You can now send an application to the tenant.');
        setNotificationType('success');
        setShowActionModal(false);
        await loadAllData();
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

  // Send Application to Tenant (Owner)
  const handleSendApplication = async (viewing) => {
    setLoadingAction(true);
    try {
      // Check if tenant already has an application for this property
      const status = await getApplicationStatus(viewing.listing_id._id);
      if (status && status.hasApplied) {
        alert('This tenant already has an application for this property.');
        setLoadingAction(false);
        return;
      }

      // Send the application using the dedicated endpoint
      const result = await sendApplication(
        viewing._id,
        viewing.listing_id._id,
        viewing.tenant_id._id
      );

      if (result) {
        setApplicationSent(true);
        setNotificationMessage('Application sent to tenant successfully!');
        setNotificationType('success');
        await loadAllData();
        setTimeout(() => {
          setNotificationMessage('');
          setNotificationType('');
          setApplicationSent(false);
        }, 5000);
      }
    } catch (err) {
      setNotificationMessage(err.message || 'Failed to send application');
      setNotificationType('error');
      setTimeout(() => {
        setNotificationMessage('');
        setNotificationType('');
      }, 5000);
    } finally {
      setLoadingAction(false);
    }
  };

  // View Application Details (Owner)
  const handleViewApplication = async (appointment) => {
    try {
      // First check if there's an application linked to this viewing
      const viewingApp = await getApplicationByViewing(appointment._id);
      
      let apps;
      if (viewingApp && viewingApp.hasApplication) {
        apps = [viewingApp.application];
      } else {
        // Fallback: fetch all applications for the listing
        apps = await fetchListingApplications(appointment.listing_id._id);
      }
      
      if (apps && apps.length > 0) {
        setTenantApplications(apps);
        setSelectedAppointment(appointment);
        setShowApplicationDetails(true);
      } else {
        alert('No applications found for this property');
      }
    } catch (err) {
      alert('Failed to load applications');
    }
  };

  // Accept Application (Owner)
  const handleAcceptApplication = async (applicationId) => {
    if (!confirm('Are you sure you want to accept this application? This will reject all other applications for this property.')) {
      return;
    }

    setLoadingAction(true);
    try {
      // Get all applications for this listing
      const apps = await fetchListingApplications(selectedAppointment?.listing_id?._id);
      
      // Reject all other pending applications for this listing
      for (const app of apps) {
        if (app._id !== applicationId && ['pending', 'under_review'].includes(app.status)) {
          await updateApplicationStatus(app._id, 'rejected', 'Auto-rejected: Another application was accepted');
        }
      }

      // Accept the selected application
      await updateApplicationStatus(applicationId, 'approved', 'Application accepted by owner');
      
      setNotificationMessage('Application accepted! Other applications have been rejected.');
      setNotificationType('success');
      setShowApplicationDetails(false);
      await loadAllData();
      setTimeout(() => {
        setNotificationMessage('');
        setNotificationType('');
      }, 5000);
    } catch (err) {
      setNotificationMessage(err.message || 'Failed to accept application');
      setNotificationType('error');
      setTimeout(() => {
        setNotificationMessage('');
        setNotificationType('');
      }, 5000);
    } finally {
      setLoadingAction(false);
    }
  };

  // Reject Application (Owner)
  const handleRejectApplication = async (applicationId) => {
    if (!confirm('Are you sure you want to reject this application?')) {
      return;
    }

    setLoadingAction(true);
    try {
      await updateApplicationStatus(applicationId, 'rejected', 'Application rejected by owner');
      setNotificationMessage('Application rejected.');
      setNotificationType('info');
      setShowApplicationDetails(false);
      await loadAllData();
      setTimeout(() => {
        setNotificationMessage('');
        setNotificationType('');
      }, 5000);
    } catch (err) {
      setNotificationMessage(err.message || 'Failed to reject application');
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
    const label = APPLICATION_STATUS_LABELS[status] || STATUS_LABELS[status] || status;
    const color = STATUS_COLORS[status] || 'bg-gray-100 text-gray-700';
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${color}`}>
        {label}
      </span>
    );
  };

  // Get the status display for the status column
  const getStatusDisplay = (appointment) => {
    // For owner view, show the appointment status
    if (userRole === 'owner') {
      return getStatusBadge(appointment.status);
    }
    
    // For tenant view with completed appointments, check application status
    if (userRole === 'tenant' && appointment.status === 'completed') {
      const appStatus = applicationStatusMap[appointment._id];
      if (appStatus) {
        return getStatusBadge(appStatus);
      }
      // No application yet, show the viewing status
      return getStatusBadge(appointment.status);
    }
    
    // For other statuses, show the appointment status
    return getStatusBadge(appointment.status);
  };

  // Get the action button for tenant - always shows Application button
  const getTenantActionButton = (appointment) => {
    // Only show Application button for completed appointments
    if (appointment.status !== 'completed') {
      return null;
    }
    
    // Always show the Application button - opens the form
    return (
      <button
        onClick={() => {
          setSelectedListingForApplication(appointment.listing_id);
          setSelectedViewingId(appointment._id);
          setShowTenantApplicationModal(true);
        }}
        className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 transition"
      >
        Application
      </button>
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
        case 'completed':
          return (
            <div className="flex gap-2 flex-wrap">
              {appointment.hasApplication ? (
                <>
                  <button
                    onClick={() => handleViewApplication(appointment)}
                    className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700 transition"
                  >
                    View Application
                  </button>
                  <span className="px-2 py-1 text-xs text-slate-500">
                    {appointment.applicationStatus && (
                      <ApplicationStatusBadge status={appointment.applicationStatus} size="sm" />
                    )}
                  </span>
                </>
              ) : (
                <button
                  onClick={() => handleSendApplication(appointment)}
                  disabled={loadingAction || applicationSent}
                  className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 transition disabled:opacity-50"
                >
                  Send Application
                </button>
              )}
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
        case 'completed':
          return getTenantActionButton(appointment);
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
          </div>
        </div>

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
              onClick={loadAllData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Apply Filter
            </button>
            {userRole === 'owner' && (
              <button
                onClick={() => setShowCompletedViewings(!showCompletedViewings)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                {showCompletedViewings ? 'Hide' : 'Show'} Completed Viewings
              </button>
            )}
          </div>
        </div>

        {/* Appointments Table */}
        <div className="p-6 overflow-x-auto">
          {error ? (
            <div className="text-center py-12 text-red-600">
              <p className="text-xl font-semibold">Error loading appointments</p>
              <p className="mt-2">{error}</p>
              <button
                onClick={loadAllData}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Retry
              </button>
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">CAL</div>
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
                      {appointment.listing_id?.monthly_rent_bdt && (
                        <div className="text-xs text-emerald-600 font-semibold">
                          BDT {appointment.listing_id.monthly_rent_bdt.toLocaleString()}
                        </div>
                      )}
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
                          <div className="text-xs text-slate-500">{appointment.owner_id?.phone}</div>
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
                    <td className="px-3 py-3">{getStatusDisplay(appointment)}</td>
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

        {/* Completed Viewings Section (Owner Only) */}
        {userRole === 'owner' && showCompletedViewings && (
          <div className="border-t border-slate-200">
            <div className="p-4 bg-purple-50">
              <h3 className="text-lg font-semibold text-slate-900">Completed Viewings</h3>
              <p className="text-sm text-slate-600">Send applications to tenants who have completed viewings</p>
            </div>
            <div className="p-6 overflow-x-auto">
              {completedViewings.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p>No completed viewings yet</p>
                </div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-slate-600">
                      <th className="px-3 py-3 font-semibold">Property</th>
                      <th className="px-3 py-3 font-semibold">Tenant</th>
                      <th className="px-3 py-3 font-semibold">Completed On</th>
                      <th className="px-3 py-3 font-semibold">Application</th>
                      <th className="px-3 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedViewings.map((viewing) => (
                      <tr key={viewing._id} className="border-t border-slate-200 hover:bg-slate-50 transition">
                        <td className="px-3 py-3">
                          <div className="font-semibold text-slate-900">
                            {viewing.listing_id?.title || 'Unknown'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {viewing.listing_id?.area}, {viewing.listing_id?.city}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium">{viewing.tenant_id?.name}</div>
                          <div className="text-xs text-slate-500">{viewing.tenant_id?.email}</div>
                          <div className="text-xs text-slate-500">{viewing.tenant_id?.phone || 'No phone'}</div>
                        </td>
                        <td className="px-3 py-3">
                          {viewing.completed_at ? formatDateTime(viewing.completed_at) : 'N/A'}
                        </td>
                        <td className="px-3 py-3">
                          {viewing.hasApplication ? (
                            <span className="text-emerald-600 font-medium">
                              <ApplicationStatusBadge status={viewing.applicationStatus} size="sm" />
                            </span>
                          ) : (
                            <span className="text-slate-400">Not sent</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {viewing.hasApplication ? (
                            <button
                              onClick={() => handleViewApplication(viewing)}
                              className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700 transition"
                            >
                              View Application
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSendApplication(viewing)}
                              disabled={loadingAction || applicationSent}
                              className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 transition disabled:opacity-50"
                            >
                              Send Application
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
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
                X
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
                            {typeLabel} - {listing.title} - BDT {listing.monthly_rent_bdt} {statusDisplay}
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

      {/* Application Details Modal (Owner) */}
      {showApplicationDetails && tenantApplications.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-2 border-b border-slate-200">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Applications for Property</h3>
                <p className="text-sm text-slate-500">
                  {tenantApplications[0]?.listing_id?.title || 'Property'}
                </p>
                <p className="text-xs text-slate-400">
                  {tenantApplications.filter(a => ['pending', 'under_review'].includes(a.status)).length} pending applications
                </p>
              </div>
              <button
                onClick={() => setShowApplicationDetails(false)}
                className="text-2xl hover:text-slate-700 p-1"
              >
                X
              </button>
            </div>

            <div className="space-y-4">
              {tenantApplications.map((app) => {
                const isPendingTemplate = app.emergency_contact_name === 'Pending';
                return (
                  <div key={app._id} className={`rounded-xl border-2 p-4 ${
                    app.status === 'approved' ? 'bg-emerald-50 border-emerald-200' :
                    app.status === 'rejected' ? 'bg-red-50 border-red-200' :
                    'bg-white border-slate-200'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-slate-900">
                            {app.tenant_id?.name || 'Unknown Tenant'}
                          </h4>
                          <ApplicationStatusBadge status={app.status} />
                          <span className="text-xs text-slate-500">
                            Submitted: {formatDateTime(app.submitted_at)}
                          </span>
                        </div>

                        {/* Check if application is filled (not just the pending template) */}
                        {!isPendingTemplate ? (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-sm">
                            <div>
                              <span className="text-slate-500">Move-in:</span>
                              <span className="ml-1 font-medium">{formatDate(app.move_in_date)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Occupants:</span>
                              <span className="ml-1 font-medium">{app.number_of_occupants}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Type:</span>
                              <span className="ml-1 font-medium capitalize">{app.tenant_type}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Income:</span>
                              <span className="ml-1 font-medium">{app.income_range}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Occupation:</span>
                              <span className="ml-1 font-medium capitalize">{app.occupation?.replace('_', ' ')}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Lease:</span>
                              <span className="ml-1 font-medium">{app.preferred_lease_duration}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Emergency:</span>
                              <span className="ml-1 font-medium">{app.emergency_contact_name}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Phone:</span>
                              <span className="ml-1 font-medium">{app.emergency_contact_phone}</span>
                            </div>
                            {app.employer_institution && (
                              <div className="col-span-2">
                                <span className="text-slate-500">Employer:</span>
                                <span className="ml-1 font-medium">{app.employer_institution}</span>
                                {app.job_title && <span className="ml-2">({app.job_title})</span>}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-2 p-3 bg-amber-50 rounded-lg text-amber-700 text-sm">
                            Waiting for tenant to complete the application
                          </div>
                        )}

                        {app.additional_notes && (
                          <div className="mt-2 text-sm text-slate-600 bg-white/50 p-2 rounded-lg">
                            {app.additional_notes}
                          </div>
                        )}
                      </div>

                      {['pending', 'under_review'].includes(app.status) && !isPendingTemplate && (
                        <div className="flex flex-col gap-2 ml-4">
                          <button
                            onClick={() => handleAcceptApplication(app._id)}
                            disabled={loadingAction}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition disabled:opacity-50"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleRejectApplication(app._id)}
                            disabled={loadingAction}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {['pending', 'under_review'].includes(app.status) && isPendingTemplate && (
                        <div className="ml-4 text-amber-600 font-medium text-sm bg-amber-50 px-3 py-1 rounded-lg">
                          Pending Completion
                        </div>
                      )}
                      {app.status === 'approved' && (
                        <div className="ml-4 text-emerald-600 font-medium text-sm bg-emerald-50 px-3 py-1 rounded-lg">
                          Approved
                        </div>
                      )}
                      {app.status === 'rejected' && (
                        <div className="ml-4 text-red-600 font-medium text-sm bg-red-50 px-3 py-1 rounded-lg">
                          Rejected
                        </div>
                      )}
                      {app.status === 'withdrawn' && (
                        <div className="ml-4 text-gray-600 font-medium text-sm bg-gray-50 px-3 py-1 rounded-lg">
                          Withdrawn
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowApplicationDetails(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-xl hover:bg-slate-50 transition"
              >
                Close
              </button>
            </div>
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
                X
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

      {/* Tenant Application Form Modal */}
      {showTenantApplicationModal && selectedListingForApplication && (
        <TenantApplicationForm
          isOpen={showTenantApplicationModal}
          onClose={() => {
            setShowTenantApplicationModal(false);
            setSelectedListingForApplication(null);
            setSelectedViewingId(null);
          }}
          listing={selectedListingForApplication}
          viewingAppointmentId={selectedViewingId}
          onSuccess={async () => {
            setShowTenantApplicationModal(false);
            setSelectedListingForApplication(null);
            setSelectedViewingId(null);
            setNotificationMessage('Application submitted successfully! The owner will review it.');
            setNotificationType('success');
            // Refresh all data to update the status map
            await loadAllData();
            setTimeout(() => {
              setNotificationMessage('');
              setNotificationType('');
            }, 5000);
          }}
        />
      )}
    </div>
  );
}

export default Viewings;