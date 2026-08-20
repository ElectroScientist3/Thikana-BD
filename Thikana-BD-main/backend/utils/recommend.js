// Recommendation utilities: scoring and selection
function computeMatchScore(listing, prefs) {
  let activeExpectations = 0;
  let matchedExpectations = 0;

  // 1. Budget (Max Rent)
  if (prefs.maxRent && Number(prefs.maxRent) > 0) {
    activeExpectations++;
    const maxRent = Number(prefs.maxRent);
    if (listing.monthly_rent_bdt && listing.monthly_rent_bdt <= maxRent) {
      matchedExpectations++;
    }
  }

  // 1.1 Min Rent (Optional helper)
  if (prefs.minRent && Number(prefs.minRent) > 0) {
    activeExpectations++;
    const minRent = Number(prefs.minRent);
    if (listing.monthly_rent_bdt && listing.monthly_rent_bdt >= minRent) {
      matchedExpectations++;
    }
  }

  // 2. Preferred Area
  if (prefs.area && prefs.area.trim() !== '') {
    activeExpectations++;
    if (listing.area && listing.area.toLowerCase().includes(prefs.area.toLowerCase())) {
      matchedExpectations++;
    }
  }

  // 2.1 City (Optional helper)
  if (prefs.city && prefs.city.trim() !== '') {
    activeExpectations++;
    if (listing.city && listing.city.toLowerCase() === prefs.city.toLowerCase()) {
      matchedExpectations++;
    }
  }

  // 3. Home Type (Property Type)
  const pType = prefs.propertyType || prefs.property_type;
  if (pType && pType.trim() !== '') {
    activeExpectations++;
    if (listing.property_type && listing.property_type.toLowerCase() === pType.toLowerCase()) {
      matchedExpectations++;
    }
  }

  // 4. Number of rooms
  if (prefs.rooms && Number(prefs.rooms) > 0) {
    activeExpectations++;
    if (listing.rooms === Number(prefs.rooms)) {
      matchedExpectations++;
    }
  }

  // 5. Move-in date
  const mDate = prefs.moveInDate || prefs.move_in_date;
  if (mDate && mDate.trim() !== '') {
    activeExpectations++;
    if (listing.available_from && new Date(listing.available_from) <= new Date(mDate)) {
      matchedExpectations++;
    }
  }

  // Utilities / features: wifi, lift, parking, furnished, generator
  const features = ['wifi', 'lift', 'parking', 'furnished', 'generator'];
  features.forEach((feature) => {
    // Check if user expects this facility (checked true in either prefs.features or top-level prefs)
    const expected = (prefs.features && prefs.features[feature] === true) || (prefs[feature] === true);
    if (expected) {
      activeExpectations++;
      if (listing.utilities && listing.utilities[feature] === true) {
        matchedExpectations++;
      }
    }
  });

  // If no expectations are set, default to 100%
  if (activeExpectations === 0) {
    return 100;
  }
  return Math.round((matchedExpectations / activeExpectations) * 100);
}

function recommendListings(prefs, candidates, limit = 20) {
  const scored = candidates.map(listing => {
    const listingObj = listing.toObject ? listing.toObject() : listing;
    return { listing: listingObj, score: computeMatchScore(listingObj, prefs) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => ({ ...s.listing, matchScore: s.score }));
}

module.exports = {
  computeMatchScore,
  recommendListings
};
