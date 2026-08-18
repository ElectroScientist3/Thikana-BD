const stringSimilarity = require('string-similarity');
const sharp = require('sharp');
const Listing = require('../models/Listing');
const DuplicateFlag = require('../models/DuplicateFlag');

const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9\u0980-\u09ff]+/gi, ' ').trim();
const scoreText = (first, second) => Math.round(stringSimilarity.compareTwoStrings(normalize(first), normalize(second)) * 100);

function checkPhoneNumberDuplicate(phone, listings = []) {
  const normalizedPhone = normalize(phone).replace(/\s/g, '');
  if (!normalizedPhone) return 0;
  return listings.filter((listing) => normalize(listing.owner_phone).replace(/\s/g, '') === normalizedPhone).length;
}

function checkAddressSimilarity(addr1, addr2) {
  return scoreText(addr1, addr2);
}

function checkCoordinateProximity(lat1, lng1, lat2, lng2) {
  const values = [lat1, lng1, lat2, lng2].map(Number);
  if (values.some((value) => !Number.isFinite(value))) return 0;
  const [firstLat, firstLng, secondLat, secondLng] = values;
  const earthRadiusKm = 6371;
  const toRadians = (value) => value * Math.PI / 180;
  const deltaLat = toRadians(secondLat - firstLat);
  const deltaLng = toRadians(secondLng - firstLng);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(toRadians(firstLat)) * Math.cos(toRadians(secondLat)) * Math.sin(deltaLng / 2) ** 2;
  const distanceKm = earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  if (distanceKm <= 0.05) return 100;
  if (distanceKm >= 2) return 0;
  return Math.round((2 - distanceKm) / 1.95 * 100);
}

function checkTitleSimilarity(title1, title2) {
  return scoreText(title1, title2);
}

function checkDescriptionSimilarity(description1, description2) {
  return scoreText(description1, description2);
}

async function imageHash(imagePath) {
  try {
    const { data } = await sharp(imagePath).resize(16, 16).grayscale().raw().toBuffer({ resolveWithObject: true });
    return data;
  } catch (err) {
    console.error('[DuplicateDetection] image hash failed:', err.message);
    return null;
  }
}

async function checkImageSimilarity(firstImages = [], secondImages = []) {
  const firstHashes = (await Promise.all(firstImages.map(imageHash))).filter(Boolean);
  const secondHashes = (await Promise.all(secondImages.map(imageHash))).filter(Boolean);
  if (!firstHashes.length || !secondHashes.length) return 0;
  let best = 0;
  for (const first of firstHashes) {
    for (const second of secondHashes) {
      const length = Math.min(first.length, second.length);
      let equal = 0;
      for (let index = 0; index < length; index += 1) {
        if (Math.abs(first[index] - second[index]) <= 10) equal += 1;
      }
      best = Math.max(best, Math.round(equal / length * 100));
    }
  }
  return best;
}

const coordinatesOf = (listing) => listing.coords?.coordinates || [];

async function runDuplicateCheck(propertyId) {
  const listing = await Listing.findById(propertyId).lean();
  if (!listing) throw new Error('Property not found');
  const existingListings = await Listing.find({ _id: { $ne: propertyId } }).lean();
  const phoneDuplicateCount = checkPhoneNumberDuplicate(listing.owner_phone, existingListings);
  const flags = [];

  for (const existing of existingListings) {
    const [listingLng, listingLat] = coordinatesOf(listing);
    const [existingLng, existingLat] = coordinatesOf(existing);
    const scores = {
      phone: checkPhoneNumberDuplicate(listing.owner_phone, [existing]) > 0 ? 100 : 0,
      address: checkAddressSimilarity(listing.address || `${listing.area} ${listing.city}`, existing.address || `${existing.area} ${existing.city}`),
      coordinates: checkCoordinateProximity(listingLat, listingLng, existingLat, existingLng),
      title: checkTitleSimilarity(listing.title, existing.title),
      description: checkDescriptionSimilarity(listing.description, existing.description),
      images: await checkImageSimilarity(listing.images, existing.images),
    };
    let overallSimilarity = Math.round(
      scores.phone * 0.25 + scores.coordinates * 0.25 + scores.address * 0.15 + scores.title * 0.15 + scores.description * 0.10 + scores.images * 0.10
    );
    if (phoneDuplicateCount > 5) overallSimilarity = Math.max(overallSimilarity, 71);
    if (overallSimilarity <= 70) continue;

    const similarityTypes = Object.entries(scores).filter(([, score]) => score >= 70).map(([type]) => type);
    const flag = await DuplicateFlag.findOneAndUpdate(
      { propertyId: listing._id, suspectedDuplicateOf: existing._id },
      { similarityScores: scores, overallSimilarity, similarityTypes, status: 'pending_review' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    flags.push(flag);
  }

  await Listing.findByIdAndUpdate(propertyId, {
    duplicateFlagCount: flags.length,
    suspiciousScore: flags.reduce((highest, flag) => Math.max(highest, flag.overallSimilarity), 0),
  });
  return flags;
}

module.exports = {
  checkPhoneNumberDuplicate,
  checkAddressSimilarity,
  checkCoordinateProximity,
  checkTitleSimilarity,
  checkDescriptionSimilarity,
  runDuplicateCheck,
};
