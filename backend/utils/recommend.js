// Recommendation utilities: scoring and selection
function computeMatchScore(listing, prefs) {
  let score = 0;
  let totalWeight = 0;

  const budgetWeight = 25;
  totalWeight += budgetWeight;
  if (prefs.minRent || prefs.maxRent) {
    const rent = listing.monthly_rent_bdt || 0;
    const min = prefs.minRent ? Number(prefs.minRent) : 0;
    const max = prefs.maxRent ? Number(prefs.maxRent) : Infinity;
    if (rent >= min && rent <= max) {
      score += budgetWeight;
    } else {
      const range = Math.max(1, (max === Infinity ? min : (max - min)));
      const dist = rent < min ? (min - rent) : (rent - max);
      const factor = Math.max(0, 1 - (dist / (range * 2)));
      score += budgetWeight * factor;
    }
  }

  const locationWeight = 20;
  totalWeight += locationWeight;
  if (prefs.area && listing.area && prefs.area.toLowerCase() === listing.area.toLowerCase()) {
    score += locationWeight;
  } else if (prefs.city && listing.city && prefs.city.toLowerCase() === listing.city.toLowerCase()) {
    score += locationWeight * 0.6;
  }

  const typeWeight = 10;
  totalWeight += typeWeight;
  if (prefs.propertyType && listing.property_type && prefs.propertyType.toLowerCase() === listing.property_type.toLowerCase()) {
    score += typeWeight;
  }

  const roomsWeight = 10;
  totalWeight += roomsWeight;
  if (prefs.rooms) {
    const desired = Number(prefs.rooms);
    const rooms = listing.rooms || 0;
    if (rooms === desired) score += roomsWeight;
    else if (rooms > desired) score += roomsWeight * 0.8;
    else score += roomsWeight * Math.max(0, (rooms / desired));
  }

  const moveInWeight = 10;
  totalWeight += moveInWeight;
  if (prefs.moveInDate) {
    const desired = new Date(prefs.moveInDate);
    const available = listing.available_from ? new Date(listing.available_from) : new Date(0);
    if (available <= desired) score += moveInWeight;
    else {
      const days = Math.ceil((available - desired) / (1000 * 60 * 60 * 24));
      if (days <= 7) score += moveInWeight * 0.8;
      else if (days <= 30) score += moveInWeight * 0.5;
    }
  }

  const utilWeight = 15;
  totalWeight += utilWeight;
  if (prefs.features) {
    const want = Object.keys(prefs.features).filter(k => prefs.features[k]);
    if (want.length > 0) {
      let matched = 0;
      want.forEach((f) => {
        if (f === 'furnished') {
          // no-op
        } else if (listing.utilities && listing.utilities[f]) matched += 1;
      });
      score += utilWeight * (matched / want.length);
    }
  }

  const normalized = Math.round((score / totalWeight) * 100);
  return normalized;
}

function recommendListings(prefs, candidates, limit = 20) {
  const scored = candidates.map(listing => ({ listing, score: computeMatchScore(listing, prefs) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => ({ ...s.listing, matchScore: s.score }));
}

module.exports = {
  computeMatchScore,
  recommendListings
};
