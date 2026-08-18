// utils/application-helpers.js

/**
 * Get tenant type display name
 */
const getTenantTypeDisplay = (type) => {
  const types = {
    'family': 'Family',
    'couple': 'Couple',
    'single_professional': 'Single Professional',
    'student': 'Student',
    'group': 'Group'
  };
  return types[type] || type;
};

/**
 * Get income range display
 */
const getIncomeRangeDisplay = (range) => {
  const ranges = {
    'below_20000': 'Below ৳20,000',
    '20000_40000': '৳20,000 - ৳40,000',
    '40000_60000': '৳40,000 - ৳60,000',
    '60000_80000': '৳60,000 - ৳80,000',
    '80000_100000': '৳80,000 - ৳100,000',
    '100000_150000': '৳100,000 - ৳150,000',
    '150000_above': 'Above ৳150,000'
  };
  return ranges[range] || range;
};

/**
 * Get lease duration display
 */
const getLeaseDurationDisplay = (duration) => {
  const durations = {
    '3_months': '3 Months',
    '6_months': '6 Months',
    '1_year': '1 Year',
    '2_years': '2 Years',
    'flexible': 'Flexible'
  };
  return durations[duration] || duration;
};

/**
 * Get occupation display
 */
const getOccupationDisplay = (occupation) => {
  const occupations = {
    'employed': 'Employed',
    'self_employed': 'Self-Employed',
    'student': 'Student',
    'retired': 'Retired',
    'unemployed': 'Unemployed',
    'business_owner': 'Business Owner'
  };
  return occupations[occupation] || occupation;
};

/**
 * Calculate budget compatibility score
 */
const calculateBudgetCompatibility = (application, listing) => {
  const incomeThresholds = {
    'below_20000': 20000,
    '20000_40000': 40000,
    '40000_60000': 60000,
    '60000_80000': 80000,
    '80000_100000': 100000,
    '100000_150000': 150000,
    '150000_above': 150000
  };
  
  const income = incomeThresholds[application.income_range] || 0;
  const rent = listing.monthly_rent_bdt || 0;
  
  if (income === 0 || rent === 0) return 0;
  
  const ratio = rent / income;
  
  // Score: 100 if rent <= 30% of income, decreases after that
  if (ratio <= 0.3) return 100;
  if (ratio <= 0.4) return 80;
  if (ratio <= 0.5) return 60;
  if (ratio <= 0.6) return 40;
  if (ratio <= 0.7) return 20;
  return 10;
};

/**
 * Compare applications and return comparison data
 */
const compareApplications = (applications, listing) => {
  return applications.map(app => {
    const budgetScore = calculateBudgetCompatibility(app, listing);
    
    return {
      application: app,
      tenant: app.tenant_id,
      metrics: {
        budgetCompatibility: budgetScore,
        moveInDate: app.move_in_date,
        occupants: app.number_of_occupants,
        tenantType: getTenantTypeDisplay(app.tenant_type),
        occupation: getOccupationDisplay(app.occupation),
        completionPercentage: app.completion_percentage || 0,
        incomeRange: getIncomeRangeDisplay(app.income_range),
        leaseDuration: getLeaseDurationDisplay(app.preferred_lease_duration),
        status: app.status,
        submittedAt: app.submitted_at
      }
    };
  });
};

module.exports = {
  getTenantTypeDisplay,
  getIncomeRangeDisplay,
  getLeaseDurationDisplay,
  getOccupationDisplay,
  calculateBudgetCompatibility,
  compareApplications
};