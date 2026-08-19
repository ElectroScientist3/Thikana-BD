import { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js';
import { getReviewStats } from '../services/reviewApi';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function RatingChart({ propertyId, refreshKey = 0 }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { getReviewStats(propertyId).then((response) => setStats(response.data)).catch((requestError) => setError(requestError.response?.data?.msg || 'Unable to load rating chart.')); }, [propertyId, refreshKey]);
  if (error) return <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">{error}</div>;
  if (!stats) return <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Loading rating summary...</div>;
  const breakdown = stats.ratingBreakdown || {};
  const category = stats.categoryAverages || {};
  const distribution = { labels: ['5 stars', '4 stars', '3 stars', '2 stars', '1 star'], datasets: [{ label: 'Reviews', data: [breakdown.five || 0, breakdown.four || 0, breakdown.three || 0, breakdown.two || 0, breakdown.one || 0], backgroundColor: ['#10b981', '#34d399', '#fbbf24', '#fb923c', '#f87171'], borderRadius: 8 }] };
  const categoryData = { labels: ['Accuracy', 'Communication', 'Cleanliness', 'Safety', 'Location', 'Value'], datasets: [{ label: 'Average', data: [category.listingAccuracy || 0, category.ownerCommunication || 0, category.cleanliness || 0, category.safety || 0, category.location || 0, category.valueForMoney || 0], backgroundColor: '#6366f1', borderRadius: 8 }] };
  const options = { responsive: true, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, max: 5, ticks: { stepSize: 1 } } } };
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center gap-6"><div><div className="text-5xl font-bold text-slate-900">{Number(stats.averageRating || 0).toFixed(1)}</div><div className="mt-1 text-xl text-amber-400">{'★★★★★'.split('').map((star, index) => <span key={index} className={index < Math.round(stats.averageRating || 0) ? '' : 'text-slate-300'}>{star}</span>)}</div><div className="mt-1 text-sm text-slate-500">{stats.totalReviews || 0} total reviews</div></div><div className="rounded-2xl bg-emerald-50 p-4"><div className="text-2xl font-bold text-emerald-700">{stats.recommendPercent ?? '—'}{stats.recommendPercent !== undefined && '%'}</div><div className="text-xs text-emerald-700">would recommend</div></div></div><div className="mt-6 grid gap-6 lg:grid-cols-2"><div><h4 className="mb-3 text-sm font-semibold text-slate-700">Rating distribution</h4><Bar data={distribution} options={options} /></div><div><h4 className="mb-3 text-sm font-semibold text-slate-700">Category averages</h4><Bar data={categoryData} options={options} /></div></div></section>;
}

export default RatingChart;
