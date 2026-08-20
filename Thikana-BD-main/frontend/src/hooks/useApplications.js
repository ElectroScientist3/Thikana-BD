// src/hooks/useApplications.js
import { useState, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function useApplications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [comparisons, setComparisons] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });

  const getToken = () => localStorage.getItem('token');

  // Send application from owner to tenant (after viewing)
  const sendApplication = useCallback(async (viewingAppointmentId, listingId, tenantId) => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, []);

  // Submit a rental application (tenant)
  const submitApplication = useCallback(async (applicationData) => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(applicationData)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to submit application');
      }

      return data;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get tenant's applications
  const fetchTenantApplications = useCallback(async (status = '', page = 1, limit = 50) => {
    const token = getToken();
    if (!token) {
      setError('Authentication required');
      return;
    }

    try {
      setLoading(true);
      const query = new URLSearchParams({ page, limit });
      if (status) query.append('status', status);
      
      const response = await fetch(`${API_BASE}/api/applications/tenant?${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        throw new Error('Session expired');
      }

      const data = await response.json();
      if (response.ok) {
        setApplications(data.applications || []);
        setPagination(data.pagination || { page, limit, total: 0, totalPages: 0 });
        setError(null);
      } else {
        throw new Error(data.msg || 'Failed to load applications');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get owner's applications
  const fetchOwnerApplications = useCallback(async (status = '', listingId = '', page = 1, limit = 50) => {
    const token = getToken();
    if (!token) {
      setError('Authentication required');
      return;
    }

    try {
      setLoading(true);
      const query = new URLSearchParams({ page, limit });
      if (status) query.append('status', status);
      if (listingId) query.append('listingId', listingId);
      
      const response = await fetch(`${API_BASE}/api/applications/owner?${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        throw new Error('Session expired');
      }

      const data = await response.json();
      if (response.ok) {
        setApplications(data.applications || []);
        setPagination(data.pagination || { page, limit, total: 0, totalPages: 0 });
        setError(null);
      } else {
        throw new Error(data.msg || 'Failed to load applications');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get applications for a specific listing (owner)
  const fetchListingApplications = useCallback(async (listingId, status = '') => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (status) query.append('status', status);
      
      const response = await fetch(`${API_BASE}/api/applications/owner/listing/${listingId}?${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to load applications');
      }

      return data.applications || [];
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get application stats for owner
  const fetchStats = useCallback(async (listingId = '') => {
    const token = getToken();
    if (!token) return;

    try {
      const query = new URLSearchParams();
      if (listingId) query.append('listingId', listingId);
      
      const response = await fetch(`${API_BASE}/api/applications/owner/stats?${query}`, {
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

  // Get application status for a listing (tenant)
  const getApplicationStatus = useCallback(async (listingId) => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE}/api/applications/tenant/status/${listingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      if (!response.ok) {
        if (response.status === 404) {
          return { hasApplied: false };
        }
        throw new Error(data.msg || 'Failed to get application status');
      }

      return data;
    } catch (err) {
      throw err;
    }
  }, []);

  // Get tenant's application by viewing appointment ID
  const getApplicationByViewing = useCallback(async (viewingId) => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE}/api/applications/tenant/by-viewing/${viewingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to get application');
      }

      return data;
    } catch (err) {
      throw err;
    }
  }, []);

  // Update application status (owner)
  const updateApplicationStatus = useCallback(async (applicationId, status, notes = '') => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE}/api/applications/${applicationId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status, notes })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to update application status');
      }

      return data;
    } catch (err) {
      throw err;
    }
  }, []);

  // Withdraw application (tenant)
  const withdrawApplication = useCallback(async (applicationId, notes = '') => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE}/api/applications/${applicationId}/withdraw`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ notes })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to withdraw application');
      }

      return data;
    } catch (err) {
      throw err;
    }
  }, []);

  // Add review notes (owner)
  const addReviewNotes = useCallback(async (applicationId, review_notes) => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE}/api/applications/${applicationId}/review-notes`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ review_notes })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to add review notes');
      }

      return data;
    } catch (err) {
      throw err;
    }
  }, []);

  // Get single application
  const getApplication = useCallback(async (applicationId) => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE}/api/applications/${applicationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to get application');
      }

      return data;
    } catch (err) {
      throw err;
    }
  }, []);

  // ============================================
  // COMPARISON ROUTES
  // ============================================

  // Create a comparison
  const createComparison = useCallback(async (listing_id, application_ids, name = '', notes = '') => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE}/api/applications/compare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ listing_id, application_ids, name, notes })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to create comparison');
      }

      return data;
    } catch (err) {
      throw err;
    }
  }, []);

  // Get all comparisons for owner
  const fetchComparisons = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/applications/compare`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      if (response.ok) {
        setComparisons(data.comparisons || []);
      }
    } catch (err) {
      console.error('Failed to fetch comparisons:', err);
    }
  }, []);

  // Get a specific comparison
  const getComparison = useCallback(async (comparisonId) => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE}/api/applications/compare/${comparisonId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to get comparison');
      }

      return data;
    } catch (err) {
      throw err;
    }
  }, []);

  // Delete comparison
  const deleteComparison = useCallback(async (comparisonId) => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE}/api/applications/compare/${comparisonId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to delete comparison');
      }

      return data;
    } catch (err) {
      throw err;
    }
  }, []);

  return {
    applications,
    loading,
    error,
    stats,
    comparisons,
    pagination,
    sendApplication,
    submitApplication,
    fetchTenantApplications,
    fetchOwnerApplications,
    fetchListingApplications,
    fetchStats,
    getApplicationStatus,
    getApplicationByViewing,
    updateApplicationStatus,
    withdrawApplication,
    addReviewNotes,
    getApplication,
    createComparison,
    fetchComparisons,
    getComparison,
    deleteComparison
  };
}