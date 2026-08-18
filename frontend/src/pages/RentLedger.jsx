import { useMemo, useState } from "react";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value).replace("BDT", "৳");

const mockTenantHistory = [
  {
    id: 1,
    period: "August 2026",
    dueDate: "2026-08-15",
    rent: 32000,
    serviceCharge: 4500,
    utilities: 2200,
    totalDue: 38700,
    paidAmount: 20000,
    remainingAmount: 18700,
    status: "Partially Paid",
    note: "Partial payment received, balance pending.",
  },
  {
    id: 2,
    period: "July 2026",
    dueDate: "2026-07-15",
    rent: 32000,
    serviceCharge: 4500,
    utilities: 2200,
    totalDue: 38700,
    paidAmount: 38700,
    remainingAmount: 0,
    status: "Paid",
    note: "Completed on time.",
  },
  {
    id: 3,
    period: "June 2026",
    dueDate: "2026-06-15",
    rent: 32000,
    serviceCharge: 4500,
    utilities: 2200,
    totalDue: 38700,
    paidAmount: 0,
    remainingAmount: 38700,
    status: "Overdue",
    note: "Payment overdue and reminder sent.",
  },
  {
    id: 4,
    period: "May 2026",
    dueDate: "2026-05-15",
    rent: 32000,
    serviceCharge: 4500,
    utilities: 2200,
    totalDue: 38700,
    paidAmount: 38700,
    remainingAmount: 0,
    status: "Paid",
    note: "Approved by owner.",
  },
];

const mockYearlySummary = [
  {
    year: "2026",
    totalDue: 464400,
    totalPaid: 380000,
    totalRemaining: 84400,
    status: "Active",
  },
  {
    year: "2025",
    totalDue: 464400,
    totalPaid: 464400,
    totalRemaining: 0,
    status: "Completed",
  },
];

const mockOwnerProperties = [
  {
    id: "p1",
    title: "Skyline Residency",
    location: "Dhaka, Bashundhara",
    tenants: [
      {
        id: "t1",
        name: "Anika Rahman",
        unit: "A-102",
        status: "Partially Paid",
        dueDate: "15 Aug 2026",
        paidThisMonth: 20000,
      },
      {
        id: "t2",
        name: "Farhan Karim",
        unit: "A-103",
        status: "Paid",
        dueDate: "15 Aug 2026",
        paidThisMonth: 38700,
      },
    ],
    monthlyRent: 32000,
    serviceCharge: 4500,
    utilities: 2200,
    dueDate: "15 Aug 2026",
    status: "Partially Paid",
    currentMonthDue: 38700,
    paidThisMonth: 20000,
    remainingThisMonth: 18700,
  },
  {
    id: "p2",
    title: "Harbor Heights",
    location: "Chattogram, GEC",
    tenants: [
      {
        id: "t3",
        name: "Rafi Ahmed",
        unit: "B-15",
        status: "Unpaid",
        dueDate: "18 Aug 2026",
        paidThisMonth: 0,
      },
      {
        id: "t4",
        name: "Sara Islam",
        unit: "B-16",
        status: "Partially Paid",
        dueDate: "18 Aug 2026",
        paidThisMonth: 16000,
      },
    ],
    monthlyRent: 28500,
    serviceCharge: 3800,
    utilities: 2100,
    dueDate: "18 Aug 2026",
    status: "Unpaid",
    currentMonthDue: 34400,
    paidThisMonth: 0,
    remainingThisMonth: 34400,
  },
  {
    id: "p3",
    title: "Lake View Homes",
    location: "Sylhet, Amberkhana",
    tenants: [
      {
        id: "t5",
        name: "Nusrat Jahan",
        unit: "C-07",
        status: "Paid",
        dueDate: "21 Aug 2026",
        paidThisMonth: 29000,
      },
    ],
    monthlyRent: 24000,
    serviceCharge: 3200,
    utilities: 1800,
    dueDate: "21 Aug 2026",
    status: "Paid",
    currentMonthDue: 29000,
    paidThisMonth: 29000,
    remainingThisMonth: 0,
  },
];

const mockPaymentRequests = [
  {
    id: 1,
    tenant: "Anika Rahman",
    property: "Skyline Residency",
    month: "August 2026",
    requestedAmount: 18700,
    status: "Pending",
  },
  {
    id: 2,
    tenant: "Rafi Ahmed",
    property: "Harbor Heights",
    month: "August 2026",
    requestedAmount: 34400,
    status: "Pending",
  },
];

