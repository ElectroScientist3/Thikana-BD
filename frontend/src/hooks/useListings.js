// src/hooks/useListings.js
import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function useListings() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  const getToken = () => localStorage.getItem('token');

  // Fetch all listings (for tenants browsing properties)
  const fetchAllListings = useCallback(async (filters = {}) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.minRent) params.append('min_rent', filters.minRent);
      if (filters.maxRent) params.append('max_rent', filters.maxRent);
      if (filters.propertyType) params.append('property_type', filters.propertyType);
      if (filters.city) params.append('city', filters.city);
      if (filters.area) params.append('area', filters.area);
      
      const token = getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await fetch(`${API_BASE}/api/listings?${params}`, { headers });

      if (response.status === 401) {
        localStorage.removeItem('token');
        throw new Error('Session expired');
      }

      const data = await response.json();
      if (response.ok) {
        setListings(Array.isArray(data) ? data : []);
        setError(null);
      } else {
        throw new Error(data.msg || 'Failed to load listings');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch user's own listings (for owner dashboard)
  const fetchMyListings = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setError('Authentication required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/listings/my-listings`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        throw new Error('Session expired');
      }

      const data = await response.json();
      if (response.ok) {
        setListings(data.listings || []);
        setError(null);
      } else {
        throw new Error(data.msg || 'Failed to load listings');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/listings/owner/dashboard/stats`, {
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

  const updateStatus = useCallback(async (listingId, status, notes = '') => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE}/api/listings/${listingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status, notes })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.msg || 'Failed to update status');
      }

      await fetchMyListings();
      await fetchStats();
      return true;
    } catch (err) {
      throw err;
    }
  }, [fetchMyListings, fetchStats]);

  const bulkUpdateStatus = useCallback(async (listingIds, status, notes = '') => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE}/api/listings/owner/bulk-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          listingIds,
          status,
          notes
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.msg || 'Failed to update statuses');
      }

      await fetchMyListings();
      await fetchStats();
      return true;
    } catch (err) {
      throw err;
    }
  }, [fetchMyListings, fetchStats]);

  const deleteListing = useCallback(async (listingId) => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE}/api/listings/${listingId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.msg || 'Failed to delete listing');
      }

      await fetchMyListings();
      await fetchStats();
      return true;
    } catch (err) {
      throw err;
    }
  }, [fetchMyListings, fetchStats]);

  // Create a new listing
  const createListing = useCallback(async (listingData) => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE}/api/listings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(listingData)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to create listing');
      }

      await fetchMyListings();
      await fetchStats();
      return data;
    } catch (err) {
      throw err;
    }
  }, [fetchMyListings, fetchStats]);

  return {
    listings,
    loading,
    error,
    stats,
    fetchAllListings,
    fetchMyListings,
    fetchStats,
    updateStatus,
    bulkUpdateStatus,
    deleteListing,
    createListing
  };
}