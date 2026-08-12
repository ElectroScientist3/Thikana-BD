const express = require('express');
const router = express.Router();
const axios = require('axios');

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_KEY;
if (!GOOGLE_API_KEY) {
  console.warn('GOOGLE_MAPS_KEY is not set; /api/commute will not work without it.');
}

const DESTINATION_TYPES = {
  transit_station: 'Transit',
  university: 'University',
  hospital: 'Hospital',
  supermarket: 'Market',
  mosque: 'Mosque',
  restaurant: 'Restaurant',
  bank: 'Bank',
};

router.get('/', async (req, res) => {
  const { lat, lng, categories, destination } = req.query;
  if (!lat || !lng) return res.status(400).json({ msg: 'lat and lng are required' });
  if (!GOOGLE_API_KEY) return res.status(500).json({ msg: 'Server missing GOOGLE_MAPS_KEY' });

  const categoryList = (categories || 'transit_station,university,hospital,supermarket')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);

  const nearbyResults = [];

  try {
    for (const type of categoryList) {
      const response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
        params: {
          key: GOOGLE_API_KEY,
          location: `${lat},${lng}`,
          radius: 3000,
          type,
        },
      });
      const result = response.data.results?.[0];
      if (result) {
        nearbyResults.push({
          category: DESTINATION_TYPES[type] || type,
          name: result.name,
          vicinity: result.vicinity,
          location: result.geometry.location,
        });
      }
    }

    const destinations = [];
    if (destination) {
      const placeRes = await axios.get('https://maps.googleapis.com/maps/api/place/findplacefromtext/json', {
        params: {
          key: GOOGLE_API_KEY,
          input: destination,
          inputtype: 'textquery',
          fields: 'formatted_address,geometry,name',
        },
      });
      const candidate = placeRes.data.candidates?.[0];
      if (candidate) {
        destinations.push({
          category: 'Custom',
          name: candidate.name || destination,
          vicinity: candidate.formatted_address,
          location: candidate.geometry.location,
        });
      }
    }

    const allPlaces = [...nearbyResults, ...destinations];
    if (allPlaces.length === 0) return res.json({ commute: [] });

    const origin = `${lat},${lng}`;
    const destinationsParam = allPlaces.map((p) => `${p.location.lat},${p.location.lng}`).join('|');

    const matrixRes = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
      params: {
        key: GOOGLE_API_KEY,
        origins: origin,
        destinations: destinationsParam,
        mode: 'walking',
        units: 'metric',
      },
    });

    const walkingElements = matrixRes.data.rows?.[0]?.elements || [];

    const transitRes = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
      params: {
        key: GOOGLE_API_KEY,
        origins: origin,
        destinations: destinationsParam,
        mode: 'transit',
        units: 'metric',
      },
    });

    const transitElements = transitRes.data.rows?.[0]?.elements || [];

    const commute = allPlaces.map((place, index) => ({
      category: place.category,
      name: place.name,
      vicinity: place.vicinity,
      walking: walkingElements[index]?.status === 'OK'
        ? {
            duration: walkingElements[index].duration.text,
            distance: walkingElements[index].distance.text,
          }
        : null,
      transit: transitElements[index]?.status === 'OK'
        ? {
            duration: transitElements[index].duration.text,
            distance: transitElements[index].distance.text,
          }
        : null,
    }));

    res.json({ commute });
  } catch (error) {
    console.error('Commute error', error.response?.data || error.message);
    res.status(500).json({ msg: 'Unable to compute commute data' });
  }
});

module.exports = router;
