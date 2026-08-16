const test = require('node:test');
const assert = require('node:assert').strict;
const { computeMatchScore, recommendListings } = require('../utils/recommend');

test('computeMatchScore gives higher score for exact matches', () => {
  const listing = {
    monthly_rent_bdt: 15000,
    city: 'Dhaka',
    area: 'Mirpur',
    property_type: 'flat',
    rooms: 2,
    available_from: new Date(),
    utilities: { wifi: true, lift: false, parking: true }
  };

  const prefsExact = { minRent: 10000, maxRent: 20000, city: 'Dhaka', area: 'Mirpur', propertyType: 'flat', rooms: 2, features: { wifi: true, parking: true } };
  const prefsMismatch = { minRent: 20000, maxRent: 30000, city: 'Chittagong', area: 'Somewhere', propertyType: 'house', rooms: 4, features: { wifi: false } };

  const scoreExact = computeMatchScore(listing, prefsExact);
  const scoreMismatch = computeMatchScore(listing, prefsMismatch);

  assert.ok(scoreExact > scoreMismatch, `expected ${scoreExact} > ${scoreMismatch}`);
});

test('recommendListings returns top results sorted by score', () => {
  const candidates = [
    { _id: 'a', monthly_rent_bdt: 10000, city: 'Dhaka', area: 'Mirpur', property_type: 'flat', rooms: 1, utilities: { wifi: true } },
    { _id: 'b', monthly_rent_bdt: 20000, city: 'Dhaka', area: 'Gulshan', property_type: 'flat', rooms: 2, utilities: { wifi: true, parking: true } },
    { _id: 'c', monthly_rent_bdt: 15000, city: 'Chittagong', area: 'Pahartali', property_type: 'house', rooms: 3, utilities: {} }
  ];

  const prefs = { minRent: 9000, maxRent: 21000, city: 'Dhaka', features: { wifi: true } };

  const recs = recommendListings(prefs, candidates, 3);
  assert.equal(recs.length, 3);
  // first result should be either 'b' or 'a' (Dhaka + wifi)
  assert.ok(['a', 'b'].includes(recs[0]._id));
  // ensure descending order
  for (let i = 1; i < recs.length; i++) {
    assert.ok(recs[i-1].matchScore >= recs[i].matchScore);
  }
});
