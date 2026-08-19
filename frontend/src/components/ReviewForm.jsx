import { useEffect, useMemo, useState } from 'react';
import { getReviewEligibility, submitReview } from '../services/reviewApi';

const fields = [
  ['listingAccuracy', 'Listing accuracy', 'Did the property match its description?'],
  ['ownerCommunication', 'Owner communication', 'How clear and responsive was the owner?'],
  ['cleanliness', 'Cleanliness', 'How clean was the property?'],
  ['safety', 'Safety', 'How safe did the property and area feel?'],
  ['location', 'Location', 'How convenient was the location?'],
  ['valueForMoney', 'Value for money', 'Was the property worth its price?'],
];

function ReviewForm({ propertyId, onSubmitted }) {
  const [eligibility, setEligibility] = useState(null);
  const [ratings, setRatings] = useState(Object.fromEntries(fields.map(([key]) => [key, 0])));
  const [reviewText, setReviewText] = useState('');
  const [photos, setPhotos] = useState([]);
  const [wouldRecommend, setWouldRecommend] = useState(true);
  const [rentedDuration, setRentedDuration] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getReviewEligibility(propertyId)
      .then((response) => setEligibility(response.data))
      .catch((error) => setMessage(error.response?.data?.msg || 'Unable to check review eligibility.'))
      .finally(() => setLoading(false));
  }, [propertyId]);

  const overall = useMemo(() => {
    const values = Object.values(ratings).filter(Boolean);
    return values.length ? (values.reduce((sum, value) => sum + value, 0) / fields.length).toFixed(1) : '0.0';
  }, [ratings]);

  const handlePhotos = (event) => {
    const selected = Array.from(event.target.files || []);
    if (selected.length > 3 || selected.some((file) => !['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setMessage('Choose up to 3 JPG or PNG photos under 5MB each.');
      return;
    }
    setPhotos(selected);
    setMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (Object.values(ratings).some((value) => value < 1) || (reviewText && reviewText.length < 50)) {
      setMessage('Choose all ratings and write at least 50 characters if adding review text.');
      return;
    }
    setWorking(true);
    setMessage('');
    const formData = new FormData();
    formData.append('propertyId', propertyId);
    fields.forEach(([key]) => formData.append(key, ratings[key]));
    formData.append('wouldRecommend', String(wouldRecommend));
    formData.append('reviewText', reviewText);
    if (rentedDuration) formData.append('rentedDuration', rentedDuration);
    photos.forEach((photo) => formData.append('photos', photo));
    try {
      await submitReview(formData);
      setMessage('Review submitted successfully.');
      if (onSubmitted) onSubmitted();
    } catch (error) {
      setMessage(error.response?.data?.msg || 'Unable to submit review.');
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Checking review eligibility...</div>;
  if (!eligibility?.eligible) return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">You need to view or rent this property first{eligibility?.alreadyReviewed ? ' You have already reviewed it.' : '.'}</div>;

  return <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-xl font-bold text-slate-900">Share your experience</h3><p className="text-sm text-slate-500">Your review helps other tenants make informed decisions.</p></div><div className="text-right"><div className="text-3xl font-bold text-amber-500">{overall}/5</div><div className="text-xs text-slate-500">Current average</div></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{fields.map(([key, label, tooltip]) => <div key={key} className="rounded-xl bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><label className="text-sm font-semibold text-slate-700" title={tooltip}>{label} ⓘ</label><span className="text-xs text-slate-500">{ratings[key] || 0}/5</span></div><div className="mt-2 flex gap-1">{[1, 2, 3, 4, 5].map((star) => <button type="button" key={star} onClick={() => setRatings((current) => ({ ...current, [key]: star }))} className={`text-2xl leading-none ${star <= ratings[key] ? 'text-amber-400' : 'text-slate-300'}`} aria-label={`${label} ${star} stars`}>★</button>)}</div></div>)}</div><textarea value={reviewText} onChange={(event) => setReviewText(event.target.value.slice(0, 500))} minLength={reviewText ? 50 : undefined} placeholder="Tell future tenants what they should know (optional, 50-500 characters)" rows={4} className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500" /><div className="mt-1 text-right text-xs text-slate-500">{reviewText.length}/500</div><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="rounded-xl border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-700">Photos (max 3)<input type="file" accept="image/jpeg,image/png" multiple onChange={handlePhotos} className="mt-2 block w-full text-xs" />{photos.length > 0 && <span className="mt-2 block text-xs text-emerald-700">{photos.length} photo(s) selected</span>}</label><div className="rounded-xl border border-slate-200 p-4"><div className="text-sm font-semibold text-slate-700">Would you recommend?</div><button type="button" onClick={() => setWouldRecommend((current) => !current)} className={`mt-3 rounded-full px-4 py-2 text-sm font-semibold ${wouldRecommend ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{wouldRecommend ? 'Yes, I recommend it' : 'No recommendation'}</button>{eligibility.reviewType === 'rented' && <select value={rentedDuration} onChange={(event) => setRentedDuration(event.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Rented duration</option><option value="less_than_3_months">Less than 3 months</option><option value="3_to_6_months">3 to 6 months</option><option value="6_to_12_months">6 to 12 months</option><option value="more_than_1_year">More than 1 year</option></select>}</div></div>{message && <div className={`mt-4 rounded-xl p-3 text-sm ${message.includes('successfully') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{message}</div>}<button type="submit" disabled={working} className="mt-5 rounded-xl bg-indigo-700 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{working ? 'Submitting...' : 'Submit review'}</button></form>;
}

export default ReviewForm;
