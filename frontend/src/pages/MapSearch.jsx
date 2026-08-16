import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useListings } from "../hooks/useListings";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { topRecommendations } from "../utils/recommend";

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
  const { listings, loading, fetchAllListings, createListing, fetchRecommendations } = useListings();
  
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const searchMarkerRef = useRef(null);
  
  const [selected, setSelected] = useState(null);
  const [commuteInfo, setCommuteInfo] = useState([]);
  const [directDurations, setDirectDurations] = useState({ toA: null, toB: null });
  const [commutePoints, setCommutePoints] = useState({
    aAddress: '',
    aCoords: null,
    bAddress: '',
    bCoords: null,
  });
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
  const [showOnlyRecommended, setShowOnlyRecommended] = useState(false);
  const [recommendResults, setRecommendResults] = useState([]);
  const [compareList, setCompareList] = useState([]); // up to 2 listings to compare
  const [compareCommute, setCompareCommute] = useState([]); // commute results per compared listing
  const [showComparePanel, setShowComparePanel] = useState(false);

  // Create property form state
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    city: "Dhaka",
    area: "",
    monthly_rent_bdt: "",
    advance_bdt: "",
    property_type: "apartment",
    rooms: 1,
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
    status: "available_now"
  });

  const safeListings = Array.isArray(listings) ? listings : [];
  const displayedListings = showOnlyRecommended ? (recommendResults.length ? recommendResults : []) : safeListings;

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

    // Initial load
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

  // Update markers when listings change
  useEffect(() => {
    const items = showOnlyRecommended ? (recommendResults.length ? recommendResults : []) : listings;
    placeMarkers(items);
  }, [listings, showOnlyRecommended, recommendResults]);

  useEffect(() => {
    if (!selected) {
      setCommuteInfo([]);
      setCommutePoints({ aAddress: '', aCoords: null, bAddress: '', bCoords: null });
      setDirectDurations({ toA: null, toB: null });
      return;
    }

    // initialize Point A from selected property
    const lat = selected.coords?.coordinates?.[1];
    const lng = selected.coords?.coordinates?.[0];
    setCommutePoints((p) => ({
      aAddress: p.aAddress || `${selected.area || ''}, ${selected.city || ''}`,
      aCoords: p.aCoords || (lat && lng ? { lat, lng } : null),
      bAddress: p.bAddress || destination || '',
      bCoords: p.bCoords || null,
    }));
    // fetch initial commute using property location as origin
    fetchCommuteUsingPoints({ lat, lng }, null);
  }, [selected, poiCategories, destination]);

  const geocodeAddress = async (address) => {
    if (!address || !address.trim()) return null;
    try {
      const res = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { q: address, format: 'json', limit: 1 },
      });
      const place = res.data?.[0];
      if (!place) return null;
      return { lat: parseFloat(place.lat), lng: parseFloat(place.lon), display_name: place.display_name };
    } catch (err) {
      console.error('Geocode failed', err);
      return null;
    }
  };

  const fetchCommuteUsingPoints = async (aCoordsParam = null, bCoordsParam = null) => {
    const aCoords = aCoordsParam || commutePoints.aCoords;
    const bCoords = bCoordsParam || commutePoints.bCoords;
    // Prefer using the selected property's coords as the origin (house). Fallback to Point A.
    const origin = (selected && selected.coords && Array.isArray(selected.coords.coordinates))
      ? { lat: selected.coords.coordinates[1], lng: selected.coords.coordinates[0] }
      : (aCoords || null);
    if (!origin || !origin.lat || !origin.lng) return;

    const selectedCategories = Object.keys(poiCategories).filter((key) => poiCategories[key]);

    // 1) Fetch POI commute info around the origin
    try {
      const params = new URLSearchParams({ lat: origin.lat, lng: origin.lng, categories: selectedCategories.join(',') });
      const res = await axios.get(`/api/commute?${params.toString()}`);
      const commute = res.data.commute || [];
      setCommuteInfo(commute);
    } catch (err) {
      console.error('Commute API failed (POIs):', err);
      setCommuteInfo([]);
    }

    // Helper to fetch direct durations origin -> dest
    const fetchDirect = async (dest) => {
      if (!dest || !dest.lat || !dest.lng) return null;
      try {
        const params = new URLSearchParams({ lat: origin.lat, lng: origin.lng, destLat: dest.lat, destLng: dest.lng });
        const res = await axios.get(`/api/commute?${params.toString()}`);
        return res.data && res.data.direct ? res.data.direct.toDestination : null;
      } catch (err) {
        console.error('Commute API failed (direct):', err);
        return null;
      }
    };

    // 2) Fetch direct durations to Point A and Point B (if provided)
    try {
      const [toA, toB] = await Promise.all([fetchDirect(aCoords), fetchDirect(bCoords)]);
      setDirectDurations({ toA, toB });
    } catch (e) {
      setDirectDurations({ toA: null, toB: null });
    }
  };

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
        rooms: 1,
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
        status: "available_now"
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
    setShowOnlyRecommended(false);
    setRecommendResults([]);
    loadListings();
  };

  return (
    <div className="p-4 h-screen flex gap-4 relative">
      {/* Sidebar - Fixed width */}
      <aside className="w-80 bg-white rounded shadow p-4 overflow-auto flex-shrink-0">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Filters</h3>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
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
          <label className="block text-sm">Min Rent (BDT)</label>
          <input
            type="number"
            value={filters.min}
            onChange={(e) => setFilters((prev) => ({ ...prev, min: e.target.value }))}
            className="w-full border px-2 py-1 rounded"
            placeholder="e.g., 10000"
          />
        </div>

        <div className="mb-2">
          <label className="block text-sm">Max Rent (BDT)</label>
          <input
            type="number"
            value={filters.max}
            onChange={(e) => setFilters((prev) => ({ ...prev, max: e.target.value }))}
            className="w-full border px-2 py-1 rounded"
            placeholder="e.g., 50000"
          />
        </div>

        <div className="mb-2">
          <label className="block text-sm">Property Type</label>
          <select
            value={filters.property_type}
            onChange={(e) => setFilters((prev) => ({ ...prev, property_type: e.target.value }))}
            className="w-full border px-2 py-1 rounded"
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

        <div className="mb-2 flex flex-wrap gap-2 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.wifi}
              onChange={(e) => setFilters((prev) => ({ ...prev, wifi: e.target.checked }))}
            />
            Wifi
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.lift}
              onChange={(e) => setFilters((prev) => ({ ...prev, lift: e.target.checked }))}
            />
            Lift
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.parking}
              onChange={(e) => setFilters((prev) => ({ ...prev, parking: e.target.checked }))}
            />
            Parking
          </label>
        </div>

        <form onSubmit={searchPlace} className="mb-4">
          <label className="block text-sm mb-1">Search landmark / area</label>
          <div className="flex gap-2">
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search places (e.g. Dhanmondi)"
              className="flex-1 border px-2 py-1 rounded"
            />
            <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Search
            </button>
          </div>
        </form>

        <div className="mb-4">
          <label className="block text-sm">Custom destination</label>
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Enter destination (e.g. airport)"
            className="w-full border px-2 py-1 rounded"
          />
        </div>

        <div className="mb-4">
          <h4 className="font-semibold mb-2">Nearby categories</h4>
          <div className="grid grid-cols-2 gap-2">
            {POI_CATEGORY_OPTIONS.map((option) => (
              <label key={option.type} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={poiCategories[option.type]}
                  onChange={(e) => setPoiCategories((prev) => ({ ...prev, [option.type]: e.target.checked }))}
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
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={async () => {
              // compute recommended from currently loaded listings using current filters
              const prefs = {
                minRent: filters.min,
                maxRent: filters.max,
                propertyType: filters.property_type,
                rooms: filters.rooms || undefined,
                features: { wifi: filters.wifi, lift: filters.lift, parking: filters.parking }
              };
              const center = mapInstance.current?.getCenter();
              const ref = center ? { lat: center.lat, lng: center.lng } : null;
              const candidates = Array.isArray(listings) ? listings : [];
              const top = topRecommendations(candidates, prefs, 10, ref);
              setRecommendResults(top);
              setShowOnlyRecommended(true);
            }}
            className="px-3 py-2 bg-amber-500 text-white rounded hover:bg-amber-600"
          >
            SHOW RECOMMENDED ONLY
          </button>
        </div>

        <hr className="my-3" />
        <div>
          <h4 className="font-semibold mb-2">Results ({safeListings.length})</h4>
          <div className="text-xs text-gray-500 mb-2">Select up to two properties and click Compare</div>
          {loading && <div className="text-sm text-gray-500 mb-2">Loading...</div>}
          {mapError && <div className="text-sm text-red-500 mb-2">{mapError}</div>}
          <div className="space-y-2">
            {safeListings.length === 0 && !loading && !mapError && (
              <div className="text-sm text-gray-500 text-center py-4">
                No properties found. 
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="block mx-auto mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Create Your First Property
                </button>
              </div>
            )}
            {displayedListings.map((listing) => {
              const statusInfo = getStatusDisplay(listing.status);
              return (
                <div
                  key={listing._id}
                  className="p-2 border rounded hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold">{listing.title}</div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">{listing.area}, {listing.city}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">BDT {listing.monthly_rent_bdt}</div>
                      <div className="text-sm text-gray-500">{listing.rooms || 1} rooms</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={compareList.findIndex(c => c._id === listing._id) !== -1}
                          onChange={(e) => {
                            e.stopPropagation();
                            setCompareList(prev => {
                              const exists = prev.findIndex(c => c._id === listing._id) !== -1;
                              if (exists) return prev.filter(c => c._id !== listing._id);
                              if (prev.length >= 2) return prev; // limit to 2
                              return [...prev, listing];
                            });
                          }}
                        />
                        Compare
                      </label>
                      <button onClick={() => setSelected(listing)} className="text-sm text-blue-600 underline">View</button>
                    </div>
                    <div>
                      <button onClick={() => {
                        // quick jump to marker
                        const [lng, lat] = listing.coords?.coordinates || [];
                        if (lat && lng) mapInstance.current?.panTo([lat, lng]);
                        setSelected(listing);
                      }} className="px-2 py-1 text-sm bg-gray-100 rounded">Open</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Compare Panel Trigger */}
      <div className="fixed bottom-6 left-96 z-50">
        <div className="bg-white p-2 rounded shadow flex items-center gap-2">
          <div className="text-sm">Compare ({compareList.length}/2)</div>
          <button
            disabled={compareList.length < 2}
            onClick={async () => {
              if (compareList.length < 2) return;
              setShowComparePanel(true);
              // fetch commute info for both listings using current POI categories and optional destination
              const cats = Object.keys(poiCategories).filter(k => poiCategories[k]).join(',');
              const dest = commutePoints.bCoords || null;
              try {
                const fetchFor = async (listing) => {
                  const lat = listing.coords?.coordinates?.[1];
                  const lng = listing.coords?.coordinates?.[0];
                  if (!lat || !lng) return { commute: [], direct: null };
                  const params = new URLSearchParams({ lat, lng, categories: cats });
                  if (dest) { params.set('destLat', dest.lat); params.set('destLng', dest.lng); }
                  const res = await axios.get(`/api/commute?${params.toString()}`);
                  return res.data || { commute: [], direct: null };
                };
                const results = await Promise.all(compareList.map(l => fetchFor(l)));
                setCompareCommute(results);
              } catch (e) {
                console.error('Compare commute failed', e);
                setCompareCommute([]);
              }
            }}
            className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            Compare
          </button>
          <button onClick={() => { setCompareList([]); setShowComparePanel(false); setCompareCommute([]); }} className="px-2 py-1 bg-gray-200 rounded">Clear</button>
        </div>
      </div>

      {/* Map Container - Takes remaining space */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <button 
            type="button" 
            onClick={() => navigate('/dashboard')} 
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
          >
            Back
          </button>
          <div className="text-sm text-gray-600">Use the map to select an area. Click markers for details.</div>
        </div>

        {mapError ? (
          <div className="flex-1 rounded shadow bg-red-50 border border-red-200 p-4 text-red-700">
            <p className="font-semibold">Map error</p>
            <p>{mapError}</p>
            <button 
              onClick={() => loadListings()} 
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <div ref={mapRef} className="flex-1 rounded shadow bg-gray-100 min-h-[420px]" />
        )}

        {selected ? (
          <div className="mt-4 bg-white rounded shadow p-6">
            <div className="flex gap-6">
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">PROPERTY DETAILS: {selected.title || (selected.area + ', ' + selected.city)}</h2>
                <div className="flex gap-4 mb-4">
                  <div className="bg-gray-50 p-4 rounded flex-1 shadow">
                    <div className="text-sm text-gray-500">AVAILABILITY</div>
                    <div className="mt-2 font-semibold">{selected.available_from ? `From ${new Date(selected.available_from).toLocaleDateString()}` : 'Available Now'}</div>
                    {selected.status === 'on_hold' && <div className="mt-1 text-xs text-amber-700">BOOKED until {selected.booked_until ? new Date(selected.booked_until).toLocaleDateString() : 'N/A'}</div>}
                  </div>
                  <div className="bg-gray-50 p-4 rounded flex-1 shadow">
                    <div className="text-sm text-gray-500">NUMBER OF ROOMS</div>
                    <div className="mt-2 font-semibold">{selected.rooms || 1} Bedrooms • {selected.bathrooms || 'N/A'} Bathrooms</div>
                    <div className="text-sm text-gray-600 mt-1">{selected.property_type}</div>
                  </div>
                </div>
                <div className="mb-4">
                  <div className="bg-white rounded shadow p-4">
                    <h4 className="font-semibold mb-2">COMMUTE: Point A → Point B</h4>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <label className="text-sm">Point A (Origin)</label>
                        <input value={commutePoints.aAddress} onChange={(e) => setCommutePoints(p => ({ ...p, aAddress: e.target.value }))} className="w-full border px-2 py-1 rounded mt-1" />
                        <div className="flex gap-2 mt-2">
                          <button onClick={async () => {
                            // geocode and set A
                            const res = await geocodeAddress(commutePoints.aAddress);
                            if (res) setCommutePoints(p => ({ ...p, aCoords: { lat: res.lat, lng: res.lng }, aAddress: res.display_name }));
                          }} className="px-2 py-1 bg-blue-600 text-white rounded text-sm">Geocode A</button>
                          <button onClick={() => {
                            // use property location
                            const lat = selected.coords?.coordinates?.[1];
                            const lng = selected.coords?.coordinates?.[0];
                            if (lat && lng) setCommutePoints(p => ({ ...p, aCoords: { lat, lng }, aAddress: `${selected.area || ''}, ${selected.city || ''}` }));
                          }} className="px-2 py-1 bg-gray-200 rounded text-sm">Use property</button>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm">Point B (Destination)</label>
                        <input value={commutePoints.bAddress} onChange={(e) => setCommutePoints(p => ({ ...p, bAddress: e.target.value }))} className="w-full border px-2 py-1 rounded mt-1" />
                        <div className="flex gap-2 mt-2">
                          <button onClick={async () => {
                            const res = await geocodeAddress(commutePoints.bAddress);
                            if (res) setCommutePoints(p => ({ ...p, bCoords: { lat: res.lat, lng: res.lng }, bAddress: res.display_name }));
                          }} className="px-2 py-1 bg-blue-600 text-white rounded text-sm">Geocode B</button>
                          <button onClick={() => { setCommutePoints(p => ({ ...p, bCoords: null })); setCommutePoints(p => ({ ...p, bAddress: '' })); }} className="px-2 py-1 bg-gray-200 rounded text-sm">Clear</button>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mb-3">
                      <button onClick={() => fetchCommuteUsingPoints()} className="px-3 py-1 bg-emerald-600 text-white rounded text-sm">Update Commute</button>
                      <div className="text-sm text-gray-500 self-center">Selected categories: {Object.keys(poiCategories).filter(k=>poiCategories[k]).join(', ')}</div>
                    </div>

                    {/* Direct durations from house -> Point A / Point B */}
                    {(directDurations.toA || directDurations.toB) && (
                      <div className="mb-3 p-3 bg-gray-50 rounded text-sm">
                        <div className="font-semibold mb-2">Direct distances (House → Points)</div>
                        <div className="grid grid-cols-1 gap-2">
                          <div>
                            <div className="text-xs text-gray-500">To Point A</div>
                            <div className="text-sm">
                              Walking: {directDurations.toA?.walking?.duration || '-'} • Car: {directDurations.toA?.car?.duration || '-'}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">To Point B</div>
                            <div className="text-sm">
                              Walking: {directDurations.toB?.walking?.duration || '-'} • Car: {directDurations.toB?.car?.duration || '-'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {commuteInfo.length === 0 ? (
                      <div className="text-sm text-gray-600">Nearby points of interest and commute times will be shown here once you update commute.</div>
                    ) : (
                      <div className="overflow-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="text-left">
                              <th className="p-2 border-b">Category</th>
                              {commuteInfo.map((c, i) => (
                                <th key={i} className="p-2 border-b">{c.name}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="p-2 border-t">Walking</td>
                              {commuteInfo.map((c, i) => (
                                <td key={i} className="p-2 border-t">{c.walking?.duration || '-'}</td>
                              ))}
                            </tr>
                            <tr>
                              <td className="p-2 border-t">Rickshaw</td>
                              {commuteInfo.map((c, i) => (
                                <td key={i} className="p-2 border-t">{c.rickshaw?.duration || c.transit?.duration || '-'}</td>
                              ))}
                            </tr>
                            <tr>
                              <td className="p-2 border-t">CNG/Car</td>
                              {commuteInfo.map((c, i) => (
                                <td key={i} className="p-2 border-t">{c.car?.duration || '-'}</td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    onClick={() => { navigate('/dashboard/viewings'); }}
                  >
                    CONFIRM
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setSelected(null)} 
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="w-64">
                <div className="w-64 h-40 bg-gray-100 rounded overflow-hidden">
                  {selected.photos && selected.photos[0] ? (
                    <img src={selected.photos[0]} alt="prop" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">No image</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 text-center text-gray-600">Select a listing to see details.</div>
        )}
      </div>

      {/* Create Property Modal - Fixed positioning with high z-index */}
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

                <div className="grid grid-cols-2 gap-3">
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
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Rooms</label>
                    <input
                      type="number"
                      value={createForm.rooms}
                      onChange={(e) => setCreateForm({ ...createForm, rooms: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                    />
                  </div>
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
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={createForm.utilities.wifi}
                      onChange={(e) => setCreateForm({
                        ...createForm,
                        utilities: { ...createForm.utilities, wifi: e.target.checked }
                      })}
                    />
                    Wifi
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={createForm.utilities.lift}
                      onChange={(e) => setCreateForm({
                        ...createForm,
                        utilities: { ...createForm.utilities, lift: e.target.checked }
                      })}
                    />
                    Lift
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={createForm.utilities.parking}
                      onChange={(e) => setCreateForm({
                        ...createForm,
                        utilities: { ...createForm.utilities, parking: e.target.checked }
                      })}
                    />
                    Parking
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={createForm.utilities.gas}
                      onChange={(e) => setCreateForm({
                        ...createForm,
                        utilities: { ...createForm.utilities, gas: e.target.checked }
                      })}
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
      {/* Comparison Panel Modal */}
      {showComparePanel && compareList.length === 2 && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-[9998] p-6">
          <div className="bg-white rounded-lg max-w-5xl w-full overflow-auto p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Property Comparison</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => { setShowComparePanel(false); }} className="px-3 py-1 bg-gray-200 rounded">Close</button>
                <button onClick={() => { setCompareList([]); setCompareCommute([]); setShowComparePanel(false); }} className="px-3 py-1 bg-red-500 text-white rounded">Clear</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {compareList.map((listing, idx) => (
                <div key={listing._id} className="border rounded p-4">
                  <div className="flex gap-4">
                    <div className="w-40 h-28 bg-gray-100 overflow-hidden rounded">
                      {listing.photos && listing.photos[0] ? (
                        <img src={listing.photos[0]} alt="prop" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">No image</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-lg">{listing.title}</div>
                      <div className="text-sm text-gray-600">{listing.area}, {listing.city}</div>
                      <div className="mt-2 font-bold">BDT {listing.monthly_rent_bdt}</div>
                      <div className="text-sm text-gray-600">{listing.rooms || 1} rooms • {listing.property_type}</div>
                      <div className="text-xs text-gray-500 mt-2">Availability: {listing.available_from ? new Date(listing.available_from).toLocaleDateString() : 'Available Now'}</div>
                      <div className="mt-2 text-sm">Core utilities: {listing.utilities ? Object.keys(listing.utilities).filter(k=>listing.utilities[k]).join(', ') : 'N/A'}</div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <h4 className="font-semibold mb-2">Commute to selected categories</h4>
                    {compareCommute[idx] && compareCommute[idx].commute && compareCommute[idx].commute.length > 0 ? (
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="text-left">
                            <th className="p-2 border-b">Category</th>
                            {compareCommute[idx].commute.map((c, i) => (
                              <th key={i} className="p-2 border-b">{c.name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="p-2 border-t">Walking</td>
                            {compareCommute[idx].commute.map((c, i) => (
                              <td key={i} className="p-2 border-t">{c.walking?.duration || '-'}</td>
                            ))}
                          </tr>
                          <tr>
                            <td className="p-2 border-t">Rickshaw</td>
                            {compareCommute[idx].commute.map((c, i) => (
                              <td key={i} className="p-2 border-t">{c.rickshaw?.duration || c.transit?.duration || '-'}</td>
                            ))}
                          </tr>
                          <tr>
                            <td className="p-2 border-t">Car</td>
                            {compareCommute[idx].commute.map((c, i) => (
                              <td key={i} className="p-2 border-t">{c.car?.duration || '-'}</td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-sm text-gray-500">No commute data. Click Compare to refresh.</div>
                    )}
                  </div>

                  {compareCommute[idx] && compareCommute[idx].direct && (
                    <div className="mt-4 bg-gray-50 p-3 rounded text-sm">
                      <div className="font-semibold mb-1">Direct to destination</div>
                      <div>Walking: {compareCommute[idx].direct.toDestination.walking?.duration || '-'}</div>
                      <div>Car: {compareCommute[idx].direct.toDestination.car?.duration || '-'}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MapSearch;