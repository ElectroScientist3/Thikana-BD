import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
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
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const searchMarkerRef = useRef(null);
  const [listings, setListings] = useState([]);
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
  const [loading, setLoading] = useState(false);
  const [mapError, setMapError] = useState("");
  const navigate = useNavigate();

  const safeListings = Array.isArray(listings) ? listings : [];

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
      fetchListings({
        neLat: bounds.getNorthEast().lat,
        neLng: bounds.getNorthEast().lng,
        swLat: bounds.getSouthWest().lat,
        swLng: bounds.getSouthWest().lng,
      });
    });

    fetchListings();

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

  const fetchListings = async (bbox) => {
    setLoading(true);
    setMapError("");

    try {
      const params = {};
      if (filters.min) params.min_rent = filters.min;
      if (filters.max) params.max_rent = filters.max;
      if (filters.property_type) params.property_type = filters.property_type;
      if (bbox) {
        params.neLat = bbox.neLat;
        params.neLng = bbox.neLng;
        params.swLat = bbox.swLat;
        params.swLng = bbox.swLng;
      }

      const res = await axios.get('/api/listings', { params });
      const data = Array.isArray(res.data) ? res.data : [];
      setListings(data);
      placeMarkers(data);
    } catch (error) {
      console.error('fetchListings failed', error);
      setMapError('Unable to load listings.');
    } finally {
      setLoading(false);
    }
  };

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
        console.error('Commute API failed', err);
        setCommuteInfo([]);
      });
  }, [selected, poiCategories, destination]);

  const applyFilters = () => {
    const bounds = mapInstance.current?.getBounds();
    if (bounds) {
      fetchListings({
        neLat: bounds.getNorthEast().lat,
        neLng: bounds.getNorthEast().lng,
        swLat: bounds.getSouthWest().lat,
        swLng: bounds.getSouthWest().lng,
      });
    } else {
      fetchListings();
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
        fetchListings({
          neLat: bounds.getNorthEast().lat,
          neLng: bounds.getNorthEast().lng,
          swLat: bounds.getSouthWest().lat,
          swLng: bounds.getSouthWest().lng,
        });
      }
    } catch (error) {
      console.error('Search failed', error);
      setMapError('Search failed.');
    }
  };

  return (
    <div className="p-4 h-screen flex gap-4">
      <aside className="w-80 bg-white rounded shadow p-4 overflow-auto">
        <h3 className="font-semibold mb-2">Filters</h3>

        <div className="mb-2">
          <label className="block text-sm">Min Rent (BDT)</label>
          <input
            type="number"
            value={filters.min}
            onChange={(e) => setFilters((prev) => ({ ...prev, min: e.target.value }))}
            className="w-full border px-2 py-1 rounded"
          />
        </div>

        <div className="mb-2">
          <label className="block text-sm">Max Rent (BDT)</label>
          <input
            type="number"
            value={filters.max}
            onChange={(e) => setFilters((prev) => ({ ...prev, max: e.target.value }))}
            className="w-full border px-2 py-1 rounded"
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
            <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded">
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
          <button type="button" onClick={applyFilters} className="px-3 py-2 bg-blue-600 text-white rounded">
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters({ min: '', max: '', property_type: '', wifi: false, lift: false, parking: false, furnished: false });
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
              fetchListings();
            }}
            className="px-3 py-2 bg-gray-200 rounded"
          >
            Reset
          </button>
        </div>

        <hr className="my-3" />
        <div>
          <h4 className="font-semibold mb-2">Results ({safeListings.length})</h4>
          {loading && <div className="text-sm text-gray-500 mb-2">Loading...</div>}
          <div className="space-y-2">
            {safeListings.map((listing) => (
              <div
                key={listing._id}
                onClick={() => setSelected(listing)}
                className="p-2 border rounded hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold">{listing.title}</div>
                    <div className="text-sm text-gray-600">{listing.area}, {listing.city}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">BDT {listing.monthly_rent_bdt}</div>
                    <div className="text-sm text-gray-500">{listing.rooms || 1} rooms</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col relative">
        <div className="flex items-center gap-2 mb-2">
          <button type="button" onClick={() => navigate('/dashboard')} className="px-3 py-1 bg-gray-200 rounded">
            Back
          </button>
          <div className="text-sm text-gray-600">Use the map to select an area. Click markers for details.</div>
        </div>

        {mapError ? (
          <div className="flex-1 rounded shadow bg-red-50 border border-red-200 p-4 text-red-700">
            <p className="font-semibold">Map error</p>
            <p>{mapError}</p>
          </div>
        ) : (
          <div ref={mapRef} className="flex-1 rounded shadow bg-gray-100 min-h-[420px]" />
        )}

        {selected ? (
          <div className="mt-4 p-4 bg-white rounded shadow">
            <h3 className="text-xl font-semibold mb-2">{selected.title}</h3>
            <div className="text-sm text-gray-600 mb-2">{selected.area}, {selected.city}</div>
            <div className="mb-2">
              <div className="font-bold text-2xl">BDT {selected.monthly_rent_bdt}</div>
              <div className="text-sm text-gray-600">Advance: BDT {selected.advance_bdt || '—'}</div>
            </div>
            <div className="mb-2">Type: <strong>{selected.property_type}</strong> • Rooms: <strong>{selected.rooms || 1}</strong></div>
            <div className="mb-2">Available from: {selected.available_from ? new Date(selected.available_from).toLocaleDateString() : 'Immediate'}</div>
            <div className="mb-3">
              <h4 className="font-semibold">Utilities</h4>
              <ul className="text-sm text-gray-700">
                <li>Wifi: {selected.utilities?.wifi ? 'Yes' : 'No'}</li>
                <li>Lift: {selected.utilities?.lift ? 'Yes' : 'No'}</li>
                <li>Parking: {selected.utilities?.parking ? 'Yes' : 'No'}</li>
                <li>Gas: {selected.utilities?.gas ? 'Yes' : 'No'}</li>
                <li>Electricity: {selected.utilities?.electricity || 'N/A'}</li>
              </ul>
            </div>
            <div className="mb-3">
              <h4 className="font-semibold">Nearby & Commute</h4>
              {commuteInfo.length === 0 ? (
                <p className="text-sm text-gray-600">Nearby points of interest and commute times will be shown here once a listing is selected.</p>
              ) : (
                <div className="space-y-3">
                  {commuteInfo.map((c, i) => (
                    <div key={i} className="border rounded p-2">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="font-semibold">{c.category}</div>
                          <div className="text-sm text-gray-600">{c.name}</div>
                          <div className="text-xs text-gray-500">{c.vicinity}</div>
                        </div>
                        <div className="text-right text-sm">
                          {c.walking ? <div>Walk: <strong>{c.walking.duration}</strong></div> : <div className="text-gray-400">Walk: N/A</div>}
                          {c.transit ? <div>Transit: <strong>{c.transit.duration}</strong></div> : <div className="text-gray-400">Transit: N/A</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" className="flex-1 px-4 py-2 bg-green-600 text-white rounded">Confirm</button>
              <button type="button" onClick={() => setSelected(null)} className="px-4 py-2 bg-gray-200 rounded">Close</button>
            </div>
          </div>
        ) : (
          <div className="mt-4 text-center text-gray-600">Select a listing to see details.</div>
        )}
      </div>
    </div>
  );
}

export default MapSearch;
