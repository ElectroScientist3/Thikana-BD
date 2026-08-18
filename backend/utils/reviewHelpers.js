const Review = require('../models/Review');
const Listing = require('../models/Listing');

const categoryFields = ['listingAccuracy', 'ownerCommunication', 'cleanliness', 'safety', 'location', 'valueForMoney'];

async function updatePropertyRating(propertyId) {
  const reviews = await Review.find({ propertyId, status: 'active' }).lean();
  const ratingBreakdown = { five: 0, four: 0, three: 0, two: 0, one: 0 };
  const categoryAverages = Object.fromEntries(categoryFields.map((field) => [field, 0]));
  reviews.forEach((review) => {
    const bucket = ['one', 'two', 'three', 'four', 'five'][Math.round(review.overallRating) - 1];
    if (bucket) ratingBreakdown[bucket] += 1;
    categoryFields.forEach((field) => { categoryAverages[field] += Number(review.ratings[field]) || 0; });
  });
  if (reviews.length) categoryFields.forEach((field) => { categoryAverages[field] = Math.round(categoryAverages[field] / reviews.length * 10) / 10; });
  const averageRating = reviews.length ? Math.round(reviews.reduce((sum, review) => sum + review.overallRating, 0) / reviews.length * 10) / 10 : 0;
  return Listing.findByIdAndUpdate(propertyId, { averageRating, totalReviews: reviews.length, ratingBreakdown, categoryAverages }, { new: true });
}

module.exports = { updatePropertyRating, categoryFields };
