import { useState } from 'react';
import { useListings } from '../hooks/useListings';
import ListingCard from '../components/ListingCard';

export default function Recommendations() {
  const { fetchRecommendations, loading } = useListings();
  const [prefs, setPrefs] = useState({
    minRent: '', maxRent: '', city: '', area: '', propertyType: '', rooms: '', moveInDate: '', features: { wifi: false, lift: false, parking: false }
  });
  const [results, setResults] = useState([]);

  const onChange = (k, v) => setPrefs(prev => ({ ...prev, [k]: v }));
  const onFeature = (k) => setPrefs(prev => ({ ...prev, features: { ...prev.features, [k]: !prev.features[k] } }));

  const submit = async (e) => {
    e.preventDefault();
    const res = await fetchRecommendations(prefs);
    setResults(res);
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Smart Home Recommendations</h2>
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <input placeholder="Min rent" value={prefs.minRent} onChange={e => onChange('minRent', e.target.value)} className="p-2 border rounded" />
        <input placeholder="Max rent" value={prefs.maxRent} onChange={e => onChange('maxRent', e.target.value)} className="p-2 border rounded" />
        <input placeholder="City" value={prefs.city} onChange={e => onChange('city', e.target.value)} className="p-2 border rounded" />
        <input placeholder="Area" value={prefs.area} onChange={e => onChange('area', e.target.value)} className="p-2 border rounded" />
        <input placeholder="Property type" value={prefs.propertyType} onChange={e => onChange('propertyType', e.target.value)} className="p-2 border rounded" />
        <input placeholder="Rooms" value={prefs.rooms} onChange={e => onChange('rooms', e.target.value)} className="p-2 border rounded" />
        <input type="date" value={prefs.moveInDate} onChange={e => onChange('moveInDate', e.target.value)} className="p-2 border rounded" />
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.features.wifi} onChange={() => onFeature('wifi')} /> Wifi</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.features.lift} onChange={() => onFeature('lift')} /> Lift</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.features.parking} onChange={() => onFeature('parking')} /> Parking</label>
        </div>
        <div className="md:col-span-3">
          <button className="px-4 py-2 bg-blue-600 text-white rounded" disabled={loading}>Get Recommendations</button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {results.map(listing => (
          <ListingCard key={listing._id} listing={listing} onStatusChange={() => {}} onViewHistory={() => {}} />
        ))}
      </div>
    </div>
  );
}
