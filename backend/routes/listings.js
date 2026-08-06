const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');

router.get('/', async (req, res) => {
  try {
    const q = {};
    if (req.query.min_rent) q.monthly_rent_bdt = { ...(q.monthly_rent_bdt || {}), $gte: Number(req.query.min_rent) };
    if (req.query.max_rent) q.monthly_rent_bdt = { ...(q.monthly_rent_bdt || {}), $lte: Number(req.query.max_rent) };
    if (req.query.property_type) q.property_type = req.query.property_type;
    if (req.query.city) q.city = req.query.city;
    if (req.query.area) q.area = req.query.area;

    if (req.query.neLat && req.query.neLng && req.query.swLat && req.query.swLng) {
      const ne = [Number(req.query.neLng), Number(req.query.neLat)];
      const sw = [Number(req.query.swLng), Number(req.query.swLat)];
      q.coords = {
        $geoWithin: {
          $box: [sw, ne],
        },
      };
    }

    const listings = await Listing.find(q).limit(100);
    res.json(listings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/seed', async (req, res) => {
  try {
    const count = await Listing.countDocuments();
    if (count > 0) return res.json({ seeded: false, msg: 'Listings already exist' });

    const sample = [
      {
        title: '1BR Furnished Flat in Mirpur',
        description: 'Cozy 1 bedroom flat near Mirpur-10 market',
        city: 'Dhaka',
        area: 'Mirpur',
        monthly_rent_bdt: 12000,
        advance_bdt: 36000,
        property_type: 'flat',
        rooms: 1,
        available_from: new Date(),
        coords: { type: 'Point', coordinates: [90.3563, 23.8225] },
        images: [],
        utilities: { wifi: true, lift: false, parking: false, gas: true, water: true, electricity: 'meter' },
      },
      {
        title: '2BR Apartment in Uttara',
        description: 'Spacious 2BR with balcony, near Uttara bus stop',
        city: 'Dhaka',
        area: 'Uttara',
        monthly_rent_bdt: 25000,
        advance_bdt: 75000,
        property_type: 'apartment',
        rooms: 2,
        available_from: new Date(),
        coords: { type: 'Point', coordinates: [90.3790, 23.8744] },
        images: [],
        utilities: { wifi: true, lift: true, parking: true, gas: true, water: true, electricity: 'meter' },
      },
      {
        title: 'Bachelor Room in Dhanmondi',
        description: 'Single room with shared bathroom and kitchen',
        city: 'Dhaka',
        area: 'Dhanmondi',
        monthly_rent_bdt: 8000,
        advance_bdt: 24000,
        property_type: 'bachelor_room',
        rooms: 1,
        available_from: new Date(),
        coords: { type: 'Point', coordinates: [90.3769, 23.7465] },
        images: [],
        utilities: { wifi: false, lift: false, parking: false, gas: false, water: true, electricity: 'shared' },
      },
    ];

    await Listing.insertMany(sample);
    res.json({ seeded: true, inserted: sample.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Seed error' });
  }
});

module.exports = router;
