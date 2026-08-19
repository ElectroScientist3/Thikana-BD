import { useEffect, useState } from 'react';
import { getPropertyReviews, markReviewHelpful, reportReview } from '../services/reviewApi';
import { useAuth } from '../context/AuthContext';

const stars = (value) => '★★★★★'.split('').map((star, index) => <span key={`${star}-${index}`} className={index < Math.round(value) ? 'text-amber-400' : 'text-slate-300'}>{star}</span>);

function ReviewList({ propertyId, refreshKey = 0 }) {
  const { token } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0 });
  const [sort, setSort] = useState('recent');
  const [rating, setRating] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const response = await getPropertyReviews(propertyId, { page, sort, rating: rating || undefined });
      setReviews(response.data.reviews || []);
      setPagination(response.data.pagination || { page, totalPages: 0 });
    } catch (error) {
      setMessage(error.response?.data?.msg || 'Unable to load reviews.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, [propertyId, refreshKey, sort, rating]);

  const helpful = async (id) => {
    if (!token) return setMessage('Log in to mark reviews helpful.');
    const response = await markReviewHelpful(id);
    setReviews((current) => current.map((review) => review._id === id ? { ...review, helpfulCount: response.data.helpfulCount } : review));
  };

  const report = async (id) => {
    if (!token) return setMessage('Log in to report a review.');
    if (!window.confirm('Report this review for moderation?')) return;
    await reportReview(id);
    setMessage('Review reported for moderation.');
  };

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h3 className="text-xl font-bold text-slate-900">Tenant reviews</h3><p className="text-sm text-slate-500">Honest experiences from verified viewers and renters.</p></div><div className="flex gap-2"><select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="recent">Recent</option><option value="highest">Highest rated</option><option value="lowest">Lowest rated</option><option value="helpful">Most helpful</option></select><select value={rating} onChange={(event) => setRating(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">All stars</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}</select></div></div>{message && <div className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-700">{message}</div>}{loading ? <div className="py-10 text-center text-sm text-slate-500">Loading reviews...</div> : reviews.length === 0 ? <div className="py-10 text-center text-sm text-slate-500">No reviews yet.</div> : <div className="mt-5 space-y-4">{reviews.map((review) => <article key={review._id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700">{review.reviewerId?.name?.slice(0, 1).toUpperCase() || '?'}</div><div><div className="font-semibold text-slate-900">{review.reviewerId?.name || 'Tenant'}</div><div className="text-xs text-slate-500">{new Date(review.createdAt).toLocaleDateString()} · {review.reviewType.replaceAll('_', ' ')}</div></div></div><div className="text-lg">{stars(review.overallRating)}</div></div><p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{review.reviewText || 'No written comments.'}</p>{review.photos?.length > 0 && <div className="mt-3 flex gap-2 overflow-x-auto">{review.photos.map((photo) => <img src={photo} alt="Review evidence" key={photo} className="h-20 w-20 rounded-xl object-cover" />)}</div>}<div className="mt-3 flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{review.wouldRecommend ? '✓ Would recommend' : 'Would not recommend'}</span><button type="button" onClick={() => helpful(review._id)} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200">Helpful ({review.helpfulCount || 0})</button><button type="button" onClick={() => report(review._id)} className="rounded-lg px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">Report</button></div>{review.ownerResponse?.text && <div className="mt-4 rounded-xl border-l-4 border-indigo-500 bg-indigo-50 p-3 text-sm text-indigo-900"><div className="font-semibold">Owner response</div><p className="mt-1">{review.ownerResponse.text}</p></div>}</article>)}</div>}{pagination.totalPages > 1 && <div className="mt-5 flex items-center justify-between"><button type="button" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)} className="rounded-xl border px-3 py-2 text-sm disabled:opacity-40">Previous</button><span className="text-sm text-slate-500">Page {pagination.page} of {pagination.totalPages}</span><button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => load(pagination.page + 1)} className="rounded-xl border px-3 py-2 text-sm disabled:opacity-40">Next</button></div>}</section>;
}

export default ReviewList;
