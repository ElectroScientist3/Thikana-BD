// Frontend recommendation scoring (lightweight, mirrors backend logic)
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function computeMatchWithBreakdown(listing, prefs = {}, referencePoint = null) {
  let activeExpectations = 0;
  let matchedExpectations = 0;
  const breakdown = {};

  // 1. Budget (Max Rent)
  if (prefs.maxRent && Number(prefs.maxRent) > 0) {
    activeExpectations++;
    const maxRent = Number(prefs.maxRent);
    const matched = listing.monthly_rent_bdt && listing.monthly_rent_bdt <= maxRent;
    if (matched) matchedExpectations++;
    breakdown.budget = { pts: matched ? 1 : 0, max: 1 };
  }

  // 1.1 Min Rent (Optional helper)
  if (prefs.minRent && Number(prefs.minRent) > 0) {
    activeExpectations++;
    const minRent = Number(prefs.minRent);
    const matched = listing.monthly_rent_bdt && listing.monthly_rent_bdt >= minRent;
    if (matched) matchedExpectations++;
  }

  // 2. Preferred Area
  if (prefs.area && prefs.area.trim() !== '') {
    activeExpectations++;
    const matched = listing.area && listing.area.toLowerCase().includes(prefs.area.toLowerCase());
    if (matched) matchedExpectations++;
    breakdown.location = { pts: matched ? 1 : 0, max: 1 };
  }

  // 2.1 City (Optional helper)
  if (prefs.city && prefs.city.trim() !== '') {
    activeExpectations++;
    const matched = listing.city && listing.city.toLowerCase() === prefs.city.toLowerCase();
    if (matched) matchedExpectations++;
  }

  // 3. Home Type (Property Type)
  const pType = prefs.propertyType || prefs.property_type;
  if (pType && pType.trim() !== '') {
    activeExpectations++;
    const matched = listing.property_type && listing.property_type.toLowerCase() === pType.toLowerCase();
    if (matched) matchedExpectations++;
    breakdown.type = { pts: matched ? 1 : 0, max: 1 };
  }

  // 4. Number of rooms
  if (prefs.rooms && Number(prefs.rooms) > 0) {
    activeExpectations++;
    const matched = listing.rooms === Number(prefs.rooms);
    if (matched) matchedExpectations++;
    breakdown.rooms = { pts: matched ? 1 : 0, max: 1 };
  }

  // 5. Move-in date
  const mDate = prefs.moveInDate || prefs.move_in_date;
  if (mDate && mDate.trim() !== '') {
    activeExpectations++;
    const matched = listing.available_from && new Date(listing.available_from) <= new Date(mDate);
    if (matched) matchedExpectations++;
    breakdown.moveIn = { pts: matched ? 1 : 0, max: 1 };
  }

  // Utilities / features: wifi, lift, parking, furnished, generator
  const features = ['wifi', 'lift', 'parking', 'furnished', 'generator'];
  let totalFeaturesActive = 0;
  let totalFeaturesMatched = 0;

  features.forEach((feature) => {
    const expected = (prefs.features && prefs.features[feature] === true) || (prefs[feature] === true);
    if (expected) {
      activeExpectations++;
      totalFeaturesActive++;
      const matched = listing.utilities && listing.utilities[feature] === true;
      if (matched) {
        matchedExpectations++;
        totalFeaturesMatched++;
      }
    }
  });

  if (totalFeaturesActive > 0) {
    breakdown.utilities = { pts: totalFeaturesMatched, max: totalFeaturesActive };
  }

  // Optional distance preference (optional reference point support)
  if (referencePoint && listing.coords && Array.isArray(listing.coords.coordinates)) {
    const [lng, lat] = listing.coords.coordinates;
    const dkm = haversineKm(referencePoint.lat, referencePoint.lng, lat, lng);
    breakdown.distance = { km: Number(dkm.toFixed(2)) };
  }

  const normalized = activeExpectations === 0 ? 100 : Math.round((matchedExpectations / activeExpectations) * 100);
  return { matchScore: normalized, breakdown };
}

export function topRecommendations(listings, prefs, limit = 5, referencePoint = null) {
  const scored = (listings || []).map((l) => {
    const { matchScore, breakdown } = computeMatchWithBreakdown(l, prefs, referencePoint);
    return { ...l, matchScore, breakdown };
  });
  scored.sort((a,b) => (b.matchScore || 0) - (a.matchScore || 0));
  return scored.slice(0, limit);
}
