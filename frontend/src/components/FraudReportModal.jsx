import { useState } from 'react';
import { submitFraudReport } from '../services/reviewApi';

const types = [
  ['fake_listing', '🎭 Fake listing', 'The property or owner appears fabricated.'],
  ['hidden_charges', '💰 Hidden charges', 'Unexpected fees were not disclosed.'],
  ['incorrect_photos', '🖼️ Incorrect photos', 'Photos do not represent the property.'],
  ['broker_fraud', '🧾 Broker fraud', 'A broker is acting dishonestly.'],
  ['already_rented', '🔒 Already rented', 'The property is unavailable despite being listed.'],
  ['scam_attempt', '🚨 Scam attempt', 'Someone requested suspicious payment or information.'],
  ['duplicate_listing', '📋 Duplicate listing', 'The same property appears multiple times.'],
  ['other', '⚠️ Other', 'Another suspicious issue.'],
];

function FraudReportModal({ propertyId, propertyTitle, onClose }) {
  const [reportType, setReportType] = useState('');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState([]);
  const [working, setWorking] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const severity = ['fake_listing', 'scam_attempt'].includes(reportType) ? 'High' : reportType ? 'Medium' : 'Auto';

  const submit = async () => {
    if (!reportType || description.trim().length < 50) return setError('Select a report type and provide at least 50 characters.');
    if (!window.confirm('Submit this report for admin review?')) return;
    setWorking(true);
    const formData = new FormData();
    formData.append('propertyId', propertyId);
    formData.append('reportType', reportType);
    formData.append('description', description.trim());
    evidence.forEach((file) => formData.append('evidence', file));
    try {
      await submitFraudReport(formData);
      setSuccess(true);
    } catch (requestError) {
      setError(requestError.response?.data?.msg || 'Unable to submit fraud report.');
    } finally {
      setWorking(false);
    }
  };

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-bold text-slate-900">Report listing</h2><p className="mt-1 text-sm text-slate-500">Help us review suspicious activity on {propertyTitle}.</p></div><button type="button" onClick={onClose} className="text-2xl text-slate-400">×</button></div>{success ? <div className="py-12 text-center"><div className="text-5xl">✅</div><h3 className="mt-4 text-2xl font-bold text-emerald-800">Thank you, we'll review within 24 hours</h3><button type="button" onClick={onClose} className="mt-6 rounded-xl bg-indigo-700 px-5 py-3 text-sm font-semibold text-white">Close</button></div> : <><div className="mt-6 grid gap-2 sm:grid-cols-2">{types.map(([value, label, detail]) => <button type="button" key={value} onClick={() => setReportType(value)} className={`rounded-xl border p-3 text-left ${reportType === value ? 'border-red-500 bg-red-50 ring-2 ring-red-100' : 'border-slate-200 hover:border-red-300'}`}><div className="text-sm font-semibold text-slate-800">{label}</div><div className="mt-1 text-xs text-slate-500">{detail}</div></button>)}</div>{reportType && <div className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-bold ${severity === 'High' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{severity} severity</div>}<textarea value={description} onChange={(event) => setDescription(event.target.value.slice(0, 1000))} rows={5} placeholder="Describe what happened (50-1000 characters)" className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" /><div className="flex justify-between text-xs text-slate-500"> <span>Evidence is optional</span><span>{description.length}/1000</span></div><label className="mt-4 block rounded-xl border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-700">Upload evidence (max 5 files)<input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple onChange={(event) => setEvidence(Array.from(event.target.files || []).slice(0, 5))} className="mt-2 block w-full text-xs" />{evidence.length > 0 && <span className="mt-2 block text-xs text-slate-500">{evidence.length} file(s) selected</span>}</label>{error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}<button type="button" onClick={submit} disabled={working} className="mt-5 w-full rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{working ? 'Submitting...' : 'Submit report'}</button></>}</div></div>;
}

export default FraudReportModal;
