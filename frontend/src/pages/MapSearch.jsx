import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useListings } from "../hooks/useListings";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const POI_CATEGORY_OPTIONS = [
  { type: "transit_station", label: "Transit" },
  { type: "university", label: "University" },
  { type: "hospital", label: "Hospital" },
  { type: "supermarket", label: "Market" },
  { type: "mosque", label: "Mosque" },
  { type: "restaurant", label: "Restaurant" },
  { type: "bank", label: "Bank" },
];

const DEFAULT_CENTER = [23.8103, 90.4125];
const DEFAULT_ZOOM = 12;

function MapSearch() {
  const navigate = useNavigate();
  const { listings, loading, fetchAllListings, createListing } = useListings();
  
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const searchMarkerRef = useRef(null);
  
  const [selected, setSelected] = useState(null);
  const [commuteInfo, setCommuteInfo] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [poiCategories, setPoiCategories] = useState({
    transit_station: true,
    university: true,
    hospital: true,
    supermarket: true,
    mosque: false,
    restaurant: false,
    bank: false,
  });
  const [destination, setDestination] = useState("");
  const [filters, setFilters] = useState({
    min: "",
    max: "",
    property_type: "",
    wifi: false,
    lift: false,
    parking: false,
    furnished: false,
  });
  const [mapError, setMapError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);

  // Create property form state
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    city: "Dhaka",
    area: "",
    monthly_rent_bdt: "",
    advance_bdt: "",
    property_type: "apartment",
    available_from: new Date().toISOString().split('T')[0],
    coords: {
      type: "Point",
      coordinates: [90.4125, 23.8103]
    },
    utilities: {
      wifi: false,
      lift: false,
      parking: false,
      gas: true,
      water: true,
      electricity: "meter"
    },
    status: "available_now",
    owner_name: "",
    owner_email: ""
  });

  const safeListings = Array.isArray(listings) ? listings : [];

  // Status display function
  const getStatusDisplay = (status) => {
    const statusMap = {
      'available_now': { label: 'Available Now', color: 'bg-emerald-100 text-emerald-700' },
      'available_from_date': { label: 'Available From', color: 'bg-blue-100 text-blue-700' },
      'on_hold': { label: 'On Hold', color: 'bg-amber-100 text-amber-700' },
      'reserved': { label: 'Reserved', color: 'bg-purple-100 text-purple-700' },
      'rented': { label: 'Rented', color: 'bg-red-100 text-red-700' }
    };
    return statusMap[status] || { label: status || 'Unknown', color: 'bg-gray-100 text-gray-700' };
  };

  // Get current user info for pre-filling owner fields
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (storedUser) {
      setCreateForm(prev => ({
        ...prev,
        owner_name: storedUser.name || '',
        owner_email: storedUser.email || ''
      }));
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    mapInstance.current = L.map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(mapInstance.current);

    mapInstance.current.on("moveend", () => {
      const bounds = mapInstance.current.getBounds();
      loadListings({
        neLat: bounds.getNorthEast().lat,
        neLng: bounds.getNorthEast().lng,
        swLat: bounds.getSouthWest().lat,
        swLng: bounds.getSouthWest().lng,
      });
    });

    loadListings();

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
      clearMarkers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearMarkers = () => {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
  };

  const clearSearchMarker = () => {
    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
      searchMarkerRef.current = null;
    }
  };

  const createPriceIcon = (price) => {
    return L.divIcon({
      className: "price-marker",
      html: `<div style="background:#1f2937;color:#fff;padding:6px 10px;border-radius:8px;border:2px solid #fff;font-size:12px;white-space:nowrap;box-shadow:0 1px 6px rgba(0,0,0,0.15);">BDT ${price}</div>`,
      iconSize: [110, 34],
      iconAnchor: [55, 34],
    });
  };

  const createSearchIcon = () => {
    return L.divIcon({
      className: "search-location-marker",
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;"
             title="Search location">
          <div style="background:#dc2626;color:#fff;font-size:12px;padding:4px 8px;border-radius:9999px;white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,0.2);">
            Searched location
          </div>
          <div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:12px solid #dc2626;margin-top:-1px;"></div>
        </div>
      `,
      iconSize: [24, 40],
      iconAnchor: [12, 40],
    });
  };

  const placeMarkers = (items) => {
    clearMarkers();
    if (!mapInstance.current || !Array.isArray(items)) return;

    items.forEach((item) => {
      if (!item.coords || !Array.isArray(item.coords.coordinates)) return;
      const [lng, lat] = item.coords.coordinates;
      const marker = L.marker([lat, lng], {
        icon: createPriceIcon(item.monthly_rent_bdt),
      }).addTo(mapInstance.current);

      marker.on("click", () => {
        setSelected(item);
        mapInstance.current?.panTo([lat, lng]);
      });

      markersRef.current.push(marker);
    });
  };

  const loadListings = async (bbox) => {
    const filterParams = {};
    if (filters.min) filterParams.minRent = filters.min;
    if (filters.max) filterParams.maxRent = filters.max;
    if (filters.property_type) filterParams.propertyType = filters.property_type;
    
    if (filters.wifi) filterParams.wifi = true;
    if (filters.lift) filterParams.lift = true;
    if (filters.parking) filterParams.parking = true;
    
    if (bbox) {
      filterParams.neLat = bbox.neLat;
      filterParams.neLng = bbox.neLng;
      filterParams.swLat = bbox.swLat;
      filterParams.swLng = bbox.swLng;
    }

    await fetchAllListings(filterParams);
  };

  const handleApplyFilters = () => {
    const bounds = mapInstance.current?.getBounds();
    if (bounds) {
      loadListings({
        neLat: bounds.getNorthEast().lat,
        neLng: bounds.getNorthEast().lng,
        swLat: bounds.getSouthWest().lat,
        swLng: bounds.getSouthWest().lng,
      });
    } else {
      loadListings();
    }
  };

  useEffect(() => {
    placeMarkers(listings);
  }, [listings]);

  useEffect(() => {
    if (!selected) {
      setCommuteInfo([]);
      return;
    }

    const lat = selected.coords?.coordinates?.[1];
    const lng = selected.coords?.coordinates?.[0];
    if (!lat || !lng) return;

    const selectedCategories = Object.keys(poiCategories).filter((key) => poiCategories[key]);
    const query = new URLSearchParams({ lat, lng, categories: selectedCategories.join(',') });
    if (destination) query.set('destination', destination);

    axios.get(`/api/commute?${query.toString()}`)
      .then((res) => {
        const commute = res.data.commute || [];
        setCommuteInfo(commute);
      })
      .catch((err) => {
        console.error('Commute API failed:', err);
        setCommuteInfo([]);
      });
  }, [selected, poiCategories, destination]);

  const searchPlace = async (event) => {
    event.preventDefault();
    if (!searchText.trim()) return;

    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: searchText,
          format: 'json',
          limit: 1,
        },
      });

      const place = response.data?.[0];
      if (!place) {
        setMapError('Location not found.');
        return;
      }

      const lat = parseFloat(place.lat);
      const lon = parseFloat(place.lon);
      mapInstance.current?.setView([lat, lon], 14);

      clearSearchMarker();
      if (mapInstance.current) {
        searchMarkerRef.current = L.marker([lat, lon], {
          icon: createSearchIcon(),
          interactive: false,
        }).addTo(mapInstance.current);
      }

      const bounds = mapInstance.current?.getBounds();
      if (bounds) {
        loadListings({
          neLat: bounds.getNorthEast().lat,
          neLng: bounds.getNorthEast().lng,
          swLat: bounds.getSouthWest().lat,
          swLng: bounds.getSouthWest().lng,
        });
      }
    } catch (error) {
      console.error('Search failed:', error);
      setMapError('Search failed.');
    }
  };

  const handleCreateProperty = async (e) => {
    e.preventDefault();
    setCreating(true);
    
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please login to create a property');
      setCreating(false);
      return;
    }

    if (!createForm.owner_name || !createForm.owner_email) {
      alert('Please provide owner name and email');
      setCreating(false);
      return;
    }

    try {
      await createListing(createForm);
      setCreateSuccess(true);
      setShowCreateModal(false);
      setCreateForm({
        title: "",
        description: "",
        city: "Dhaka",
        area: "",
        monthly_rent_bdt: "",
        advance_bdt: "",
        property_type: "apartment",
        available_from: new Date().toISOString().split('T')[0],
        coords: {
          type: "Point",
          coordinates: [90.4125, 23.8103]
        },
        utilities: {
          wifi: false,
          lift: false,
          parking: false,
          gas: true,
          water: true,
          electricity: "meter"
        },
        status: "available_now",
        owner_name: "",
        owner_email: ""
      });
      
      setTimeout(() => {
        loadListings();
        setCreateSuccess(false);
      }, 500);
      
    } catch (error) {
      console.error('Create property failed:', error);
      alert(error.message || 'Failed to create property');
    } finally {
      setCreating(false);
    }
  };

  const handleReset = () => {
    setFilters({ 
      min: '', 
      max: '', 
      property_type: '', 
      wifi: false, 
      lift: false, 
      parking: false, 
      furnished: false 
    });
    setDestination('');
    setSearchText('');
    setPoiCategories({
      transit_station: true,
      university: true,
      hospital: true,
      supermarket: true,
      mosque: false,
      restaurant: false,
      bank: false,
    });
    loadListings();
  };

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Sidebar - Fixed width, no overlap */}
      <aside className="w-80 bg-white shadow-lg p-4 overflow-y-auto flex-shrink-0 h-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-slate-900">Filters</h3>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition"
          >
            + Add Property
          </button>
        </div>

        {createSuccess && (
          <div className="mb-3 p-2 bg-green-100 text-green-700 rounded text-sm">
            Property created successfully!
          </div>
        )}

        <div className="mb-2">
          <label className="block text-sm font-medium text-slate-700">Min Rent (BDT)</label>
          <input
            type="number"
            value={filters.min}
            onChange={(e) => setFilters((prev) => ({ ...prev, min: e.target.value }))}
            className="w-full border border-slate-300 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., 10000"
          />
        </div>

        <div className="mb-2">
          <label className="block text-sm font-medium text-slate-700">Max Rent (BDT)</label>
          <input
            type="number"
            value={filters.max}
            onChange={(e) => setFilters((prev) => ({ ...prev, max: e.target.value }))}
            className="w-full border border-slate-300 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., 50000"
          />
        </div>

        <div className="mb-2">
          <label className="block text-sm font-medium text-slate-700">Property Type</label>
          <select
            value={filters.property_type}
            onChange={(e) => setFilters((prev) => ({ ...prev, property_type: e.target.value }))}
            className="w-full border border-slate-300 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Any</option>
            <option value="apartment">Apartment</option>
            <option value="flat">Flat</option>
            <option value="bachelor_room">Bachelor Room</option>
            <option value="sublet">Sublet</option>
            <option value="shared_room">Shared Room</option>
            <option value="mess_seat">Mess Seat</option>
            <option value="duplex">Duplex</option>
            <option value="penthouse">Penthouse</option>
            <option value="studio">Studio</option>
            <option value="villa">Villa</option>
          </select>
        </div>

        <div className="mb-2 flex flex-wrap gap-3 text-sm">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.wifi}
              onChange={(e) => setFilters((prev) => ({ ...prev, wifi: e.target.checked }))}
              className="rounded"
            />
            Wifi
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.lift}
              onChange={(e) => setFilters((prev) => ({ ...prev, lift: e.target.checked }))}
              className="rounded"
            />
            Lift
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.parking}
              onChange={(e) => setFilters((prev) => ({ ...prev, parking: e.target.checked }))}
              className="rounded"
            />
            Parking
          </label>
        </div>

        <form onSubmit={searchPlace} className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Search landmark / area</label>
          <div className="flex gap-2">
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search places (e.g. Dhanmondi)"
              className="flex-1 border border-slate-300 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              Search
            </button>
          </div>
        </form>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700">Custom destination</label>
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Enter destination (e.g. airport)"
            className="w-full border border-slate-300 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4">
          <h4 className="font-semibold text-slate-700 mb-2">Nearby categories</h4>
          <div className="grid grid-cols-2 gap-2">
            {POI_CATEGORY_OPTIONS.map((option) => (
              <label key={option.type} className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={poiCategories[option.type]}
                  onChange={(e) => setPoiCategories((prev) => ({ ...prev, [option.type]: e.target.checked }))}
                  className="rounded"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button 
            type="button" 
            onClick={handleApplyFilters} 
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="flex-1 px-4 py-2 bg-gray-200 text-slate-700 rounded-lg hover:bg-gray-300 transition"
          >
            Reset
          </button>
        </div>

        <hr className="my-3 border-slate-200" />
        <div>
          <h4 className="font-semibold text-slate-700 mb-2">Results ({safeListings.length})</h4>
          {loading && <div className="text-sm text-gray-500 mb-2">Loading...</div>}
          {mapError && <div className="text-sm text-red-500 mb-2">{mapError}</div>}
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {safeListings.length === 0 && !loading && !mapError && (
              <div className="text-sm text-gray-500 text-center py-4">
                No properties found. 
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="block mx-auto mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  Create Your First Property
                </button>
              </div>
            )}
            {safeListings.map((listing) => {
              const statusInfo = getStatusDisplay(listing.status);
              return (
                <div
                  key={listing._id}
                  onClick={() => setSelected(listing)}
                  className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-slate-900">{listing.title}</div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">{listing.area}, {listing.city}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-600">BDT {listing.monthly_rent_bdt}</div>
                      <div className="text-sm text-gray-500">{listing.rooms || 1} rooms</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Map Container - Takes remaining space with proper z-index for dropdowns */}
      <div className="flex-1 flex flex-col min-w-0 relative z-0">
        <div className="flex items-center gap-2 p-3 bg-white border-b border-slate-200">
          <button 
            type="button" 
            onClick={() => navigate('/dashboard')} 
            className="px-3 py-1.5 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
          >
            Back
          </button>
          <div className="text-sm text-gray-600">Use the map to select an area. Click markers for details.</div>
        </div>

        <div className="flex-1 relative">
          {mapError ? (
            <div className="flex-1 rounded shadow bg-red-50 border border-red-200 p-4 text-red-700 m-4">
              <p className="font-semibold">Map error</p>
              <p>{mapError}</p>
              <button 
                onClick={() => loadListings()} 
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Retry
              </button>
            </div>
          ) : (
            <div ref={mapRef} className="w-full h-full bg-gray-100" style={{ position: 'relative', zIndex: 0 }} />
          )}
        </div>

        {/* Selected listing card - appears above map but below dropdowns */}
        {selected && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-[95%] max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-10">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-slate-900">{selected.title}</h3>
                <div className="text-sm text-gray-600 mb-2">{selected.area}, {selected.city}</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">Rent:</span>
                    <span className="font-bold text-emerald-600 ml-1">BDT {selected.monthly_rent_bdt}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Type:</span>
                    <span className="font-medium ml-1">{selected.property_type}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Rooms:</span>
                    <span className="font-medium ml-1">{selected.rooms || 1}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Available:</span>
                    <span className="font-medium ml-1">
                      {selected.available_from ? new Date(selected.available_from).toLocaleDateString() : 'Immediate'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <button 
                  type="button" 
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  onClick={() => navigate('/dashboard/viewings')}
                >
                  Request Viewing
                </button>
                <button 
                  type="button" 
                  onClick={() => setSelected(null)} 
                  className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Property Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-2 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">Create New Property</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-2xl hover:text-slate-700 p-1"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateProperty}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    placeholder="e.g., 2BR Apartment in Gulshan"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Area *</label>
                  <input
                    type="text"
                    value={createForm.area}
                    onChange={(e) => setCreateForm({ ...createForm, area: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    placeholder="e.g., Gulshan"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City *</label>
                  <select
                    value={createForm.city}
                    onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="Dhaka">Dhaka</option>
                    <option value="Chattogram">Chattogram</option>
                    <option value="Sylhet">Sylhet</option>
                    <option value="Rajshahi">Rajshahi</option>
                    <option value="Khulna">Khulna</option>
                    <option value="Barishal">Barishal</option>
                    <option value="Rangpur">Rangpur</option>
                    <option value="Mymensingh">Mymensingh</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Rent (BDT) *</label>
                    <input
                      type="number"
                      value={createForm.monthly_rent_bdt}
                      onChange={(e) => setCreateForm({ ...createForm, monthly_rent_bdt: parseInt(e.target.value) || '' })}
                      className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                      placeholder="25000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Advance (BDT)</label>
                    <input
                      type="number"
                      value={createForm.advance_bdt}
                      onChange={(e) => setCreateForm({ ...createForm, advance_bdt: parseInt(e.target.value) || '' })}
                      className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="75000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Property Type *</label>
                  <select
                    value={createForm.property_type}
                    onChange={(e) => setCreateForm({ ...createForm, property_type: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="apartment">Apartment</option>
                    <option value="flat">Flat</option>
                    <option value="bachelor_room">Bachelor Room</option>
                    <option value="sublet">Sublet</option>
                    <option value="shared_room">Shared Room</option>
                    <option value="mess_seat">Mess Seat</option>
                    <option value="duplex">Duplex</option>
                    <option value="penthouse">Penthouse</option>
                    <option value="studio">Studio</option>
                    <option value="villa">Villa</option>
                  </select>
                </div>

                {/* Owner Information Fields */}
                <div className="border-t border-slate-200 pt-3 mt-2">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Owner Information</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Owner Name *</label>
                      <input
                        type="text"
                        value={createForm.owner_name}
                        onChange={(e) => setCreateForm({ ...createForm, owner_name: e.target.value })}
                        className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                        placeholder="Owner Name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Owner Email *</label>
                      <input
                        type="email"
                        value={createForm.owner_email}
                        onChange={(e) => setCreateForm({ ...createForm, owner_email: e.target.value })}
                        className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                        placeholder="owner@email.com"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Viewing requests will be sent to this email address
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={createForm.status}
                    onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="available_now">Available Now</option>
                    <option value="available_from_date">Available From Date</option>
                    <option value="on_hold">On Hold</option>
                    <option value="reserved">Reserved</option>
                    <option value="rented">Rented</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="2"
                    placeholder="Describe your property..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createForm.utilities.wifi}
                      onChange={(e) => setCreateForm({
                        ...createForm,
                        utilities: { ...createForm.utilities, wifi: e.target.checked }
                      })}
                      className="rounded"
                    />
                    Wifi
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createForm.utilities.lift}
                      onChange={(e) => setCreateForm({
                        ...createForm,
                        utilities: { ...createForm.utilities, lift: e.target.checked }
                      })}
                      className="rounded"
                    />
                    Lift
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createForm.utilities.parking}
                      onChange={(e) => setCreateForm({
                        ...createForm,
                        utilities: { ...createForm.utilities, parking: e.target.checked }
                      })}
                      className="rounded"
                    />
                    Parking
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createForm.utilities.gas}
                      onChange={(e) => setCreateForm({
                        ...createForm,
                        utilities: { ...createForm.utilities, gas: e.target.checked }
                      })}
                      className="rounded"
                    />
                    Gas
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Property'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MapSearch;