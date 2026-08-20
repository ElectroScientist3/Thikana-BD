// src/components/TenantApplicationForm.jsx
import { useState, useEffect } from 'react';
import { useApplications } from '../hooks/useApplications';

const TENANT_TYPES = [
  { value: 'family', label: 'Family' },
  { value: 'couple', label: 'Couple' },
  { value: 'single_professional', label: 'Single Professional' },
  { value: 'student', label: 'Student' },
  { value: 'group', label: 'Group' }
];

const OCCUPATIONS = [
  { value: 'employed', label: 'Employed' },
  { value: 'self_employed', label: 'Self-Employed' },
  { value: 'student', label: 'Student' },
  { value: 'retired', label: 'Retired' },
  { value: 'unemployed', label: 'Unemployed' },
  { value: 'business_owner', label: 'Business Owner' }
];

const INCOME_RANGES = [
  { value: 'below_20000', label: 'Below ৳20,000' },
  { value: '20000_40000', label: '৳20,000 - ৳40,000' },
  { value: '40000_60000', label: '৳40,000 - ৳60,000' },
  { value: '60000_80000', label: '৳60,000 - ৳80,000' },
  { value: '80000_100000', label: '৳80,000 - ৳100,000' },
  { value: '100000_150000', label: '৳100,000 - ৳150,000' },
  { value: '150000_above', label: 'Above ৳150,000' }
];

const PET_POLICIES = [
  { value: 'no_pets', label: 'No Pets' },
  { value: 'small_pets', label: 'Small Pets' },
  { value: 'large_pets', label: 'Large Pets' },
  { value: 'any_pets', label: 'Any Pets' }
];

