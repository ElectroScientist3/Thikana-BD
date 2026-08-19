function VerificationBadge({ verified, badge = 'none', className = '' }) {
  if (!verified) return null;
  const premium = badge === 'premium';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${premium ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300' : 'bg-emerald-100 text-emerald-700'} ${className}`} title={premium ? 'Premium verified property' : 'Verified property'}>
      {premium ? '✅ Premium Verified' : '✅ Verified'}
    </span>
  );
}

export default VerificationBadge;
