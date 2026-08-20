import { useMemo, useState } from "react";

function RentCalculator() {
  const [form, setForm] = useState({
    monthlyRent: "",
    advancePayment: "",
    serviceCharge: "",
    utilityBills: "",
    wifiCost: "",
    parkingFee: "",
    brokerFee: "",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const parsedValue = (value) => {
    const number = parseFloat(value);
    return Number.isFinite(number) ? number : 0;
  };

  const monthlyCost = useMemo(() => {
    return (
      parsedValue(form.monthlyRent) +
      parsedValue(form.serviceCharge) +
      parsedValue(form.utilityBills) +
      parsedValue(form.wifiCost) +
      parsedValue(form.parkingFee)
    );
  }, [form]);

  const moveInCost = useMemo(() => {
    return parsedValue(form.advancePayment) + parsedValue(form.brokerFee) + monthlyCost;
  }, [form, monthlyCost]);

  const affordabilityMessage = useMemo(() => {
    if (!monthlyCost) return "Enter your values to see the estimated monthly rental cost.";
    return monthlyCost > 0
      ? `Estimated monthly rental cost is ৳${monthlyCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}.`
      : "Enter all costs to calculate your rent affordability.";
  }, [monthlyCost]);

  return (
    <div className="p-8">
      <div className="rounded-3xl bg-white p-8 shadow-lg border border-slate-200 max-w-5xl mx-auto">
        <div className="mb-8 text-center">
          <div className="text-sm uppercase tracking-[0.3em] text-emerald-600 font-semibold">Under Properties</div>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">Move-In Cost and Rent Affordability Calculator</h1>
          <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
            Calculate the estimated per month rental cost before applying for a home. The calculation includes monthly rent,
            advance payment, service charge, utility bills, Wi-Fi cost, parking fee, and broker fee where applicable.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <div className="rounded-3xl bg-slate-50 p-6 border border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Rental Inputs</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Monthly Rent (৳)</span>
                  <input
                    name="monthlyRent"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.monthlyRent}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-emerald-500 focus:outline-none"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Advance Payment (৳)</span>
                  <input
                    name="advancePayment"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.advancePayment}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-emerald-500 focus:outline-none"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Service Charge (৳)</span>
                  <input
                    name="serviceCharge"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.serviceCharge}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-emerald-500 focus:outline-none"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Utility Bills (৳)</span>
                  <input
                    name="utilityBills"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.utilityBills}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-emerald-500 focus:outline-none"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Wi-Fi Cost (৳)</span>
                  <input
                    name="wifiCost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.wifiCost}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-emerald-500 focus:outline-none"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Parking Fee (৳)</span>
                  <input
                    name="parkingFee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.parkingFee}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-emerald-500 focus:outline-none"
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Broker Fee (৳)</span>
                  <input
                    name="brokerFee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.brokerFee}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-emerald-500 focus:outline-none"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 border border-slate-200 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-3">How it works</h2>
              <ul className="space-y-3 text-slate-600">
                <li>• Monthly rent is combined with service, utility, Wi-Fi, and parking costs.</li>
                <li>• Advance payment and broker fee are treated as move-in cost elements.</li>
                <li>• The calculator helps estimate a realistic monthly budget before application.</li>
              </ul>
            </div>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-emerald-600 via-slate-900 to-slate-950 text-white p-8 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6">Estimated Costs</h2>
            <div className="space-y-5">
              <div className="rounded-3xl bg-white/10 p-5">
                <div className="text-sm uppercase tracking-[0.25em] text-emerald-200">Monthly rental cost</div>
                <div className="mt-3 text-4xl font-bold">৳{monthlyCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              </div>
              <div className="rounded-3xl bg-white/10 p-5">
                <div className="text-sm uppercase tracking-[0.25em] text-emerald-200">Move-in cost estimate</div>
                <div className="mt-3 text-4xl font-bold">৳{moveInCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              </div>
              <div className="rounded-3xl bg-white/10 p-5">
                <div className="text-sm uppercase tracking-[0.25em] text-emerald-200">Affordability summary</div>
                <p className="mt-3 text-slate-100 leading-7">{affordabilityMessage}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RentCalculator;
