import api from './api';

export const getReviewEligibility = (propertyId) => api.get(`/api/reviews/eligibility/${propertyId}`);
export const submitReview = (formData) => api.post('/api/reviews', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getPropertyReviews = (propertyId, params) => api.get(`/api/reviews/property/${propertyId}`, { params });
export const getReviewStats = (propertyId) => api.get(`/api/reviews/property/${propertyId}/stats`);
export const markReviewHelpful = (reviewId) => api.post(`/api/reviews/${reviewId}/helpful`);
export const reportReview = (reviewId) => api.post(`/api/reviews/${reviewId}/report`);
export const respondToReview = (reviewId, text) => api.post(`/api/reviews/${reviewId}/owner-response`, { text });
export const getFraudReports = (params) => api.get('/api/admin/fraud-reports', { params });
export const getFraudStats = () => api.get('/api/admin/fraud-reports/stats');
export const updateFraudReport = (id, data) => api.put(`/api/admin/fraud-reports/${id}`, data);
export const getFraudReportDetails = (id) => api.get(`/api/admin/fraud-reports/${id}`);
export const submitFraudReport = (formData) => api.post('/api/fraud-reports', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
