import { useEffect, useState } from "react";
import { API_BASE } from "../config/api";

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
  const [formProfile, setFormProfile] = useState(initialProfile);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

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
        const res = await fetch(`${API_BASE}/api/auth/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Unable to load profile.");
        }

        const data = await res.json();
        const nextProfile = {
          name: data.user?.name || "",
          email: data.user?.email || "",
          phone: data.user?.phone || "",
          homeAddress: data.user?.homeAddress || "",
          currentLocation: data.user?.currentLocation || "",
          familyStatus: data.user?.familyStatus || "",
        };
        setProfile(nextProfile);
        setFormProfile(nextProfile);
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
    setFormProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleEdit = () => {
    setFormProfile(profile);
    setIsEditing(true);
    setError(false);
    setStatus("Update your details below.");
  };

  const handleCancel = () => {
    setFormProfile(profile);
    setIsEditing(false);
    setStatus("No changes were made.");
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
      const res = await fetch(`${API_BASE}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formProfile),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Unable to save profile.");
      }

      const data = await res.json();
      const nextProfile = {
        name: data.user?.name || formProfile.name,
        email: data.user?.email || formProfile.email,
        phone: data.user?.phone || formProfile.phone,
        homeAddress: data.user?.homeAddress || formProfile.homeAddress,
        currentLocation: data.user?.currentLocation || formProfile.currentLocation,
        familyStatus: data.user?.familyStatus || formProfile.familyStatus,
      };
      setProfile(nextProfile);
      setFormProfile(nextProfile);
      setIsEditing(false);
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

  const infoCards = [
    { label: "Full name", value: profile.name || "Not provided" },
    { label: "Email", value: profile.email || "Not provided" },
    { label: "Phone", value: profile.phone || "Not provided" },
    { label: "Current location", value: profile.currentLocation || "Not provided" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_50px_-20px_rgba(15,23,42,0.35)]">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-900 px-6 py-8 text-white sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-200">Account overview</p>
              <h2 className="mt-2 text-3xl font-bold">Professional profile</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-200 sm:text-base">
                Present a polished, trustworthy profile for hosts, agents, and future bookings.
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
            <div className="space-y-8">
              <section className="rounded-3xl border border-slate-200 bg-slate-50/80 p-6 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Profile summary</p>
                    <h3 className="mt-1 text-xl font-semibold text-slate-900">Your account details at a glance</h3>
                  </div>
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={handleEdit}
                      className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-500 hover:text-blue-700"
                    >
                      Edit profile
                    </button>
                  ) : null}
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {infoCards.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{item.value}</p>
                    </div>
                  ))}
                </div>
              </section>

              <form onSubmit={handleSave} className="space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Personal information</h3>
                      <p className="text-sm text-slate-500">This section is presented in a clear, professional format and only becomes editable when you choose to update it.</p>
                    </div>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleCancel}
                          className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={saving}
                          className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                        >
                          {saving ? "Saving..." : "Save changes"}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-6 grid gap-6 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700">Full name</label>
                      {isEditing ? (
                        <input
                          name="name"
                          value={formProfile.name}
                          onChange={handleChange}
                          placeholder="Full name"
                          required
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        />
                      ) : (
                        <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          {profile.name || "Not provided"}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700">Primary email</label>
                      {isEditing ? (
                        <input
                          name="email"
                          type="email"
                          value={formProfile.email}
                          onChange={handleChange}
                          placeholder="your@email.com"
                          required
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        />
                      ) : (
                        <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          {profile.email || "Not provided"}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700">Phone number</label>
                      {isEditing ? (
                        <input
                          name="phone"
                          value={formProfile.phone}
                          onChange={handleChange}
                          placeholder="Mobile number"
                          inputMode="tel"
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        />
                      ) : (
                        <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          {profile.phone || "Not provided"}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700">Current location</label>
                      {isEditing ? (
                        <input
                          name="currentLocation"
                          value={formProfile.currentLocation}
                          onChange={handleChange}
                          placeholder="Current city or area"
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        />
                      ) : (
                        <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          {profile.currentLocation || "Not provided"}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-6 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700">Home address</label>
                      {isEditing ? (
                        <textarea
                          name="homeAddress"
                          value={formProfile.homeAddress}
                          onChange={handleChange}
                          placeholder="Permanent or current address"
                          rows="3"
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        />
                      ) : (
                        <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          {profile.homeAddress || "Not provided"}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700">Family status</label>
                      {isEditing ? (
                        <select
                          name="familyStatus"
                          value={formProfile.familyStatus}
                          onChange={handleChange}
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="">Select status</option>
                          <option value="Single">Single</option>
                          <option value="Couple">Couple</option>
                          <option value="Small family">Small family</option>
                          <option value="Large family">Large family</option>
                          <option value="Shared accommodation">Shared accommodation</option>
                        </select>
                      ) : (
                        <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          {profile.familyStatus || "Not provided"}
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <div className="flex flex-col gap-4 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className={`rounded-full px-4 py-2 text-sm font-medium ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {status || "Your changes will be saved securely."}
                  </div>
                  {!isEditing ? (
                    <div className="text-sm text-slate-500">Choose Edit profile whenever you need to update your information.</div>
                  ) : null}
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Profile;
