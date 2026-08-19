function Toast({ type = 'success', message }) {
  if (!message) return null;
  return (
    <div className={`fixed bottom-5 right-5 z-[120] max-w-sm rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`} role="status">
      {message}
    </div>
  );
}

export default Toast;
