// src/hooks/useViewings.js
import { useState, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function useViewings() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });

  const getToken = () => localStorage.getItem('token');

  // Get tenant's appointments
  const fetchTenantAppointments = useCallback(async (status = '', page = 1, limit = 50) => {
    const token = getToken();
    if (!token) {
      setError('Authentication required');
      return;
    }

    try {
      setLoading(true);
      const query = new URLSearchParams({ page, limit });
      if (status) query.append('status', status);
      
      const response = await fetch(`${API_BASE}/api/viewings/tenant?${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        throw new Error('Session expired');
      }

      const data = await response.json();
      if (response.ok) {
        setAppointments(data.appointments || []);
        setPagination(data.pagination || { page, limit, total: 0, totalPages: 0 });
        setError(null);
      } else {
        throw new Error(data.msg || 'Failed to load appointments');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get owner's appointments
  const fetchOwnerAppointments = useCallback(async (status = '', page = 1, limit = 50) => {
    const token = getToken();
    if (!token) {
      setError('Authentication required');
      return;
    }

    try {
      setLoading(true);
      const query = new URLSearchParams({ page, limit });
      if (status) query.append('status', status);
      
      const response = await fetch(`${API_BASE}/api/viewings/owner?${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        throw new Error('Session expired');
      }

      const data = await response.json();
      if (response.ok) {
        setAppointments(data.appointments || []);
        setPagination(data.pagination || { page, limit, total: 0, totalPages: 0 });
        setError(null);
      } else {
        throw new Error(data.msg || 'Failed to load appointments');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get appointment stats (owner only)
  const fetchStats = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/viewings/owner/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  // Get completed viewings for owner
  const fetchCompletedViewings = useCallback(async (listingId = '') => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      const query = new URLSearchParams();
      if (listingId) query.append('listingId', listingId);
      
      const response = await fetch(`${API_BASE}/api/viewings/owner/completed?${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to fetch completed viewings');
      }

      return data.completedViewings || [];
    } catch (err) {
      throw err;
    }
  }, []);

  // Send application to tenant (owner)
  const sendApplication = useCallback(async (viewingAppointmentId, listingId, tenantId) => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE}/api/applications/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          viewing_appointment_id: viewingAppointmentId,
          listing_id: listingId,
          tenant_id: tenantId
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to send application');
      }

      return data;
    } catch (err) {
      throw err;
    }
  }, []);

  // Request a viewing (tenant)
  const requestViewing = useCallback(async (viewingData) => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE}/api/viewings/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(viewingData)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to request viewing');
      }

      return data;
    } catch (err) {
      throw err;
    }
  }, []);

  // Approve viewing (owner)
  const approveViewing = useCallback(async (appointmentId, notes = '') => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE}/api/viewings/${appointmentId}/approve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ notes })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to approve viewing');
      }

      return data;
    } catch (err) {
      throw err;
    }
  }, []);

  // Reject viewing (owner)
  const rejectViewing = useCallback(async (appointmentId, notes = '') => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE}/api/viewings/${appointmentId}/reject`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ notes })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to reject viewing');
      }

      return data;
    } catch (err) {
      throw err;
    }
  }, []);

  // Reschedule viewing (owner)
  const rescheduleViewing = useCallback(async (appointmentId, suggested_date, suggested_time, notes = '') => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE}/api/viewings/${appointmentId}/reschedule`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ suggested_date, suggested_time, notes })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to reschedule viewing');
      }

      return data;
    } catch (err) {
      throw err;
    }
  }, []);

  // Accept reschedule (tenant)
  const acceptReschedule = useCallback(async (appointmentId) => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE}/api/viewings/${appointmentId}/accept-reschedule`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to accept reschedule');
      }

      return data;
    } catch (err) {
      throw err;
    }
  }, []);

  // Cancel appointment (tenant or owner)
  const cancelAppointment = useCallback(async (appointmentId, notes = '') => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE}/api/viewings/${appointmentId}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ notes })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to cancel appointment');
      }

      return data;
    } catch (err) {
      throw err;
    }
  }, []);

  // Complete appointment (owner)
  const completeAppointment = useCallback(async (appointmentId, notes = '') => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE}/api/viewings/${appointmentId}/complete`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ notes })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to complete appointment');
      }

      return data;
    } catch (err) {
      throw err;
    }
  }, []);

  // Get single appointment
  const getAppointment = useCallback(async (appointmentId) => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE}/api/viewings/${appointmentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to get appointment');
      }

      return data;
    } catch (err) {
      throw err;
    }
  }, []);

  return {
    appointments,
    loading,
    error,
    stats,
    pagination,
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
    completeAppointment,
    getAppointment
  };
}