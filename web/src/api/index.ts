import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - adapts to new response format { success, data, error }
api.interceptors.response.use(
    (response) => {
        const data = response.data;

        // New format: { success: true, data: ... }
        if (data && typeof data.success === 'boolean') {
            if (data.success) {
                // Return object compatible with old format
                return { code: 200, data: data.data, message: 'Success' };
            } else {
                // Error case
                return Promise.reject({
                    code: data.error?.code || 'ERROR',
                    message: data.error?.message || 'Request failed',
                });
            }
        }

        // Old format compatibility
        return data;
    },
    (error) => {
        if (error.response) {
            const { status, data } = error.response;

            if (status === 401) {
                // Token expired or invalid, redirect to login page
                localStorage.removeItem('token');
                localStorage.removeItem('admin');
                window.location.href = '/login';
            }

            // New format error handling
            if (data && data.error) {
                return Promise.reject({
                    code: data.error.code || status,
                    message: data.error.message || 'Request failed',
                });
            }

            return Promise.reject({
                code: status,
                message: data?.message || 'Request failed',
            });
        }

        return Promise.reject({
            code: 500,
            message: error.message || 'Network error',
        });
    }
);

export default api;

// ========================================
// Auth API
// ========================================

export const authApi = {
    login: (username: string, password: string) =>
        api.post('/admin/auth/login', { username, password }),

    logout: () =>
        api.post('/admin/auth/logout'),

    getMe: () =>
        api.get('/admin/auth/me'),

    changePassword: (oldPassword: string, newPassword: string) =>
        api.post('/admin/auth/change-password', { oldPassword, newPassword }),
};

// ========================================
// Admin API
// ========================================

export const adminApi = {
    getList: (params?: { page?: number; pageSize?: number; status?: string; role?: string; keyword?: string }) =>
        api.get('/admin/admins', { params }),

    getById: (id: number) =>
        api.get(`/admin/admins/${id}`),

    create: (data: { username: string; password: string; email?: string; role?: string; status?: string }) =>
        api.post('/admin/admins', data),

    update: (id: number, data: { username?: string; password?: string; email?: string; role?: string; status?: string }) =>
        api.put(`/admin/admins/${id}`, data),

    delete: (id: number) =>
        api.delete(`/admin/admins/${id}`),
};

// ========================================
// API Key API
// ========================================

export const apiKeyApi = {
    getList: (params?: { page?: number; pageSize?: number; status?: string; keyword?: string }) =>
        api.get('/admin/api-keys', { params }),

    getById: (id: number) =>
        api.get(`/admin/api-keys/${id}`),

    create: (data: { name: string; permissions?: Record<string, boolean>; rateLimit?: number; expiresAt?: string | null }) =>
        api.post('/admin/api-keys', data),

    update: (id: number, data: { name?: string; permissions?: Record<string, boolean>; rateLimit?: number; status?: string; expiresAt?: string | null }) =>
        api.put(`/admin/api-keys/${id}`, data),

    delete: (id: number) =>
        api.delete(`/admin/api-keys/${id}`),

    getUsage: (id: number) =>
        api.get(`/admin/api-keys/${id}/usage`),

    resetPool: (id: number) =>
        api.post(`/admin/api-keys/${id}/reset-pool`),

    getPoolEmails: (id: number) =>
        api.get(`/admin/api-keys/${id}/pool-emails`),

    updatePoolEmails: (id: number, emailIds: number[]) =>
        api.put(`/admin/api-keys/${id}/pool-emails`, { emailIds }),
};

// ========================================
// Email Account API
// ========================================

export const emailApi = {
    getList: (params?: { page?: number; pageSize?: number; status?: string; keyword?: string }) =>
        api.get('/admin/emails', { params }),

    getById: (id: number, includeSecrets?: boolean) =>
        api.get(`/admin/emails/${id}`, { params: { secrets: includeSecrets } }),

    create: (data: { email: string; clientId: string; refreshToken: string }) =>
        api.post('/admin/emails', data),

    import: (content: string, separator?: string) =>
        api.post('/admin/emails/import', { content, separator }),

    export: (ids?: number[], separator?: string) =>
        api.get('/admin/emails/export', { params: { ids: ids?.join(','), separator } }),

    update: (id: number, data: { email?: string; clientId?: string; refreshToken?: string; status?: string }) =>
        api.put(`/admin/emails/${id}`, data),

    delete: (id: number) =>
        api.delete(`/admin/emails/${id}`),

    batchDelete: (ids: number[]) =>
        api.post('/admin/emails/batch-delete', { ids }),

    // View emails (admin only)
    viewMails: (id: number, mailbox?: string) =>
        api.get(`/admin/emails/${id}/mails`, { params: { mailbox } }),

    // Clear mailbox (admin only)
    clearMailbox: (id: number, mailbox?: string) =>
        api.post(`/admin/emails/${id}/clear`, { mailbox }),
};

// ========================================
// Dashboard API
// ========================================

export const dashboardApi = {
    getStats: () =>
        api.get('/admin/dashboard/stats'),

    getApiTrend: (days: number = 7) =>
        api.get('/admin/dashboard/api-trend', { params: { days } }),

    getLogs: (params?: { page?: number; pageSize?: number; action?: string }) =>
        api.get('/admin/dashboard/logs', { params }),
};

// ========================================
// Operation Logs API (deprecated, use dashboardApi.getLogs)
// ========================================

export const logsApi = {
    getList: (params: { page?: number; pageSize?: number; action?: string; resource?: string }) =>
        api.get('/admin/dashboard/logs', { params }),
};

