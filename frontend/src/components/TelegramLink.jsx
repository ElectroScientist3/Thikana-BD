import { useEffect, useRef, useState } from 'react';
import {
  generateTelegramCode,
  getTelegramStatus,
  sendTelegramTest,
  unlinkTelegram,
  updateNotificationPreferences,
} from '../services/telegramNotifications';
import Toast from './Toast';

const countdownSeconds = 10 * 60;

function TelegramLink() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [code, setCode] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [botLink, setBotLink] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(countdownSeconds);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const pollRef = useRef(null);

  const loadStatus = async () => {
    try {
      const response = await getTelegramStatus();
      setStatus(response.data);
    } catch (error) {
      setFeedback({ type: 'error', text: error.response?.data?.msg || 'Unable to load Telegram status.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    return () => window.clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    if (!modalOpen || !expiresAt) return undefined;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        window.clearInterval(timer);
        window.clearInterval(pollRef.current);
        setFeedback({ type: 'error', text: 'Verification code expired. Generate a new code to try again.' });
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [modalOpen, expiresAt]);

  const startPolling = () => {
    window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      try {
        const response = await getTelegramStatus();
        setStatus(response.data);
        if (response.data.linked) {
          window.clearInterval(pollRef.current);
          setModalOpen(false);
          setFeedback({ type: 'success', text: 'Telegram connected successfully.' });
        }
      } catch {
        // Keep the modal open; the next poll can recover from a transient request failure.
      }
    }, 5000);
  };

  const handleGenerateCode = async () => {
    setWorking(true);
    setFeedback({ type: '', text: '' });
    try {
      const response = await generateTelegramCode();
      setCode(response.data.code);
      setExpiresAt(response.data.expiresAt);
      setBotLink(response.data.botLink);
      setSecondsLeft(Math.max(0, Math.ceil((new Date(response.data.expiresAt).getTime() - Date.now()) / 1000)));
      setModalOpen(true);
      startPolling();
    } catch (error) {
      setFeedback({ type: 'error', text: error.response?.data?.msg || 'Unable to generate a verification code.' });
    } finally {
      setWorking(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setFeedback({ type: 'success', text: 'Verification code copied.' });
    } catch {
      setFeedback({ type: 'error', text: 'Copy failed. Please select the code manually.' });
    }
  };

  const closeModal = () => {
    window.clearInterval(pollRef.current);
    setModalOpen(false);
  };

  const updatePreferences = async (changes) => {
    setWorking(true);
    try {
      const response = await updateNotificationPreferences(changes);
      setStatus(response.data);
      setFeedback({ type: 'success', text: 'Notification preferences updated.' });
    } catch (error) {
      setFeedback({ type: 'error', text: error.response?.data?.msg || 'Unable to update preferences.' });
    } finally {
      setWorking(false);
    }
  };

  const handleTest = async () => {
    setWorking(true);
    try {
      await sendTelegramTest();
      setFeedback({ type: 'success', text: 'Test notification sent.' });
    } catch (error) {
      setFeedback({ type: 'error', text: error.response?.data?.msg || 'Test notification failed.' });
    } finally {
      setWorking(false);
    }
  };

  const handleUnlink = async () => {
    if (!window.confirm('Unlink your Telegram account?')) return;
    setWorking(true);
    try {
      await unlinkTelegram();
      setStatus((current) => ({ ...current, linked: false }));
      setFeedback({ type: 'success', text: 'Telegram account unlinked.' });
    } catch (error) {
      setFeedback({ type: 'error', text: error.response?.data?.msg || 'Unable to unlink Telegram.' });
    } finally {
      setWorking(false);
    }
  };

  const formatCountdown = () => `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;

  if (loading) {
    return <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Loading Telegram settings...</div>;
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Notifications</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">Telegram alerts</h3>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">Receive important ThikanaBD updates in Telegram in English or বাংলা.</p>
        </div>
        {status?.linked ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">✓ Telegram Connected</span>
        ) : (
          <button type="button" onClick={handleGenerateCode} disabled={working} className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">{working ? 'Preparing...' : 'Link Telegram Account'}</button>
        )}
      </div>

      {status?.linked && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-800">Language</p>
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={working} onClick={() => updatePreferences({ language: 'en' })} className={`rounded-xl px-3 py-2 text-sm font-semibold ${status.language === 'en' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>English</button>
              <button type="button" disabled={working} onClick={() => updatePreferences({ language: 'bn' })} className={`rounded-xl px-3 py-2 text-sm font-semibold ${status.language === 'bn' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>বাংলা</button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <label className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-800">
              <span>Notifications enabled</span>
              <input type="checkbox" checked={status.enabled} disabled={working} onChange={(event) => updatePreferences({ enabled: event.target.checked })} className="h-5 w-5 accent-blue-600" />
            </label>
            <p className="mt-2 text-xs text-slate-500">Turn Telegram alerts on or off without unlinking your account.</p>
          </div>
          <div className="flex flex-wrap gap-3 md:col-span-2">
            <button type="button" onClick={handleTest} disabled={working} className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60">Send Test Notification</button>
            <button type="button" onClick={handleUnlink} disabled={working} className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60">Unlink</button>
          </div>
        </div>
      )}

      <Toast type={feedback.type} message={feedback.text} />

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="telegram-link-title">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div><h4 id="telegram-link-title" className="text-2xl font-bold text-slate-900">Link Telegram</h4><p className="mt-1 text-sm text-slate-500">Send this code to the ThikanaBD bot.</p></div>
              <button type="button" onClick={closeModal} className="text-2xl text-slate-400 hover:text-slate-700" aria-label="Close">×</button>
            </div>
            <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-slate-950 p-5 text-white">
              <span className="font-mono text-4xl font-bold tracking-[0.3em]">{code}</span>
              <button type="button" onClick={handleCopy} className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">Copy</button>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm"><span className="text-slate-500">Code expires in</span><strong className={secondsLeft < 60 ? 'text-red-600' : 'text-slate-900'}>{formatCountdown()}</strong></div>
            {botLink && <a href={botLink} target="_blank" rel="noreferrer" className="mt-5 block rounded-2xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700">Open Bot</a>}
            <div className="mt-5 space-y-2 rounded-2xl bg-blue-50 p-4 text-sm text-slate-700">
              <p><strong>English:</strong> Open the bot, press Start, then send <code>/verify {code}</code>.</p>
              <p><strong>বাংলা:</strong> Bot খুলে Start চাপুন, তারপর <code>/verify {code}</code> পাঠান।</p>
            </div>
            <p className="mt-4 text-center text-xs text-slate-500">This window checks for the connection automatically.</p>
          </div>
        </div>
      )}
    </section>
  );
}

export default TelegramLink;
