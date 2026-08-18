// src/hooks/useListings.js
import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function useListings() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    byStatus: {
      available_now: 0,
      available_from_date: 0,
      on_hold: 0,
      reserved: 0,
      rented: 0
    }
  });
  const isInitialLoad = useRef(true);
  const isUpdatingRef = useRef(false);

  const getToken = () => localStorage.getItem('token');

  // Update stats from listings array
  const updateStatsFromListings = useCallback((listingsData) => {
    if (!listingsData || !Array.isArray(listingsData)) {
      return;
    }
    
    const byStatus = {
      available_now: 0,
      available_from_date: 0,
      on_hold: 0,
      reserved: 0,
      rented: 0
    };
    
    listingsData.forEach(listing => {
      if (listing && listing.status && byStatus[listing.status] !== undefined) {
        byStatus[listing.status]++;
      }
    });
    
    const newStats = {
      total: listingsData.length,
      byStatus: byStatus
    };
    
    setStats(newStats);
    return newStats;
  }, []);

  // Fetch user's own listings
  const fetchMyListings = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setError('Authentication required');
      return [];
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
        const listingsData = data.listings || [];
        setListings(listingsData);
        setError(null);
        updateStatsFromListings(listingsData);
        return listingsData;
      } else {
        throw new Error(data.msg || 'Failed to load listings');
      }
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
      isInitialLoad.current = false;
    }
  }, [updateStatsFromListings]);

  // Fetch stats from API
  const fetchStats = useCallback(async () => {
    const token = getToken();
    if (!token) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE}/api/listings/owner/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      
      const data = await response.json();
      
      const byStatus = {
        available_now: 0,
        available_from_date: 0,
        on_hold: 0,
        reserved: 0,
        rented: 0
      };
      
      if (data.byStatus) {
        Object.keys(data.byStatus).forEach(key => {
          if (byStatus[key] !== undefined) {
            byStatus[key] = data.byStatus[key];
          }
        });
      }
      
      const statsData = {
        total: data.total || 0,
        byStatus: byStatus
      };
      
      setStats(statsData);
      return statsData;
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      return null;
    }
  }, []);

  // Update status - Updated to accept extraData
  const updateStatus = useCallback(async (listingId, status, notes = '', extraData = {}) => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      isUpdatingRef.current = true;
      
      // Prepare the request body with all data
      const requestBody = { 
        status, 
        notes: notes || '',
        ...extraData // This will contain available_from, hold_expiry_date, reservation_expiry_date
      };
      
      // Make API call
      const response = await fetch(`${API_BASE}/api/listings/${listingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.msg || 'Failed to update status');
      }

      // Refresh data
      await fetchMyListings();
      await fetchStats();
      
      isUpdatingRef.current = false;
      return true;
    } catch (err) {
      isUpdatingRef.current = false;
      throw err;
    }
  }, [fetchMyListings, fetchStats]);

  // Bulk update status
  const bulkUpdateStatus = useCallback(async (listingIds, status, notes = '') => {
    const token = getToken();
    if (!token) throw new Error('Authentication required');

    try {
      isUpdatingRef.current = true;
      
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
      
      isUpdatingRef.current = false;
      return true;
    } catch (err) {
      isUpdatingRef.current = false;
      throw err;
    }
  }, [fetchMyListings, fetchStats]);

  // Delete listing
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

  // Create listing
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

  // Fetch all listings
  const fetchAllListings = useCallback(async (filters = {}) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.minRent) params.append('min_rent', filters.minRent);
      if (filters.maxRent) params.append('max_rent', filters.maxRent);
      if (filters.propertyType) params.append('property_type', filters.propertyType);
      if (filters.city) params.append('city', filters.city);
      if (filters.area) params.append('area', filters.area);
      if (filters.neLat) params.append('neLat', filters.neLat);
      if (filters.neLng) params.append('neLng', filters.neLng);
      if (filters.swLat) params.append('swLat', filters.swLat);
      if (filters.swLng) params.append('swLng', filters.swLng);
      
      const token = getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await fetch(`${API_BASE}/api/listings?${params}`, { headers });

      if (response.status === 401) {
        localStorage.removeItem('token');
        throw new Error('Session expired');
      }

      const data = await response.json();
      if (response.ok) {
        const listingsData = Array.isArray(data) ? data : [];
        setListings(listingsData);
        setError(null);
        updateStatsFromListings(listingsData);
      } else {
        throw new Error(data.msg || 'Failed to load listings');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [updateStatsFromListings]);

  // Fetch recommendations
  const fetchRecommendations = useCallback(async (prefs) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/listings/recommend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(prefs)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || 'Failed to get recommendations');
      }

      return data.results || [];
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (isInitialLoad.current) {
      const loadData = async () => {
        await fetchMyListings();
        await fetchStats();
      };
      loadData();
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
    createListing,
    updateStatsFromListings,
    fetchRecommendations
  };
}