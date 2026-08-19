import api from './api';

export const generateTelegramCode = () => api.post('/api/notifications/telegram/generate-code');
export const unlinkTelegram = () => api.post('/api/notifications/telegram/unlink');
export const getTelegramStatus = () => api.get('/api/notifications/status');
export const getNotificationHistory = (params) => api.get('/api/notifications/history', { params });
export const updateNotificationPreferences = (preferences) => api.put('/api/notifications/preferences', preferences);
export const sendTelegramTest = () => api.post('/api/notifications/test');