function TenantApplicationForm({ 
  isOpen, 
  onClose, 
  listing, 
  onSuccess,
  viewingAppointmentId 
}) {
  const { submitApplication, loading } = useApplications();
  const [form, setForm] = useState({
    listing_id: '',
    viewing_appointment_id: '',
    move_in_date: '',
    number_of_occupants: 1,
    tenant_type: '',
    occupation: '',
    employer_institution: '',
    job_title: '',
    income_range: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: '',
    additional_notes: '',
    pet_policy: 'no_pets',
    smoking_allowed: false,
    supporting_documents: []
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (listing) {
      setForm(prev => ({
        ...prev,
        listing_id: listing._id,
        viewing_appointment_id: viewingAppointmentId || ''
      }));
    }
  }, [listing, viewingAppointmentId]);

  if (!isOpen || !listing) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    const required = [
      'move_in_date', 'number_of_occupants', 'tenant_type', 'occupation',
      'income_range', 'emergency_contact_name', 'emergency_contact_phone',
      'emergency_contact_relationship'
    ];

    required.forEach(field => {
      if (!form[field]) {
        newErrors[field] = 'This field is required';
      }
    });

    if (form.number_of_occupants < 1) {
      newErrors.number_of_occupants = 'Must have at least 1 occupant';
    }

    if (form.number_of_occupants > 20) {
      newErrors.number_of_occupants = 'Cannot have more than 20 occupants';
    }

    const selectedDate = new Date(form.move_in_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      newErrors.move_in_date = 'Move-in date must be in the future';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const result = await submitApplication(form);
      if (result) {
        onSuccess && onSuccess(result);
        onClose();
        // Reset form
        setForm({
          listing_id: listing._id,
          viewing_appointment_id: viewingAppointmentId || '',
          move_in_date: '',
          number_of_occupants: 1,
          tenant_type: '',
          occupation: '',
          employer_institution: '',
          job_title: '',
          income_range: '',
          emergency_contact_name: '',
          emergency_contact_phone: '',
          emergency_contact_relationship: '',
          additional_notes: '',
          pet_policy: 'no_pets',
          smoking_allowed: false,
          supporting_documents: []
        });
      }
    } catch (err) {
      alert(err.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-2 border-b border-slate-200">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Rental Application</h3>
            <p className="text-sm text-slate-500">{listing.title} - {listing.area}, {listing.city}</p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl hover:text-slate-700 p-1"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Move-in Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Move-in Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="move_in_date"
                value={form.move_in_date}
                onChange={handleChange}
                min={today}
                className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.move_in_date ? 'border-red-500' : 'border-slate-300'
                }`}
              />
              {errors.move_in_date && (
                <p className="text-xs text-red-500 mt-1">{errors.move_in_date}</p>
              )}
            </div>

            {/* Number of Occupants */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Number of Occupants <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="number_of_occupants"
                value={form.number_of_occupants}
                onChange={handleChange}
                min="1"
                max="20"
                className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.number_of_occupants ? 'border-red-500' : 'border-slate-300'
                }`}
              />
              {errors.number_of_occupants && (
                <p className="text-xs text-red-500 mt-1">{errors.number_of_occupants}</p>
              )}
            </div>

            {/* Tenant Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tenant Type <span className="text-red-500">*</span>
              </label>
              <select
                name="tenant_type"
                value={form.tenant_type}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.tenant_type ? 'border-red-500' : 'border-slate-300'
                }`}
              >
                <option value="">Select tenant type</option>
                {TENANT_TYPES.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {errors.tenant_type && (
                <p className="text-xs text-red-500 mt-1">{errors.tenant_type}</p>
              )}
            </div>

            {/* Occupation */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Occupation Status <span className="text-red-500">*</span>
              </label>
              <select
                name="occupation"
                value={form.occupation}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.occupation ? 'border-red-500' : 'border-slate-300'
                }`}
              >
                <option value="">Select occupation</option>
                {OCCUPATIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {errors.occupation && (
                <p className="text-xs text-red-500 mt-1">{errors.occupation}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Employer / Institution
                </label>
                <input
                  type="text"
                  name="employer_institution"
                  value={form.employer_institution}
                  onChange={handleChange}
                  placeholder="Company or school name"
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Job Title
                </label>
                <input
                  type="text"
                  name="job_title"
                  value={form.job_title}
                  onChange={handleChange}
                  placeholder="Your position"
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Income Range */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Monthly Income Range <span className="text-red-500">*</span>
              </label>
              <select
                name="income_range"
                value={form.income_range}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.income_range ? 'border-red-500' : 'border-slate-300'
                }`}
              >
                <option value="">Select income range</option>
                {INCOME_RANGES.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {errors.income_range && (
                <p className="text-xs text-red-500 mt-1">{errors.income_range}</p>
              )}
            </div>

            {/* Emergency Contact */}
            <div className="border-t border-slate-200 pt-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Emergency Contact</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Contact Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="emergency_contact_name"
                    value={form.emergency_contact_name}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.emergency_contact_name ? 'border-red-500' : 'border-slate-300'
                    }`}
                  />
                  {errors.emergency_contact_name && (
                    <p className="text-xs text-red-500 mt-1">{errors.emergency_contact_name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="emergency_contact_phone"
                    value={form.emergency_contact_phone}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.emergency_contact_phone ? 'border-red-500' : 'border-slate-300'
                    }`}
                  />
                  {errors.emergency_contact_phone && (
                    <p className="text-xs text-red-500 mt-1">{errors.emergency_contact_phone}</p>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Relationship <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="emergency_contact_relationship"
                  value={form.emergency_contact_relationship}
                  onChange={handleChange}
                  placeholder="e.g., Spouse, Parent, Sibling"
                  className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.emergency_contact_relationship ? 'border-red-500' : 'border-slate-300'
                  }`}
                />
                {errors.emergency_contact_relationship && (
                  <p className="text-xs text-red-500 mt-1">{errors.emergency_contact_relationship}</p>
                )}
              </div>
            </div>

            {/* Pet Policy */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Pet Policy
              </label>
              <select
                name="pet_policy"
                value={form.pet_policy}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PET_POLICIES.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            {/* Smoking Allowed */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="smoking_allowed"
                checked={form.smoking_allowed}
                onChange={handleChange}
                className="w-4 h-4 rounded"
              />
              <label className="text-sm text-slate-700">Smoking is allowed</label>
            </div>

            {/* Additional Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Additional Notes
              </label>
              <textarea
                name="additional_notes"
                value={form.additional_notes}
                onChange={handleChange}
                rows="3"
                placeholder="Any additional information you'd like to share..."
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-xl hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
            >
              {submitting || loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TenantApplicationForm;