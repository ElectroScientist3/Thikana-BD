import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config/api";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0).replace("BDT", "৳");

const numberOrZero = (value) => {
  const number = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(number) ? number : 0;
};

const formatDueDate = (value, fallback = "Not set") => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString();
};

function RentLedger() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}").isOwner ? "owner" : "tenant";
    } catch {
      return "tenant";
    }
  });
  const [historyMode, setHistoryMode] = useState("monthly");
  const [selectedMonthId, setSelectedMonthId] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [maintenanceIssues, setMaintenanceIssues] = useState([]);
  const [moveOutRequests, setMoveOutRequests] = useState([]);
  const [maintenanceForm, setMaintenanceForm] = useState({ category: "Water", title: "", description: "" });
  const [moveOutReason, setMoveOutReason] = useState("");
  const [inspectionRequested, setInspectionRequested] = useState(false);
  const [tenantHistory, setTenantHistory] = useState([]);
  const [previousHistory, setPreviousHistory] = useState([]);
  const [tenantProperties, setTenantProperties] = useState([]);
  const [yearlySummary, setYearlySummary] = useState([]);
  const [ownerProperties, setOwnerProperties] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const [propertyForm, setPropertyForm] = useState({
    monthlyRent: 0,
    serviceCharge: 2500,
    utilities: 1000,
  });
  const [isEditingPackage, setIsEditingPackage] = useState(false);
  const [manualReceived, setManualReceived] = useState({});
  const [notifications, setNotifications] = useState({ tenant: [], owner: [] });
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
  const loadNotifications = async () => {
    const response = await fetch(`${API_BASE}/api/notifications?limit=30`, { headers: authHeaders() });
    if (!response.ok) return;
    const data = await response.json();
    const mapped = (data.notifications || []).map((item) => ({
      id: item._id,
      title: item.type?.replaceAll("_", " ") || "Notification",
      description: item.message,
      tone: item.type?.includes("overdue") ? "bg-red-50 text-red-800" : item.type?.includes("approved") ? "bg-emerald-50 text-emerald-800" : "bg-blue-50 text-blue-800",
    }));
    setNotifications({ tenant: mapped, owner: mapped });
  };

  const loadLedger = async () => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/rent-ledger/${viewMode}`, { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.msg || "Unable to load rent ledger");
      if (viewMode === "tenant") {
        const entries = (data.entries || []).map((entry) => {
          const rent = numberOrZero(entry.rent ?? entry.listing?.monthly_rent_bdt);
          const serviceCharge = numberOrZero(entry.serviceCharge ?? entry.agreementInfo?.serviceCharge ?? entry.listing?.service_charge_bdt);
          const utilities = numberOrZero(entry.utilities ?? entry.agreementInfo?.utilitiesCharge ?? entry.listing?.utilities_charge_bdt);
          const totalDue = numberOrZero(entry.totalDue) || rent + serviceCharge + utilities;
          const paidAmount = numberOrZero(entry.paidAmount);
          return {
            ...entry,
            id: entry._id,
            period: entry.periodLabel || entry.period,
            dueDate: formatDueDate(entry.dueDate),
            totalDue,
            paidAmount,
            remainingAmount: Math.max(totalDue - paidAmount, 0),
            rent,
            serviceCharge,
            utilities,
          };
        });
        const fallbackEntries = (data.rentedProperties || []).map((property) => ({
          ...property,
          id: `property-${property._id}`,
          period: "Current rental",
          status: "Active",
          dueDate: `Day ${numberOrZero(property.dueDate) || 15}`,
          rent: numberOrZero(property.monthlyRent),
          serviceCharge: numberOrZero(property.serviceCharge),
          utilities: numberOrZero(property.utilitiesCharge),
          totalDue: numberOrZero(property.monthlyRent) + numberOrZero(property.serviceCharge) + numberOrZero(property.utilitiesCharge),
          paidAmount: 0,
          remainingAmount: property.monthlyRent + property.serviceCharge + property.utilitiesCharge,
          listing: property,
          tenantInfo: null,
          paymentHistory: [],
        }));
        setTenantProperties(data.rentedProperties || []);
        setTenantHistory([...entries, ...fallbackEntries]);
        setPreviousHistory((data.previousHistory || []).map((entry) => {
          const rent = numberOrZero(entry.rent ?? entry.listing?.monthly_rent_bdt);
          const serviceCharge = numberOrZero(entry.serviceCharge ?? entry.agreementInfo?.serviceCharge ?? entry.listing?.service_charge_bdt);
          const utilities = numberOrZero(entry.utilities ?? entry.agreementInfo?.utilitiesCharge ?? entry.listing?.utilities_charge_bdt);
          const totalDue = numberOrZero(entry.totalDue) || rent + serviceCharge + utilities;
          const paidAmount = numberOrZero(entry.paidAmount);
          return {
            ...entry,
            id: entry._id,
            period: entry.periodLabel || entry.period,
            dueDate: formatDueDate(entry.dueDate),
            totalDue,
            paidAmount,
            remainingAmount: Math.max(totalDue - paidAmount, 0),
            rent,
            serviceCharge,
            utilities,
          };
        }));
        setYearlySummary(data.yearlySummary || []);
        setPaymentRequests(data.requests || []);
        setMaintenanceIssues(data.maintenanceIssues || []);
        setMoveOutRequests(data.moveOutRequests || []);
        setSelectedMonthId((current) => current && [...entries, ...fallbackEntries].some((entry) => entry.id === current)
          ? current
          : entries[0]?.id || fallbackEntries[0]?.id || null);
      } else {
        const properties = data.properties || [];
        const firstProperty = properties.find((property) => property.id && property.id !== "null" && property.id !== "undefined");
        setOwnerProperties(properties);
        setMaintenanceIssues(data.maintenanceIssues || []);
        setMoveOutRequests(data.moveOutRequests || []);
        setPaymentRequests((data.requests || []).map((request) => ({
          ...request,
          id: request._id,
          tenant: request.tenant?.name || "Tenant",
          property: request.listing?.title || "Property",
          month: request.createdAt ? new Date(request.createdAt).toLocaleDateString() : "Current month",
          requestedAmount: request.amount,
        })));
        const activePropertyId = selectedPropertyId && properties.some((property) => property.id === selectedPropertyId)
          ? selectedPropertyId
          : firstProperty?.id || null;
        setSelectedPropertyId(activePropertyId);
        setSelectedTenantId((current) => {
          const currentProperty = properties.find((property) => property.id === activePropertyId);
          return currentProperty?.tenants?.some((tenant) => tenant.id === current)
            ? current
            : firstProperty?.tenants?.[0]?.id || null;
        });
        if (firstProperty) {
          setPropertyForm({
            monthlyRent: numberOrZero(firstProperty.monthlyRent),
            serviceCharge: numberOrZero(firstProperty.serviceCharge),
            utilities: numberOrZero(firstProperty.utilities),
          });
        }
      }
      await loadNotifications();
      setError("");
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadLedger(); }, [viewMode]);

  const currentNotifications = useMemo(
    () => notifications[viewMode] || [],
    [notifications, viewMode]
  );

  const selectedHistoryItem = useMemo(
    () => tenantHistory.find((item) => item.id === selectedMonthId) || tenantHistory[0] || {},
    [tenantHistory, selectedMonthId]
  );

  const hasActiveRental = tenantHistory.length > 0;

  useEffect(() => {
    if (viewMode === "tenant" && selectedHistoryItem._id) {
      setPaymentAmount(numberOrZero(selectedHistoryItem.remainingAmount));
    }
  }, [viewMode, selectedHistoryItem]);

  const selectedOwnerProperty = useMemo(
    () => ownerProperties.find((property) => property.id === selectedPropertyId) || ownerProperties[0] || { tenants: [] },
    [ownerProperties, selectedPropertyId]
  );

  const selectedTenant = useMemo(
    () => selectedOwnerProperty.tenants.find((tenant) => tenant.id === selectedTenantId) || selectedOwnerProperty.tenants[0] || {},
    [selectedOwnerProperty, selectedTenantId]
  );

  const totalTenantOutstanding = useMemo(
    () => tenantHistory.reduce((sum, item) => sum + item.remainingAmount, 0),
    [tenantHistory]
  );

  const pendingApprovals = useMemo(
    () => paymentRequests.filter((request) => request.status === "Pending"),
    [paymentRequests]
  );

  const handleTenantPaymentSubmit = async () => {
    const amount = numberOrZero(paymentAmount) || numberOrZero(selectedHistoryItem.remainingAmount);
    const remaining = numberOrZero(selectedHistoryItem.remainingAmount);
    if (!selectedHistoryItem._id) {
      setError("Online payment requires an active rent ledger entry. Complete the rental agreement first.");
      return;
    }
    if (!amount || amount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (amount > remaining) {
      setError("Payment amount cannot exceed the remaining balance");
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/payments/initiate`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "rent",
          ledgerEntryId: selectedHistoryItem._id,
          listingId: selectedHistoryItem.listing?._id,
          amount,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.msg || "Unable to start rent payment");
      if (!data.redirectUrl) throw new Error("SSLCommerz did not return a payment URL");
      window.location.href = data.redirectUrl;
    } catch (err) {
      setError(err.message);
    }
  };

  const handleApprovePayment = async (requestId) => {
    const response = await fetch(`${API_BASE}/api/rent-ledger/requests/${requestId}/approve`, { method: "PATCH", headers: authHeaders() });
    if (!response.ok) { const data = await response.json(); setError(data.msg || "Unable to approve payment"); return; }
    await loadLedger();
  };

  const handleManualReceivedChange = (propertyId, value) => {
    setManualReceived((current) => ({
      ...current,
      [propertyId]: value,
    }));
  };

  const handlePropertySelect = (propertyId) => {
    const property = ownerProperties.find((item) => item.id === propertyId);
    if (!property) return;
    setSelectedPropertyId(propertyId);
    setSelectedTenantId(property.tenants[0]?.id || selectedTenantId);
    setPropertyForm({
      monthlyRent: property.monthlyRent,
      serviceCharge: property.serviceCharge,
      utilities: property.utilities,
    });
    setIsEditingPackage(false);
  };

  const handleTenantSelect = (tenantId) => {
    setSelectedTenantId(tenantId);
    setIsEditingPackage(false);
  };

  const handleEditPackage = () => {
    setIsEditingPackage(true);
  };

  const saveRentPackage = async () => {
    if (!selectedPropertyId || selectedPropertyId === "null" || selectedPropertyId === "undefined") {
      setError("Select a property before saving the rent package");
      return;
    }
    const response = await fetch(`${API_BASE}/api/rent-ledger/listings/${selectedPropertyId}/package`, { method: "PATCH", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(propertyForm) });
    if (!response.ok) { const data = await response.json(); setError(data.msg || "Unable to save rent package"); return; }
    await loadLedger();
    setIsEditingPackage(false);
  };

  const handleRecordReceived = async (propertyId) => {
    const amount = Number(manualReceived[propertyId]);
    if (!amount || amount <= 0) {
      setError("Enter a received amount greater than zero.");
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/rent-ledger/record`, { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ listingId: propertyId, amount }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.msg || "Unable to record payment");
      setManualReceived((current) => ({
        ...current,
        [propertyId]: "",
      }));
      await loadLedger();
    } catch (err) {
      setError(err.message);
    }
  };

  const selectedListingId = selectedHistoryItem.listing?._id || selectedHistoryItem.listing;

  const handleSubmitMaintenance = async () => {
    if (!selectedListingId || !maintenanceForm.title.trim() || !maintenanceForm.description.trim()) {
      setError("Add an issue title and description first.");
      return;
    }
    const response = await fetch(`${API_BASE}/api/rent-ledger/maintenance`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: selectedListingId, ...maintenanceForm }),
    });
    const data = await response.json();
    if (!response.ok) { setError(data.msg || "Unable to submit maintenance issue"); return; }
    setMaintenanceForm({ category: "Water", title: "", description: "" });
    await loadLedger();
  };

  const handleMoveOutRequest = async () => {
    if (!selectedListingId) { setError("No active rented property is selected."); return; }
    const response = await fetch(`${API_BASE}/api/rent-ledger/move-out`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: selectedListingId, reason: moveOutReason, inspectionRequested }),
    });
    const data = await response.json();
    if (!response.ok) { setError(data.msg || "Unable to request move-out"); return; }
    setMoveOutReason("");
    setInspectionRequested(false);
    await loadLedger();
  };

  const updateMaintenanceStatus = async (issueId, status) => {
    const response = await fetch(`${API_BASE}/api/rent-ledger/maintenance/${issueId}/status`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    if (!response.ok) { setError(data.msg || "Unable to update issue status"); return; }
    await loadLedger();
  };

  const decideMoveOut = async (requestId, decision) => {
    const response = await fetch(`${API_BASE}/api/rent-ledger/move-out/${requestId}/decision`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const data = await response.json();
    if (!response.ok) { setError(data.msg || "Unable to process move-out request"); return; }
    await loadLedger();
  };

  const updatePropertyConfig = (field, value) => {
    setPropertyForm((current) => ({ ...current, [field]: numberOrZero(value) }));
  };

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {error}
          </div>
        )}
        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
            Loading rent ledger...
          </div>
        )}
        <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm uppercase tracking-[0.33em] text-emerald-600 font-semibold">Rent Ledger</div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Tenant & owner payment tracker</h1>
              <p className="mt-2 text-slate-600 max-w-2xl">
                Review rent history, switch between monthly or yearly summaries, and manage payment requests from your account.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex items-center rounded-3xl bg-slate-100 p-1 overflow-hidden border border-slate-200">
                {[
                  { label: "Tenant", value: "tenant" },
                  { label: "Owner", value: "owner" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setViewMode(option.value)}
                    className={`px-4 py-2 text-sm font-semibold transition ${
                      viewMode === option.value
                        ? "bg-white shadow-sm text-slate-900"
                        : "text-slate-500 hover:text-slate-900"
                    }`}>
                    {option.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setNotificationOpen((open) => !open)}
                className="inline-flex items-center gap-2 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                🔔 Notifications
                <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white">
                  {currentNotifications.length}
                </span>
              </button>
            </div>
          </div>

          {notificationOpen && (
            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <div className="grid gap-3">
                {currentNotifications.map((note) => (
                  <div key={note.id} className={`${note.tone} rounded-2xl p-4`}>
                    <div className="font-semibold">{note.title}</div>
                    <div className="text-sm text-slate-700 mt-1">{note.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {viewMode === "tenant" ? (
          <div className="space-y-6">
            {hasActiveRental ? (
              <>
            <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm uppercase tracking-[0.3em] text-slate-500">Tenant summary</div>
                    <h2 className="mt-3 text-2xl font-bold text-slate-900">{selectedHistoryItem.listing?.title || "Rented property"} • {selectedHistoryItem.listing?.area || "Unit"}</h2>
                    <p className="mt-2 text-slate-500">Tenant: {selectedHistoryItem.tenantInfo?.name || "Tenant"}</p>
                  </div>
                  <div className="rounded-3xl bg-emerald-50 px-4 py-3 text-emerald-700">
                    {selectedHistoryItem.status}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Base rent", value: formatCurrency(selectedHistoryItem.rent) },
                    { label: "Service charge", value: formatCurrency(selectedHistoryItem.serviceCharge) },
                    { label: "Utilities", value: formatCurrency(selectedHistoryItem.utilities) },
                    { label: "Due date", value: selectedHistoryItem.dueDate },
                  ].map((item) => (
                    <div key={item.label} className="rounded-3xl bg-slate-50 p-4 border border-slate-200">
                      <div className="text-xs uppercase tracking-[0.28em] text-slate-500">{item.label}</div>
                      <div className="mt-2 text-lg font-semibold text-slate-900">{item.value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl bg-slate-50 p-5 border border-slate-200">
                    <div className="text-sm text-slate-500">Property address</div>
                    <div className="mt-2 font-semibold text-slate-900">{selectedHistoryItem.agreementInfo?.propertyAddress || selectedHistoryItem.propertyAddress || [selectedHistoryItem.listing?.area, selectedHistoryItem.listing?.city].filter(Boolean).join(", ") || "Address not provided"}</div>
                    <div className="mt-3 text-sm text-slate-700">
                      Owner: {selectedHistoryItem.ownerInfo?.name || "Owner information not provided"}
                      {selectedHistoryItem.ownerInfo?.phone ? ` • ${selectedHistoryItem.ownerInfo.phone}` : ""}
                    </div>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-5 border border-slate-200">
                    <div className="text-sm text-slate-500">Utility responsibilities</div>
                    <div className="mt-2 text-sm text-slate-700">
                      Tenant: {(selectedHistoryItem.agreementInfo?.utilities?.tenantResponsibilities || []).join(", ") || "As agreed by both parties"}
                    </div>
                    <div className="mt-1 text-sm text-slate-700">
                      Owner: {(selectedHistoryItem.agreementInfo?.utilities?.ownerResponsibilities || []).join(", ") || "As agreed by both parties"}
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-3xl bg-slate-50 p-5 border border-slate-200">
                    <div className="text-sm text-slate-500">Paid amount</div>
                    <div className="mt-3 text-2xl font-bold text-slate-900">{formatCurrency(selectedHistoryItem.paidAmount)}</div>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-5 border border-slate-200">
                    <div className="text-sm text-slate-500">Remaining</div>
                    <div className="mt-3 text-2xl font-bold text-slate-900">{formatCurrency(selectedHistoryItem.remainingAmount)}</div>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-5 border border-slate-200">
                    <div className="text-sm text-slate-500">Monthly total</div>
                    <div className="mt-3 text-2xl font-bold text-slate-900">{formatCurrency(selectedHistoryItem.totalDue)}</div>
                  </div>
                </div>
              </div>

              <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm uppercase tracking-[0.28em] text-slate-500">History view</div>
                    <h2 className="mt-2 text-xl font-bold text-slate-900">Switch period</h2>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {[
                    { label: "Monthly", value: "monthly" },
                    { label: "Yearly", value: "yearly" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setHistoryMode(option.value)}
                      className={`w-full rounded-3xl border px-4 py-3 text-left text-sm font-semibold transition ${
                        historyMode === option.value
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="mt-6 rounded-3xl bg-slate-100 p-4 border border-slate-200">
                  <div className="text-sm uppercase tracking-[0.28em] text-slate-500">Outstanding balance</div>
                  <div className="mt-3 text-3xl font-bold text-slate-900">{formatCurrency(totalTenantOutstanding)}</div>
                  <div className="mt-2 text-sm text-slate-500">This includes overdue and current month balances.</div>
                </div>
              </aside>
            </section>

            <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-sm uppercase tracking-[0.28em] text-slate-500">Maintenance</div>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Report a property issue</h2>
                <div className="mt-5 space-y-3">
                  <select
                    value={maintenanceForm.category}
                    onChange={(event) => setMaintenanceForm((current) => ({ ...current, category: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 focus:border-emerald-500 focus:outline-none"
                  >
                    {['Water', 'Gas', 'Electrical', 'Lift', 'Leakage', 'Security', 'Internet', 'Other'].map((category) => (
                      <option key={category} value={category}>{category} problem</option>
                    ))}
                  </select>
                  <input
                    value={maintenanceForm.title}
                    onChange={(event) => setMaintenanceForm((current) => ({ ...current, title: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-emerald-500 focus:outline-none"
                    placeholder="Issue title"
                  />
                  <textarea
                    value={maintenanceForm.description}
                    onChange={(event) => setMaintenanceForm((current) => ({ ...current, description: event.target.value }))}
                    className="min-h-28 w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-emerald-500 focus:outline-none"
                    placeholder="Describe what needs attention"
                  />
                  <button onClick={handleSubmitMaintenance} className="rounded-3xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">
                    Submit issue
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm uppercase tracking-[0.28em] text-slate-500">Move out</div>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900">Request to leave this property</h2>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                    {moveOutRequests.find((request) => String(request.listing?._id || request.listing) === String(selectedListingId) && request.status === "Pending")?.status || "No pending request"}
                  </span>
                </div>
                <textarea
                  value={moveOutReason}
                  onChange={(event) => setMoveOutReason(event.target.value)}
                  className="mt-5 min-h-24 w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-emerald-500 focus:outline-none"
                  placeholder="Optional reason"
                />
                <label className="mt-3 flex items-center gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={inspectionRequested}
                    onChange={(event) => setInspectionRequested(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Request a move-out inspection
                </label>
                <button
                  onClick={handleMoveOutRequest}
                  disabled={moveOutRequests.some((request) => String(request.listing?._id || request.listing) === String(selectedListingId) && request.status === "Pending")}
                  className="mt-3 rounded-3xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Request move out
                </button>
                <div className="mt-4 space-y-2">
                  {moveOutRequests.filter((request) => String(request.listing?._id || request.listing) === String(selectedListingId)).map((request) => (
                    <div key={request._id} className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                      <span className="font-semibold">{request.status}</span>{request.reason ? ` • ${request.reason}` : ""}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">My maintenance issues</h2>
                    <p className="text-sm text-slate-500">Track updates from the property owner.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{maintenanceIssues.length}</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {maintenanceIssues.map((issue) => (
                    <div key={issue._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{issue.category || "Other"} • {issue.title}</div>
                          <div className="mt-1 text-sm text-slate-600">{issue.description}</div>
                        </div>
                        <span className="shrink-0 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">{issue.status}</span>
                      </div>
                      <div className="mt-3 text-xs text-slate-500">{issue.listing?.title || "Property"}</div>
                    </div>
                  ))}
                  {maintenanceIssues.length === 0 && <div className="text-sm text-slate-500">No maintenance issues submitted yet.</div>}
                </div>
              </div>
            </section>

            {historyMode === "monthly" ? (
              <section className="grid gap-6 lg:grid-cols-[0.86fr_0.94fr]">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Monthly payments</h2>
                      <p className="text-sm text-slate-500">Review each month and select a payment record.</p>
                    </div>
                    <div className="text-sm text-slate-500">Showing {tenantHistory.length} months</div>
                  </div>

                  <div className="space-y-3">
                    {tenantHistory.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedMonthId(item.id)}
                        className={`w-full rounded-3xl border p-4 text-left transition ${
                          selectedMonthId === item.id
                            ? "border-emerald-500 bg-emerald-50 shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="font-semibold text-slate-900">{item.period}</div>
                            <div className="text-sm text-slate-500">Due {item.dueDate}</div>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            item.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-700'
                              : item.status === 'Overdue'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>{item.status}</span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-500">
                          <div>Total: {formatCurrency(item.totalDue)}</div>
                          <div>Remaining: {formatCurrency(item.remainingAmount)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4">
                    <div className="text-sm uppercase tracking-[0.28em] text-slate-500">Payment detail</div>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900">{selectedHistoryItem.period}</h2>
                  </div>

                  <div className="space-y-4">
                    {[
                      { label: "Rent", value: formatCurrency(selectedHistoryItem.rent) },
                      { label: "Service charge", value: formatCurrency(selectedHistoryItem.serviceCharge) },
                      { label: "Utilities", value: formatCurrency(selectedHistoryItem.utilities) },
                      { label: "Total due", value: formatCurrency(selectedHistoryItem.totalDue) },
                      { label: "Paid amount", value: formatCurrency(selectedHistoryItem.paidAmount) },
                      { label: "Remaining amount", value: formatCurrency(selectedHistoryItem.remainingAmount) },
                    ].map((item) => (
                      <div key={item.label} className="rounded-3xl bg-slate-50 p-4 border border-slate-200">
                        <div className="text-sm text-slate-500">{item.label}</div>
                        <div className="mt-2 text-lg font-semibold text-slate-900">{item.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-3xl bg-slate-100 p-5 border border-slate-200">
                    <div className="text-sm font-semibold text-slate-900">Pay this month online</div>
                    <div className="mt-4 space-y-3">
                      <div>
                          <label className="block text-sm font-medium text-slate-700">Amount to pay</label>
                        <input
                          type="number"
                          min="0"
                          value={paymentAmount}
                          onChange={(event) => setPaymentAmount(event.target.value)}
                          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 focus:border-emerald-500 focus:outline-none"
                          placeholder="Enter amount to pay"
                        />
                      </div>
                      <button
                        onClick={handleTenantPaymentSubmit}
                        disabled={!selectedHistoryItem._id || numberOrZero(selectedHistoryItem.remainingAmount) <= 0}
                        className="inline-flex items-center justify-center rounded-3xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition"
                      >
                        {selectedHistoryItem._id ? "Pay with SSLCommerz Sandbox" : "Payment unavailable"}
                      </button>
                      {!selectedHistoryItem._id && (
                        <div className="text-sm text-amber-700">
                          This property has no active ledger entry yet. Online payment becomes available after the rental agreement is activated.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="text-sm font-semibold text-slate-900">Monthly payment history</div>
                    <div className="mt-3 space-y-2">
                      {(selectedHistoryItem.paymentHistory || []).length === 0 ? (
                        <div className="text-sm text-slate-500">No online transactions for this month.</div>
                      ) : (
                        selectedHistoryItem.paymentHistory.map((payment) => (
                          <div key={payment._id || payment.transactionId} className="flex flex-col gap-1 rounded-2xl bg-slate-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                            <span className="font-mono text-xs text-slate-600">{payment.transactionId || "Transaction"}</span>
                            <span className="font-semibold text-slate-900">{formatCurrency(payment.amount)}</span>
                            <span className="text-emerald-700">{payment.status}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Yearly rent summary</h2>
                    <p className="text-sm text-slate-500">A higher level view of account totals for each year.</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
                    Total years: {yearlySummary.length}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {yearlySummary.map((year) => (
                    <div key={year.year} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">{year.year}</h3>
                          <div className="text-sm text-slate-500">{year.status}</div>
                        </div>
                        <div className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">{year.status}</div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-3xl bg-white p-4 border border-slate-200">
                          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Total due</div>
                          <div className="mt-2 text-xl font-semibold text-slate-900">{formatCurrency(year.totalDue)}</div>
                        </div>
                        <div className="rounded-3xl bg-white p-4 border border-slate-200">
                          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Paid</div>
                          <div className="mt-2 text-xl font-semibold text-slate-900">{formatCurrency(year.totalPaid)}</div>
                        </div>
                        <div className="rounded-3xl bg-white p-4 border border-slate-200">
                          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Remaining</div>
                          <div className="mt-2 text-xl font-semibold text-slate-900">{formatCurrency(year.totalRemaining)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

              </>
            ) : (
              <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
                <div className="text-sm uppercase tracking-[0.28em] text-amber-700">Tenant status</div>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">You are currently moved out</h2>
                <p className="mt-2 text-slate-700">Your previous rental records are available below. Active rent, maintenance, and move-out actions will appear again when you rent a property.</p>
              </section>
            )}

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm uppercase tracking-[0.28em] text-slate-500">Previous rentals</div>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">Previous rental history</h2>
                  <p className="mt-2 text-sm text-slate-500">Read-only payment records from properties you have moved out of.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{previousHistory.length} records</span>
              </div>
              <div className="mt-5 space-y-3">
                {previousHistory.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{entry.listing?.title || "Previous property"}</div>
                        <div className="mt-1 text-sm text-slate-500">{entry.period} • Due {entry.dueDate}</div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {entry.status}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                      <div>Total due: {formatCurrency(entry.totalDue)}</div>
                      <div>Paid: {formatCurrency(entry.paidAmount)}</div>
                      <div>Remaining: {formatCurrency(entry.remainingAmount)}</div>
                    </div>
                  </div>
                ))}
                {previousHistory.length === 0 && <div className="text-sm text-slate-500">No previous rental history is available yet.</div>}
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm uppercase tracking-[0.3em] text-slate-500">Owner workspace</div>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900">Monthly rent package</h2>
                    <p className="mt-2 text-slate-500">Select a property, edit its default monthly package, and save the changes.</p>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {!isEditingPackage ? (
                      <button
                        onClick={handleEditPackage}
                        className="rounded-3xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition"
                      >
                        Edit package
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={saveRentPackage}
                          className="rounded-3xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition"
                        >
                          Save package
                        </button>
                        <button
                          onClick={() => {
                            handlePropertySelect(selectedPropertyId);
                          }}
                          className="rounded-3xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-6 grid gap-4">
                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm uppercase tracking-[0.28em] text-slate-500">Tenants</div>
                        <div className="text-lg font-semibold text-slate-900">{selectedOwnerProperty.tenants.length} in this property</div>
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      {selectedOwnerProperty.tenants.map((tenant) => (
                        <button
                          key={tenant.id}
                          onClick={() => handleTenantSelect(tenant.id)}
                          className={`w-full rounded-3xl border p-4 text-left transition ${
                            tenant.id === selectedTenantId
                              ? "border-emerald-500 bg-emerald-50 shadow-sm"
                              : "border-slate-200 bg-slate-50 hover:border-slate-300"
                          }`}
                        >
                          <div className="font-semibold text-slate-900">{tenant.name}</div>
                          <div className="text-sm text-slate-500">Unit {tenant.unit}</div>
                          <div className="mt-2 text-sm text-slate-600">Status: {tenant.status}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm uppercase tracking-[0.28em] text-slate-500">Selected tenant</div>
                        <div className="text-lg font-semibold text-slate-900">{selectedTenant.name}</div>
                      </div>
                      <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{selectedTenant.status}</div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-slate-700">
                      <div>Unit: {selectedTenant.unit}</div>
                      <div>Due date: {selectedTenant.dueDate}</div>
                      <div>Paid this month: {formatCurrency(selectedTenant.paidThisMonth)}</div>
                      <div>Remaining: {formatCurrency(selectedTenant.remainingAmount)}</div>
                    </div>
                    <div className="mt-4 border-t border-slate-200 pt-4">
                      <div className="text-sm font-semibold text-slate-900">SSLCommerz transactions</div>
                      <div className="mt-2 space-y-2">
                        {(selectedTenant.paymentHistory || []).length === 0 ? (
                          <div className="text-sm text-slate-500">No online transactions this month.</div>
                        ) : (
                          selectedTenant.paymentHistory.map((payment) => (
                            <div key={payment._id || payment.transactionId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                              <span className="font-mono text-xs text-slate-600">{payment.transactionId}</span>
                              <span>{formatCurrency(payment.amount)}</span>
                              <span className="font-semibold text-emerald-700">{payment.status}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    {[
                      { label: "Base rent", field: "monthlyRent" },
                      { label: "Service charge", field: "serviceCharge" },
                      { label: "Utilities", field: "utilities" },
                    ].map((item) => (
                      <label key={item.field} className="rounded-3xl bg-slate-50 p-4 border border-slate-200">
                        <div className="text-sm text-slate-500">{item.label}</div>
                        <input
                          type="number"
                          min="0"
                          value={propertyForm[item.field]}
                          onChange={(event) => updatePropertyConfig(item.field, event.target.value)}
                          disabled={!isEditingPackage}
                          className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                        />
                      </label>
                    ))}
                  </div>

                  <div className="rounded-3xl bg-slate-50 p-4 border border-slate-200">
                    <div className="text-sm text-slate-500">Selected property</div>
                    <div className="mt-2 text-lg font-semibold text-slate-900">{selectedOwnerProperty.title}</div>
                    <div className="text-sm text-slate-600">{selectedOwnerProperty.location}</div>
                    <div className="mt-3 text-sm text-slate-700">Address: {selectedOwnerProperty.propertyAddress || "Address not provided"}</div>
                    <div className="mt-2 text-sm text-slate-700">
                      Tenant utilities: {(selectedOwnerProperty.utilityResponsibilities?.tenantResponsibilities || []).join(", ") || "As agreed by both parties"}
                    </div>
                    <div className="mt-1 text-sm text-slate-700">
                      Owner utilities: {(selectedOwnerProperty.utilityResponsibilities?.ownerResponsibilities || []).join(", ") || "As agreed by both parties"}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-slate-700">
                      <div>Current rent: {formatCurrency(selectedOwnerProperty.monthlyRent)}</div>
                      <div>Service charge: {formatCurrency(selectedOwnerProperty.serviceCharge)}</div>
                      <div>Utilities: {formatCurrency(selectedOwnerProperty.utilities)}</div>
                      <div>Total due: {formatCurrency(selectedOwnerProperty.currentMonthDue)}</div>
                    </div>
                  </div>

                  {tenantProperties.length > 0 && !selectedHistoryItem._id && (
                    <div className="mt-4 text-sm text-slate-500">This rental has property details but no monthly ledger entry yet. Online payment will be available after the rental agreement is activated.</div>
                  )}
                </div>
              </div>

              <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div>
                  <div className="text-sm uppercase tracking-[0.25em] text-slate-500">Current portfolio</div>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">{ownerProperties.length} properties</h2>
                </div>
                <div className="mt-6 space-y-3">
                  {ownerProperties.map((property) => (
                    <button
                      key={property.id}
                      onClick={() => handlePropertySelect(property.id)}
                      className={`w-full rounded-3xl bg-slate-50 p-4 border text-left transition ${
                        property.id === selectedPropertyId
                          ? "border-emerald-500 bg-emerald-50 shadow-sm"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{property.title}</div>
                          <div className="text-sm text-slate-500">{property.location}</div>
                        </div>
                        <div className="text-sm font-semibold text-slate-900">{property.status}</div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-600">
                        <div>Tenants: {property.tenants.length}</div>
                        <div>Due on {property.dueDate}</div>
                        <div>Due amount: {formatCurrency(property.currentMonthDue)}</div>
                        <div>Remaining: {formatCurrency(property.remainingThisMonth)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </aside>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm uppercase tracking-[0.28em] text-slate-500">Maintenance</div>
                    <h2 className="mt-2 text-xl font-bold text-slate-900">Issues for {selectedOwnerProperty.title || "this property"}</h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{(selectedOwnerProperty.maintenanceIssues || []).length}</span>
                </div>
                <div className="mt-4 space-y-3">
                  {(selectedOwnerProperty.maintenanceIssues || []).map((issue) => (
                    <div key={issue._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{issue.title}</div>
                          <div className="mt-1 text-sm text-slate-600">{issue.description}</div>
                          <div className="mt-2 text-xs text-slate-500">{issue.tenant?.name || "Tenant"}</div>
                        </div>
                        <select
                          value={issue.status}
                          onChange={(event) => updateMaintenanceStatus(issue._id, event.target.value)}
                          className="rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs font-semibold text-slate-700"
                        >
                          {['Submitted', 'Acknowledged', 'In Progress', 'Resolved', 'Closed'].map((status) => <option key={status}>{status}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                  {(selectedOwnerProperty.maintenanceIssues || []).length === 0 && <div className="text-sm text-slate-500">No maintenance issues for this property.</div>}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm uppercase tracking-[0.28em] text-slate-500">Move-out requests</div>
                    <h2 className="mt-2 text-xl font-bold text-slate-900">Requests for {selectedOwnerProperty.title || "this property"}</h2>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">{(selectedOwnerProperty.moveOutRequests || []).filter((request) => request.status === "Pending").length} pending</span>
                </div>
                <div className="mt-4 space-y-3">
                  {(selectedOwnerProperty.moveOutRequests || []).map((request) => (
                    <div key={request._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{request.tenant?.name || "Tenant"}</div>
                          <div className="mt-1 text-sm text-slate-600">{request.reason || "No reason provided"}</div>
                          {request.inspectionRequested && <div className="mt-2 text-xs font-semibold text-emerald-700">Inspection requested</div>}
                          <div className="mt-2 text-xs font-semibold text-slate-500">{request.status}</div>
                        </div>
                        {request.status === "Pending" && (
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <button onClick={() => decideMoveOut(request._id, "Accepted")} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">Accept</button>
                            <button onClick={() => decideMoveOut(request._id, "Rejected")} className="rounded-xl bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300">Reject</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {(selectedOwnerProperty.moveOutRequests || []).length === 0 && <div className="text-sm text-slate-500">No move-out requests for this property.</div>}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Latest payment requests</h2>
                  <p className="text-sm text-slate-500">Requests waiting for owner approval.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                  {pendingApprovals.length} pending
                </span>
              </div>

              <div className="space-y-3">
                {paymentRequests.map((request) => (
                  <div key={request.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{request.tenant}</div>
                        <div className="text-sm text-slate-500">{request.property} • {request.month}</div>
                      </div>
                      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
                        request.status === 'Approved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {request.status}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-slate-700">Requested amount: {formatCurrency(request.requestedAmount)}</div>
                      {request.status === "Pending" && (
                        <button
                          onClick={() => handleApprovePayment(request.id)}
                          className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
                        >
                          Approve payment
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Tenant payment status</h2>
                  <p className="text-sm text-slate-500">See all tenant progress, requests, and record received amounts.</p>
                </div>
                <div className="rounded-3xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
                  Pending approvals: {pendingApprovals.length}
                </div>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-700">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-4 pr-6">Property</th>
                      <th className="py-4 pr-6">Tenant</th>
                      <th className="py-4 pr-6">Due amount</th>
                      <th className="py-4 pr-6">Paid</th>
                      <th className="py-4 pr-6">Remaining</th>
                      <th className="py-4 pr-6">Status</th>
                      <th className="py-4 pl-6">Record received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {ownerProperties.map((property) => (
                      <tr key={property.id}>
                        <td className="py-4 pr-6 font-semibold text-slate-900">{property.title}</td>
                        <td className="py-4 pr-6">{property.tenants.length > 1 ? `${property.tenants[0]?.name} +${property.tenants.length - 1}` : property.tenants[0]?.name || "No tenant"}</td>
                        <td className="py-4 pr-6">{formatCurrency(property.currentMonthDue)}</td>
                        <td className="py-4 pr-6">{formatCurrency(property.paidThisMonth)}</td>
                        <td className="py-4 pr-6">{formatCurrency(property.remainingThisMonth)}</td>
                        <td className="py-4 pr-6">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            property.status === "Paid"
                              ? "bg-emerald-100 text-emerald-700"
                              : property.status === "Overdue"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                          }`}>
                            {property.status}
                          </span>
                        </td>
                        <td className="py-4 pl-6">
                          <div className="flex flex-col gap-2">
                            <input
                              type="number"
                              min="0"
                              value={manualReceived[property.id] || ""}
                              onChange={(event) => handleManualReceivedChange(property.id, event.target.value)}
                              className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                              placeholder="৳ amount"
                            />
                            <button
                              onClick={() => handleRecordReceived(property.id)}
                              className="rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
                            >
                              Record
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export default RentLedger;
