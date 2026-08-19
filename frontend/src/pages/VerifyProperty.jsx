import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getMyVerificationProperties, sendVerificationOtp, submitVerification, verifyVerificationOtp } from '../services/verificationApi';

const steps = ['Select property', 'Documents', 'Property photos', 'Mobile verification', 'Review & submit'];
const documentFields = [
  ['utilityBill', 'Utility bill'],
  ['ownershipDoc', 'Ownership document'],
  ['nidFront', 'NID front'],
  ['nidBack', 'NID back'],
  ['addressProof', 'Address proof'],
];
const maxFileSize = 5 * 1024 * 1024;

function VerifyProperty() {
  const [searchParams] = useSearchParams();
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState(() => searchParams.get('propertyId') || localStorage.getItem('verificationPropertyId') || '');
  const [step, setStep] = useState(() => Number(localStorage.getItem('verificationStep') || 0));
  const [documents, setDocuments] = useState({});
  const [photos, setPhotos] = useState([]);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpSeconds, setOtpSeconds] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const selectedProperty = properties.find((property) => property._id === propertyId);
  const documentCount = Object.keys(documents).length;
  const canNext = step === 0 ? Boolean(propertyId) : step === 1 ? documentCount === documentFields.length : step === 2 ? photos.length >= 3 && photos.length <= 15 : step === 3 ? otpVerified : true;

  useEffect(() => {
    getMyVerificationProperties()
      .then((response) => setProperties(response.data.properties || []))
      .catch((requestError) => setError(requestError.response?.data?.msg || 'Unable to load your properties.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    localStorage.setItem('verificationStep', String(step));
    if (propertyId) localStorage.setItem('verificationPropertyId', propertyId);
  }, [propertyId, step]);

  useEffect(() => {
    if (!otpSent || otpSeconds <= 0) return undefined;
    const timer = window.setInterval(() => setOtpSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [otpSent, otpSeconds]);

  const selectFile = (field, file) => {
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size > maxFileSize) {
      setError('Files must be PDF, JPG, or PNG and no larger than 5MB.');
      return;
    }
    setDocuments((current) => ({ ...current, [field]: file }));
    setError('');
  };

  const addPhotos = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (photos.length + incoming.length > 15) {
      setError('You can upload between 3 and 15 property photos.');
      return;
    }
    const valid = incoming.filter((file) => ['image/jpeg', 'image/png'].includes(file.type) && file.size <= maxFileSize);
    if (valid.length !== incoming.length) setError('Property photos must be JPG or PNG files under 5MB each.');
    setPhotos((current) => [...current, ...valid]);
  };

  const movePhoto = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    setPhotos((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSendOtp = async () => {
    setWorking(true);
    setError('');
    try {
      await sendVerificationOtp(propertyId, phone);
      setOtpSent(true);
      setOtpSeconds(600);
    } catch (requestError) {
      setError(requestError.response?.data?.msg || 'Unable to send OTP. Link Telegram first.');
    } finally {
      setWorking(false);
    }
  };

  const handleVerifyOtp = async () => {
    setWorking(true);
    setError('');
    try {
      await verifyVerificationOtp(propertyId, otp);
      setOtpVerified(true);
    } catch (requestError) {
      setError(requestError.response?.data?.msg || 'Invalid or expired OTP.');
    } finally {
      setWorking(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedProperty || !otpVerified) return setError('Complete mobile verification before submitting.');
    const formData = new FormData();
    formData.append('propertyId', propertyId);
    documentFields.forEach(([field]) => formData.append(field, documents[field]));
    photos.forEach((photo) => formData.append('propertyPhotos', photo));
    setWorking(true);
    setUploadProgress(0);
    setError('');
    try {
      await submitVerification(formData, (event) => event.total && setUploadProgress(Math.round(event.loaded / event.total * 100)));
      setSuccess(true);
      localStorage.removeItem('verificationStep');
      localStorage.removeItem('verificationPropertyId');
    } catch (requestError) {
      setError(requestError.response?.data?.msg || 'Unable to submit verification.');
    } finally {
      setWorking(false);
    }
  };

  const progressLabel = useMemo(() => `${Math.round((step + 1) / steps.length * 100)}%`, [step]);
  if (success) return <div className="mx-auto max-w-2xl px-4 py-16 text-center"><div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-10"><div className="text-5xl">✅</div><h1 className="mt-4 text-3xl font-bold text-emerald-900">Verification submitted</h1><p className="mt-3 text-sm text-emerald-800">Our admin team will review your property documents and notify you through Telegram.</p><Link to="/dashboard/my-listings" className="mt-6 inline-flex rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">Track Status</Link></div></div>;
  if (loading) return <div className="p-10 text-center text-slate-500">Loading your properties...</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">Owner verification</p><h1 className="mt-2 text-3xl font-bold text-slate-900">Get your property verified</h1><p className="mt-2 text-sm text-slate-500">Submit clear documents so tenants can trust your listing.</p></div>
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-700"><span>Step {step + 1} of {steps.length}: {steps[step]}</span><span>{progressLabel}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: progressLabel }} /></div><div className="mt-4 grid grid-cols-5 gap-1 text-center text-[11px] text-slate-500">{steps.map((label, index) => <span className={index <= step ? 'font-bold text-emerald-700' : ''} key={label}>{index + 1}. {label}</span>)}</div></div>
      {error && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        {step === 0 && <div><h2 className="text-xl font-bold text-slate-900">Choose a property</h2><div className="mt-5 grid gap-3 md:grid-cols-2">{properties.map((property) => <button type="button" key={property._id} onClick={() => setPropertyId(property._id)} className={`rounded-2xl border p-4 text-left ${propertyId === property._id ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-emerald-400'}`}><div className="flex items-center gap-3"><img src={property.images?.[0] || '/thikana-brand.svg'} alt="" className="h-14 w-14 rounded-xl object-cover" /><div><div className="font-semibold text-slate-900">{property.title}</div><div className="text-sm text-slate-500">{property.area}, {property.city}</div><div className="mt-1 text-xs text-slate-500">Status: {property.verification?.verificationStatus || 'Not submitted'}</div></div></div></button>)}</div>{properties.length === 0 && <p className="mt-6 text-sm text-slate-500">No owner properties are available for verification.</p>}</div>}

        {step === 1 && <div><h2 className="text-xl font-bold text-slate-900">Upload required documents</h2><p className="mt-1 text-sm text-slate-500">PDF, JPG, or PNG. Maximum 5MB per file.</p><div className="mt-5 grid gap-4 md:grid-cols-2">{documentFields.map(([field, label]) => <label key={field} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectFile(field, event.dataTransfer.files[0]); }} className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 hover:border-emerald-500"><span className="block text-sm font-semibold text-slate-800">{label}</span><span className="mt-2 block text-xs text-slate-500">Drag and drop or click to browse</span>{documents[field] && <span className="mt-3 block truncate rounded-lg bg-white px-3 py-2 text-xs font-medium text-emerald-700">{documents[field].name}</span>}<input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(event) => selectFile(field, event.target.files[0])} /></label>)}</div><div className="mt-5 text-sm text-slate-500">{documentCount}/{documentFields.length} required documents ready</div></div>}

        {step === 2 && <div><h2 className="text-xl font-bold text-slate-900">Add property photos</h2><p className="mt-1 text-sm text-slate-500">Upload 3 to 15 clear JPG or PNG photos. Use the arrows to reorder them.</p><label onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addPhotos(event.dataTransfer.files); }} className="mt-5 block cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center hover:border-emerald-500"><span className="text-3xl">📷</span><span className="mt-2 block text-sm font-semibold text-slate-800">Drop photos here or browse</span><input type="file" accept="image/jpeg,image/png" multiple className="hidden" onChange={(event) => addPhotos(event.target.files)} /></label><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">{photos.map((photo, index) => <div key={`${photo.name}-${index}`} className="relative overflow-hidden rounded-xl border border-slate-200"><img src={URL.createObjectURL(photo)} alt="Property preview" className="aspect-square w-full object-cover" /><div className="absolute inset-x-1 bottom-1 flex justify-between"><button type="button" onClick={() => movePhoto(index, -1)} className="rounded bg-slate-900/80 px-2 py-1 text-xs text-white">←</button><button type="button" onClick={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} className="rounded bg-red-600/90 px-2 py-1 text-xs text-white">×</button><button type="button" onClick={() => movePhoto(index, 1)} className="rounded bg-slate-900/80 px-2 py-1 text-xs text-white">→</button></div></div>)}</div><p className="mt-4 text-sm font-medium text-slate-600">{photos.length}/15 photos selected</p></div>}

        {step === 3 && <div><h2 className="text-xl font-bold text-slate-900">Verify your mobile</h2><p className="mt-1 text-sm text-slate-500">The OTP will be delivered through your linked Telegram account.</p><div className="mt-5 flex flex-col gap-3 sm:flex-row"><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="01XXXXXXXXX" className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm" /><button type="button" onClick={handleSendOtp} disabled={working || !phone || otpSeconds > 0} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{otpSeconds > 0 ? `Resend in ${Math.floor(otpSeconds / 60)}:${String(otpSeconds % 60).padStart(2, '0')}` : 'Send OTP via Telegram'}</button></div>{otpSent && <div className="mt-5 flex gap-3"><input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit OTP" className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm" /><button type="button" onClick={handleVerifyOtp} disabled={working || otp.length !== 6} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Verify OTP</button></div>}{otpVerified && <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">✓ Mobile number verified</div>}</div>}

        {step === 4 && <div><h2 className="text-xl font-bold text-slate-900">Review and submit</h2><div className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-5 text-sm"><div><span className="text-slate-500">Property:</span> <strong>{selectedProperty?.title}</strong></div><div><span className="text-slate-500">Documents:</span> <strong>{documentCount} of {documentFields.length}</strong></div><div><span className="text-slate-500">Photos:</span> <strong>{photos.length}</strong></div><div><span className="text-slate-500">Mobile:</span> <strong>{phone} {otpVerified ? '✓' : ''}</strong></div></div>{working && <div className="mt-5"><div className="mb-1 flex justify-between text-xs text-slate-500"><span>Uploading documents...</span><span>{uploadProgress}%</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${uploadProgress}%` }} /></div></div>}</div>}

        <div className="mt-8 flex justify-between gap-3 border-t border-slate-200 pt-5"><button type="button" disabled={step === 0 || working} onClick={() => setStep((current) => current - 1)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40">Back</button>{step < steps.length - 1 ? <button type="button" disabled={!canNext || working} onClick={() => setStep((current) => current + 1)} className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Next</button> : <button type="button" disabled={working || !canNext} onClick={handleSubmit} className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">{working ? 'Submitting...' : 'Submit verification'}</button>}</div>
      </div>
    </div>
  );
}

export default VerifyProperty;
