import { useEffect, useState } from "react";

const initialProfile = {
  name: "",
  email: "",
  phone: "",
  homeAddress: "",
  currentLocation: "",
  familyStatus: "",
};

function Profile() {
  const [profile, setProfile] = useState(initialProfile);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setStatus("You need to log in to view this page.");
        setError(true);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("http://localhost:5000/api/auth/profile", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Unable to load profile.");
        }

        const data = await res.json();
        setProfile({
          name: data.user?.name || "",
          email: data.user?.email || "",
          phone: data.user?.phone || "",
          homeAddress: data.user?.homeAddress || "",
          currentLocation: data.user?.currentLocation || "",
          familyStatus: data.user?.familyStatus || "",
        });
      } catch (err) {
        setStatus(err.message || "Unable to load profile.");
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setStatus("Saving profile...");
    setError(false);
    setSaving(true);

    const token = localStorage.getItem("token");
    if (!token) {
      setStatus("Authentication required.");
      setError(true);
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profile),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Unable to save profile.");
      }

      const data = await res.json();
      setProfile({
        name: data.user?.name || profile.name,
        email: data.user?.email || profile.email,
        phone: data.user?.phone || profile.phone,
        homeAddress: data.user?.homeAddress || profile.homeAddress,
        currentLocation: data.user?.currentLocation || profile.currentLocation,
        familyStatus: data.user?.familyStatus || profile.familyStatus,
      });
      setStatus("Profile updated successfully.");
    } catch (err) {
      setStatus(err.message || "Failed to save profile.");
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const completionCount = Object.values(profile).filter((value) => String(value).trim()).length;
  const completionPercent = Math.round((completionCount / Object.keys(profile).length) * 100);
  const initials = (profile.name || "User")
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0] || "")
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.35)]">
        <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 px-6 py-8 text-white sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-200">Account settings</p>
              <h2 className="mt-2 text-3xl font-bold">Your profile</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-200 sm:text-base">
                Keep your rental profile polished so hosts and agents can reach you easily.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
                {initials || "U"}
              </div>
              <div>
                <div className="text-sm font-semibold">{profile.name || "New profile"}</div>
                <div className="text-xs text-slate-300">{completionPercent}% complete</div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 lg:p-10">
          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-600">
              <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600"></div>
              <div className="text-lg font-semibold">Loading your profile...</div>
            </div>
          ) : error && !profile.name && !profile.email ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
              {status || "Unable to load profile."}
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-8">
              <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
                <section className="rounded-3xl border border-slate-200 bg-slate-50/80 p-6 shadow-sm">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Personal details</h3>
                      <p className="text-sm text-slate-500">Use a clear name and email so your profile feels trustworthy.</p>
                    </div>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                      Required
                    </span>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700">Name</label>
                      <input
                        name="name"
                        value={profile.name}
                        onChange={handleChange}
                        placeholder="Full name"
                        required
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700">Email</label>
                      <input
                        name="email"
                        type="email"
                        value={profile.email}
                        onChange={handleChange}
                        placeholder="your@email.com"
                        required
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-sm">
                  <h3 className="text-lg font-semibold">Profile snapshot</h3>
                  <p className="mt-2 text-sm text-slate-300">A complete profile helps you move faster during bookings and visits.</p>
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center justify-between rounded-2xl bg-white/10 px-3 py-2">
                      <span className="text-sm">Completion</span>
                      <span className="text-sm font-semibold">{completionPercent}%</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-white/10 px-3 py-2">
                      <span className="text-sm">Last updated</span>
                      <span className="text-sm font-semibold">Today</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-white/10 px-3 py-2">
                      <span className="text-sm">Visibility</span>
                      <span className="text-sm font-semibold">Visible to hosts</span>
                    </div>
                  </div>
                </section>
              </div>

              <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-sm">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-slate-900">Contact and address</h3>
                  <p className="text-sm text-slate-500">Share the details that make your booking experience smoother.</p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Phone</label>
                    <input
                      name="phone"
                      value={profile.phone}
                      onChange={handleChange}
                      placeholder="Mobile number"
                      inputMode="tel"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Current location</label>
                    <input
                      name="currentLocation"
                      value={profile.currentLocation}
                      onChange={handleChange}
                      placeholder="Current city or area"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700">Home address</label>
                    <textarea
                      name="homeAddress"
                      value={profile.homeAddress}
                      onChange={handleChange}
                      placeholder="Permanent or current address"
                      rows="3"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Family status</label>
                    <select
                      name="familyStatus"
                      value={profile.familyStatus}
                      onChange={handleChange}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Select status</option>
                      <option value="Single">Single</option>
                      <option value="Couple">Couple</option>
                      <option value="Small family">Small family</option>
                      <option value="Large family">Large family</option>
                      <option value="Shared accommodation">Shared accommodation</option>
                    </select>
                  </div>
                </div>
              </section>

              <div className="flex flex-col gap-4 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className={`rounded-full px-4 py-2 text-sm font-medium ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {status || "Your changes will be saved securely."}
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                >
                  {saving ? "Saving..." : "Save profile"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default Profile;
