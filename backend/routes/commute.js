const express = require('express');
const axios = require('axios');
const router = express.Router();

// Backend commute: use OpenStreetMap services
// - Overpass API to find nearest POIs for requested categories
// - OSRM public API to compute walking and driving durations
// Notes: Transit (public transport) is not available from OSRM; we approximate it.

const CATEGORY_TAGS = {
  transit_station: ["public_transport=station", "railway=station", "amenity=bus_station"],
  university: ["amenity=university", "place=university"],
  hospital: ["amenity=hospital"],
  supermarket: ["shop=supermarket", "amenity=marketplace"],
  mosque: ["amenity=place_of_worship"],
  restaurant: ["amenity=restaurant"],
  bank: ["amenity=bank"],
};

const overpassQueryForTag = (tag, lat, lng, radius = 2000) => {
  // tag like "amenity=hospital"
  return `[out:json][timeout:25];(node["${tag.split('=')[0]}"="${tag.split('=')[1]}"](around:${radius},${lat},${lng});way["${tag.split('=')[0]}"="${tag.split('=')[1]}"](around:${radius},${lat},${lng});relation["${tag.split('=')[0]}"="${tag.split('=')[1]}"](around:${radius},${lat},${lng}););out center;`;
};

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const OVERPASS_ENDPOINTS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

const findNearestPOI = async (lat, lng, category) => {
  const tags = CATEGORY_TAGS[category] || [];
  for (const tag of tags) {
    const q = overpassQueryForTag(tag, lat, lng);
    const params = new URLSearchParams();
    params.append('data', q);
    // try multiple endpoints to avoid transient 406s / rate-limits
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const resp = await axios.post(endpoint, params.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Thikana-BD-Commute/1.0 (+https://example.com)',
            'Accept': 'application/json'
          },
          timeout: 30000,
        });
        const elems = resp.data.elements || [];
        if (!elems || elems.length === 0) continue; // no elements from this endpoint, try next endpoint
        // Map elements to coords (node -> lat/lon, way/relation -> center)
        const mapped = elems.map((e) => {
          const elLat = e.lat || (e.center && e.center.lat);
          const elLon = e.lon || (e.center && e.center.lon);
          return { id: e.id, lat: elLat, lon: elLon, tags: e.tags || {}, name: e.tags && (e.tags.name || e.tags['operator'] || category) };
        }).filter(e => e.lat && e.lon);
        if (mapped.length === 0) continue;
        // pick nearest
        mapped.sort((a, b) => haversineKm(lat, lng, a.lat, a.lon) - haversineKm(lat, lng, b.lat, b.lon));
        return mapped[0];
      } catch (err) {
        console.error(`Overpass endpoint ${endpoint} failed for tag=${tag} category=${category}:`, err && err.message);
        // try next endpoint
        continue;
      }
    }
    // try next tag
  }
  return null;
};

const osrmTable = async (profile, src, destinations) => {
  // src: {lat,lng}, destinations: [{lat,lng},...]
  if (!destinations || destinations.length === 0) return [];
  const coords = [ `${src.lng},${src.lat}`, ...destinations.map(d => `${d.lon},${d.lat}`) ].join(';');
  const url = `https://router.project-osrm.org/table/v1/${profile}/${coords}?annotations=duration`;
  const resp = await axios.get(url, { timeout: 15000 });
  // durations is a matrix; we want the first row (source -> each destination)
  const durations = (resp.data && resp.data.durations && resp.data.durations[0]) || [];
  return durations; // seconds
};

router.get('/', async (req, res) => {
  try {
    const { lat, lng, categories = '', destLat, destLng, destination } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ msg: 'lat and lng are required' });
    }
    const origin = { lat: parseFloat(lat), lng: parseFloat(lng) };

    let bCoords = null;
    if (destLat && destLng) {
      bCoords = { lat: parseFloat(destLat), lng: parseFloat(destLng) };
    } else if (destination) {
      // Geocode destination via Nominatim
      try {
        const g = await axios.get('https://nominatim.openstreetmap.org/search', { params: { q: destination, format: 'json', limit: 1 }, timeout: 10000 });
        const p = g.data && g.data[0];
        if (p) bCoords = { lat: parseFloat(p.lat), lng: parseFloat(p.lon) };
      } catch (e) { /* ignore */ }
    }

    const catList = categories ? categories.split(',').map(s => s.trim()).filter(Boolean) : Object.keys(CATEGORY_TAGS);

    const pois = [];
    for (const cat of catList) {
      const poi = await findNearestPOI(origin.lat, origin.lng, cat);
      if (poi) pois.push({ category: cat, poi });
    }

    // If no pois found and no explicit destination provided, return empty array
    if (pois.length === 0 && !bCoords) return res.json({ commute: [] });

    // Build destinations list for OSRM (for POIs)
    const destinations = pois.map(p => ({ lat: p.poi.lat, lng: p.poi.lon }));

    // walking/driving durations to POIs (if any)
    const walkDurations = destinations.length ? await osrmTable('walking', origin, destinations) : [];
    const driveDurations = destinations.length ? await osrmTable('driving', origin, destinations) : [];

    const commute = pois.map((p, idx) => {
      const walkSec = walkDurations[idx] || null;
      const driveSec = driveDurations[idx] || null;
      // approximate transit as walking * 1.6 if walking exists, else null
      const transitSec = walkSec ? Math.round(walkSec * 1.6) : null;
      const format = (s) => (s === null || s === undefined) ? null : `${Math.round(s/60)} mins`;
      return {
        name: p.poi.name || p.category,
        walking: { duration: format(walkSec), seconds: walkSec },
        transit: { duration: format(transitSec), seconds: transitSec },
        car: { duration: format(driveSec), seconds: driveSec },
      };
    });

    // If a destination coordinate was provided, compute direct durations from origin -> destination
    let direct = null;
    if (bCoords) {
      try {
        const directWalk = await osrmTable('walking', origin, [bCoords]);
        const directDrive = await osrmTable('driving', origin, [bCoords]);
        const format = (s) => (s === null || s === undefined) ? null : `${Math.round(s/60)} mins`;
        direct = {
          toDestination: {
            walking: { duration: format(directWalk[0]), seconds: directWalk[0] || null },
            car: { duration: format(directDrive[0]), seconds: directDrive[0] || null }
          },
          destinationCoords: bCoords
        };
      } catch (e) {
        console.error('Direct osrm lookup failed', e && e.message);
      }
    }

    return res.json({ commute, direct });
  } catch (err) {
    console.error('Commute route failed', err && err.message);
    return res.status(500).json({ msg: 'Commute lookup failed' });
  }
});

module.exports = router;
