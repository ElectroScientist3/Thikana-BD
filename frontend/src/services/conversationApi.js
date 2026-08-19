import api from './api';

export const getConversations = () => api.get('/api/conversations');
export const startConversation = (propertyId) => api.post('/api/conversations/start', { propertyId });
export const getConversationMessages = (conversationId, params) => api.get(`/api/conversations/${conversationId}/messages`, { params });
export const sendConversationMessage = (conversationId, content) => api.post(`/api/conversations/${conversationId}/messages`, { content });
export const markConversationRead = (conversationId) => api.put(`/api/conversations/${conversationId}/read`);
export const getConversationUnreadCount = () => api.get('/api/conversations/unread-count');