function RentLedger() {
  const [viewMode, setViewMode] = useState("tenant");
  const [historyMode, setHistoryMode] = useState("monthly");
  const [selectedMonthId, setSelectedMonthId] = useState(1);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentRequests, setPaymentRequests] = useState(mockPaymentRequests);
  const [tenantHistory, setTenantHistory] = useState(mockTenantHistory);
  const [ownerProperties, setOwnerProperties] = useState(mockOwnerProperties);
  const [selectedPropertyId, setSelectedPropertyId] = useState(mockOwnerProperties[0].id);
  const [selectedTenantId, setSelectedTenantId] = useState(mockOwnerProperties[0].tenants[0].id);
  const [propertyForm, setPropertyForm] = useState({
    monthlyRent: mockOwnerProperties[0].monthlyRent,
    serviceCharge: mockOwnerProperties[0].serviceCharge,
    utilities: mockOwnerProperties[0].utilities,
  });
  const [isEditingPackage, setIsEditingPackage] = useState(false);
  const [manualReceived, setManualReceived] = useState({});
  const [notifications, setNotifications] = useState({
    tenant: [
      {
        id: 1,
        title: "Upcoming rent due",
        description: "Your next rent installment for Skyline Residency is due on 15 Aug 2026.",
        tone: "bg-amber-50 text-amber-800",
      },
      {
        id: 2,
        title: "Payment request pending",
        description: "Your request is waiting for owner approval.",
        tone: "bg-blue-50 text-blue-800",
      },
    ],
    owner: [
      {
        id: 1,
        title: "Payment request pending",
        description: "A tenant has requested payment approval.",
        tone: "bg-blue-50 text-blue-800",
      },
      {
        id: 2,
        title: "Reminder sent",
        description: "A reminder was sent to a tenant for an overdue payment.",
        tone: "bg-red-50 text-red-800",
      },
    ],
  });
  const [notificationOpen, setNotificationOpen] = useState(false);

  const currentNotifications = useMemo(
    () => notifications[viewMode] || [],
    [notifications, viewMode]
  );

  const selectedHistoryItem = useMemo(
    () => tenantHistory.find((item) => item.id === selectedMonthId) || tenantHistory[0],
    [tenantHistory, selectedMonthId]
  );

  const selectedOwnerProperty = useMemo(
    () => ownerProperties.find((property) => property.id === selectedPropertyId) || ownerProperties[0],
    [ownerProperties, selectedPropertyId]
  );

  const selectedTenant = useMemo(
    () => selectedOwnerProperty.tenants.find((tenant) => tenant.id === selectedTenantId) || selectedOwnerProperty.tenants[0],
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

  const handleTenantPaymentSubmit = () => {
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) return;

    const tenantName = selectedTenant?.name || "Tenant";
    const propertyName = selectedOwnerProperty?.title || "selected property";

    setPaymentRequests((current) => [
      ...current,
      {
        id: current.length + 1,
        tenant: tenantName,
        property: propertyName,
        month: selectedHistoryItem.period,
        requestedAmount: amount,
        status: "Pending",
      },
    ]);

    setNotifications((current) => ({
      tenant: [
        {
          id: current.tenant.length + 1,
          title: "Payment request pending",
          description: "Payment request is waiting for owner approval.",
          tone: "bg-blue-50 text-blue-800",
        },
        ...current.tenant,
      ],
      owner: [
        {
          id: current.owner.length + 1,
          title: "Payment request received",
          description: "A tenant has sent a new payment request.",
          tone: "bg-blue-50 text-blue-800",
        },
        ...current.owner,
      ],
    }));

    setPaymentAmount(0);
  };

  const handleApprovePayment = (requestId) => {
    const request = paymentRequests.find((item) => item.id === requestId);
    if (!request || request.status !== "Pending") return;

    setPaymentRequests((current) =>
      current.map((item) =>
        item.id === requestId ? { ...item, status: "Approved" } : item
      )
    );

    setTenantHistory((current) =>
      current.map((item) => {
        if (item.period !== request.month) return item;
        const paidAmount = item.paidAmount + request.requestedAmount;
        const remainingAmount = Math.max(item.totalDue - paidAmount, 0);
        const status = paidAmount === 0 ? "Overdue" : remainingAmount === 0 ? "Paid" : "Partially Paid";
        return { ...item, paidAmount, remainingAmount, status };
      })
    );

    setOwnerProperties((current) =>
      current.map((property) => {
        if (property.title !== request.property) return property;
        const paidThisMonth = property.paidThisMonth + request.requestedAmount;
        const remainingThisMonth = Math.max(property.currentMonthDue - paidThisMonth, 0);
        const status = paidThisMonth === 0 ? "Unpaid" : remainingThisMonth === 0 ? "Paid" : "Partially Paid";
        return { ...property, paidThisMonth, remainingThisMonth, status };
      })
    );
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

  const saveRentPackage = () => {
    setOwnerProperties((current) =>
      current.map((property) => {
        if (property.id !== selectedPropertyId) return property;
        const updatedDue = propertyForm.monthlyRent + propertyForm.serviceCharge + propertyForm.utilities;
        const paidThisMonth = property.paidThisMonth;
        const remainingThisMonth = Math.max(updatedDue - paidThisMonth, 0);
        const status = paidThisMonth === 0 ? "Unpaid" : remainingThisMonth === 0 ? "Paid" : "Partially Paid";

        return {
          ...property,
          monthlyRent: propertyForm.monthlyRent,
          serviceCharge: propertyForm.serviceCharge,
          utilities: propertyForm.utilities,
          currentMonthDue: updatedDue,
          remainingThisMonth,
          status,
        };
      })
    );
    setIsEditingPackage(false);
  };

  const handleRecordReceived = (propertyId) => {
    const amount = Number(manualReceived[propertyId]);
    if (!amount || amount <= 0) return;

    setOwnerProperties((current) =>
      current.map((property) => {
        if (property.id !== propertyId) return property;
        const paidThisMonth = property.paidThisMonth + amount;
        const remainingThisMonth = Math.max(property.currentMonthDue - paidThisMonth, 0);
        return {
          ...property,
          paidThisMonth,
          remainingThisMonth,
          status: remainingThisMonth === 0 ? "Paid" : "Partially Paid",
        };
      })
    );

    setManualReceived((current) => ({
      ...current,
      [propertyId]: "",
    }));
  };

  const updatePropertyConfig = (field, value) => {
    setPropertyForm((current) => ({ ...current, [field]: Number(value) }));
  };

  const createRentPackage = () => {
    saveRentPackage();
  };

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm uppercase tracking-[0.33em] text-emerald-600 font-semibold">Rent Ledger</div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Tenant & owner payment tracker</h1>
              <p className="mt-2 text-slate-600 max-w-2xl">
                Review rent history, switch between monthly or yearly summaries, and manage payment requests using mock property data.
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
            <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm uppercase tracking-[0.3em] text-slate-500">Tenant summary</div>
                    <h2 className="mt-3 text-2xl font-bold text-slate-900">Skyline Residency • A-102</h2>
                    <p className="mt-2 text-slate-500">Tenant: Anika Rahman</p>
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

            {historyMode === "monthly" ? (
              <section className="grid gap-6 lg:grid-cols-[0.86fr_0.94fr]">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Monthly payments</h2>
                      <p className="text-sm text-slate-500">Review each month and select a payment record.</p>
                    </div>
                    <div className="text-sm text-slate-500">Showing 4 months</div>
                  </div>

                  <div className="space-y-3">
                    {mockTenantHistory.map((item) => (
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
                    <div className="text-sm font-semibold text-slate-900">Request payment approval</div>
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Amount paid</label>
                        <input
                          type="number"
                          min="0"
                          value={paymentAmount}
                          onChange={(event) => setPaymentAmount(event.target.value)}
                          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 focus:border-emerald-500 focus:outline-none"
                          placeholder="Enter amount you paid"
                        />
                      </div>
                      <button
                        onClick={handleTenantPaymentSubmit}
                        className="inline-flex items-center justify-center rounded-3xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition"
                      >
                        Submit payment request
                      </button>
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
                    Total years: {mockYearlySummary.length}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {mockYearlySummary.map((year) => (
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
                      <div>Remaining: {formatCurrency(Math.max(selectedOwnerProperty.currentMonthDue - selectedTenant.paidThisMonth, 0))}</div>
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
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-slate-700">
                      <div>Current rent: {formatCurrency(selectedOwnerProperty.monthlyRent)}</div>
                      <div>Service charge: {formatCurrency(selectedOwnerProperty.serviceCharge)}</div>
                      <div>Utilities: {formatCurrency(selectedOwnerProperty.utilities)}</div>
                      <div>Total due: {formatCurrency(selectedOwnerProperty.currentMonthDue)}</div>
                    </div>
                  </div>
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
