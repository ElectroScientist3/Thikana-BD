// src/components/ListingCard.jsx
import StatusBadge from './StatusBadge';
import VerificationBadge from './VerificationBadge';

function ListingCard({ listing, onStatusChange, onViewHistory }) {
  const formatCurrency = (amount) => {
    return amount ? `৳${amount.toLocaleString()}` : 'N/A';
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div><h3 className="font-semibold text-slate-900 text-lg">{listing.title}</h3><VerificationBadge verified={listing.isVerified} badge={listing.verificationBadge} className="mt-1" /></div>
          <StatusBadge status={listing.status} />
        </div>
        
        <p className="text-sm text-slate-600 mb-2">
          {listing.area}, {listing.city}
        </p>
        
        <div className="flex items-center gap-4 text-sm mb-3">
          <span className="font-semibold text-emerald-600">
            {formatCurrency(listing.monthly_rent_bdt)}
          </span>
          <span className="text-slate-500">
            {listing.rooms || 1} {listing.rooms === 1 ? 'room' : 'rooms'}
          </span>
        </div>

        {listing.status === 'available_from_date' && listing.available_from && (
          <p className="text-xs text-slate-500 mb-3">
            Available from: {new Date(listing.available_from).toLocaleDateString()}
          </p>
        )}

        {listing.status === 'on_hold' && listing.hold_expiry_date && (
          <p className="text-xs text-amber-600 mb-3">
            Hold expires: {new Date(listing.hold_expiry_date).toLocaleDateString()}
          </p>
        )}

        {listing.status === 'reserved' && listing.reservation_expiry_date && (
          <p className="text-xs text-purple-600 mb-3">
            Reservation expires: {new Date(listing.reservation_expiry_date).toLocaleDateString()}
          </p>
        )}

        <div className="flex gap-2 mt-2">
          <button
            onClick={() => onStatusChange(listing)}
            className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 transition"
          >
            Change Status
          </button>
          <button
            onClick={() => onViewHistory(listing)}
            className="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-xs hover:bg-gray-700 transition"
          >
            History
          </button>
        </div>
      </div>
    </div>
  );
}

export default ListingCard;