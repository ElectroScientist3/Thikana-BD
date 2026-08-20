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
  let score = 0;
  let totalWeight = 0;
  const breakdown = {};

  const budgetWeight = 25; totalWeight += budgetWeight;
  let ptsBudget = 0;
  if (prefs.minRent || prefs.maxRent) {
    const rent = listing.monthly_rent_bdt || 0;
    const min = prefs.minRent ? Number(prefs.minRent) : 0;
    const max = prefs.maxRent ? Number(prefs.maxRent) : Infinity;
    if (rent >= min && rent <= max) ptsBudget = budgetWeight;
    else {
      const range = Math.max(1, (max === Infinity ? min : (max - min)));
      const dist = rent < min ? (min - rent) : (rent - max);
      const factor = Math.max(0, 1 - (dist / (range * 2)));
      ptsBudget = budgetWeight * factor;
    }
  }
  score += ptsBudget;
  breakdown.budget = { pts: Math.round(ptsBudget), max: budgetWeight };

  const locationWeight = 20; totalWeight += locationWeight;
  let ptsLocation = 0;
  if (prefs.area && listing.area && prefs.area.toLowerCase() === listing.area.toLowerCase()) ptsLocation = locationWeight;
  else if (prefs.city && listing.city && prefs.city.toLowerCase() === listing.city.toLowerCase()) ptsLocation = locationWeight * 0.6;
  score += ptsLocation;
  breakdown.location = { pts: Math.round(ptsLocation), max: locationWeight };

  const typeWeight = 10; totalWeight += typeWeight;
  let ptsType = 0;
  if (prefs.propertyType && listing.property_type && prefs.propertyType.toLowerCase() === listing.property_type.toLowerCase()) ptsType = typeWeight;
  score += ptsType;
  breakdown.type = { pts: Math.round(ptsType), max: typeWeight };

  const roomsWeight = 10; totalWeight += roomsWeight;
  let ptsRooms = 0;
  if (prefs.rooms) {
    const desired = Number(prefs.rooms);
    const rooms = listing.rooms || 0;
    if (rooms === desired) ptsRooms = roomsWeight;
    else if (rooms > desired) ptsRooms = roomsWeight * 0.8;
    else ptsRooms = roomsWeight * Math.max(0, (rooms / desired));
  }
  score += ptsRooms;
  breakdown.rooms = { pts: Math.round(ptsRooms), max: roomsWeight };

  const moveInWeight = 10; totalWeight += moveInWeight;
  let ptsMoveIn = 0;
  if (prefs.moveInDate) {
    const desired = new Date(prefs.moveInDate);
    const available = listing.available_from ? new Date(listing.available_from) : new Date(0);
    if (available <= desired) ptsMoveIn = moveInWeight;
    else {
      const days = Math.ceil((available - desired) / (1000 * 60 * 60 * 24));
      if (days <= 7) ptsMoveIn = moveInWeight * 0.8;
      else if (days <= 30) ptsMoveIn = moveInWeight * 0.5;
    }
  }
  score += ptsMoveIn;
  breakdown.moveIn = { pts: Math.round(ptsMoveIn), max: moveInWeight };

  const utilWeight = 12; totalWeight += utilWeight;
  if (prefs.features) {
    const want = Object.keys(prefs.features).filter(k => prefs.features[k]);
    if (want.length > 0) {
      let matched = 0;
      want.forEach((f) => { if (listing.utilities && listing.utilities[f]) matched += 1; });
      const pts = utilWeight * (matched / want.length);
      score += pts;
      breakdown.utilities = { pts, max: utilWeight };
    } else {
      breakdown.utilities = { pts: 0, max: utilWeight };
    }
  } else {
    breakdown.utilities = { pts: 0, max: utilWeight };
  }

  // Distance preference (optional) - reward closer listings to a reference point
  const distanceWeight = 15; totalWeight += distanceWeight;
  if (referencePoint && listing.coords && Array.isArray(listing.coords.coordinates)) {
    const [lng, lat] = listing.coords.coordinates;
    const dkm = haversineKm(referencePoint.lat, referencePoint.lng, lat, lng);
    // score full points if within 1km, linear decay to 0 at 10km
    const pts = Math.max(0, 1 - Math.min(dkm / 10, 1)) * distanceWeight;
    score += pts;
    breakdown.distance = { pts: Math.round(pts), max: distanceWeight, km: Number(dkm.toFixed(2)) };
  } else {
    breakdown.distance = { pts: 0, max: distanceWeight };
  }

  // final normalization
  const normalized = Math.round((score / (totalWeight || 1)) * 100);
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
