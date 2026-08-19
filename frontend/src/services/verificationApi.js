import api from './api';

export const getMyVerificationProperties = () => api.get('/api/verification/my-properties');
export const getVerificationStatus = (propertyId) => api.get(`/api/verification/status/${propertyId}`);
export const submitVerification = (formData, onUploadProgress) => api.post('/api/verification/submit', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
  onUploadProgress,
});
export const sendVerificationOtp = (propertyId, phone) => api.post('/api/verification/send-otp', { propertyId, phone });
export const verifyVerificationOtp = (propertyId, otp) => api.post('/api/verification/verify-otp', { propertyId, otp });

export const getVerificationQueue = (params) => api.get('/api/admin/verifications', { params });
export const getVerificationDetails = (id) => api.get(`/api/admin/verifications/${id}`);
export const reviewVerification = (id, data) => api.put(`/api/admin/verifications/${id}/review`, data);
export const getVerificationStats = () => api.get('/api/admin/verifications/stats');
export const getDuplicateFlags = (params) => api.get('/api/admin/duplicates', { params });
export const resolveDuplicateFlag = (id, data) => api.put(`/api/admin/duplicates/${id}/resolve`, data);
