import axios from 'axios';
import { auth } from './auth';

const api = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = auth.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      auth.logout();
    }
    return Promise.reject(error);
  }
);

export default api;

// ─── Auth ───────────────────────────────────────────────────────────────────
export const authApi = {
  // Email-only signup (no password)
  signup: (data: { email: string; name: string; phone?: string }) =>
    api.post('/api/auth/signup', data),
  // Email-only login — backend returns JWT with role 'manager' or 'customer'
  login: (data: { email: string }) =>
    api.post('/api/auth/login', data),
  logout: () =>
    api.post('/api/auth/logout'),
  me: () =>
    api.get('/api/auth/me'),
  updateMe: (data: Partial<{ name: string; phone: string }>) =>
    api.put('/api/auth/me', data),
};

// ─── Products ────────────────────────────────────────────────────────────────
export const productsApi = {
  getAll: (params?: { category?: string; q?: string; sort?: string }) =>
    api.get('/api/products', { params }),
  getById: (id: string) =>
    api.get(`/api/products/${id}`),
  create: (data: object) =>
    api.post('/api/products', data),
  update: (id: string, data: object) =>
    api.put(`/api/products/${id}`, data),
  delete: (id: string) =>
    api.delete(`/api/products/${id}`),
};

// ─── Orders ──────────────────────────────────────────────────────────────────
export const ordersApi = {
  create: (data: { items: Array<{ product_id: string; quantity: number }>; pickup_time: string }) =>
    api.post('/api/orders', data),
  // Returns own orders for customers, all orders for managers
  getAll: () =>
    api.get('/api/orders'),
  getMyOrders: () =>
    api.get('/api/orders/my'),
  getById: (id: string) =>
    api.get(`/api/orders/${id}`),
  updateStatus: (id: string, status: string) =>
    api.patch(`/api/orders/${id}/status`, { status }),
  verifyPickup: (pickup_code: string) =>
    api.post('/api/orders/verify-pickup', { pickup_code }),
  cancel: (id: string) =>
    api.patch(`/api/orders/${id}/cancel`),
};

// ─── Cart ────────────────────────────────────────────────────────────────────
export const cartApi = {
  get: () =>
    api.get('/api/cart'),
  // Add or increment a single product
  add: (product_id: string, quantity = 1) =>
    api.post('/api/cart/add', { product_id, quantity }),
  // Remove a single product entirely
  remove: (product_id: string) =>
    api.post('/api/cart/remove', { product_id }),
  // Replace entire cart (bulk quantity update)
  upsert: (items: Array<{ product_id: string; quantity: number }>) =>
    api.put('/api/cart', { items }),
  clear: () =>
    api.delete('/api/cart'),
};

// ─── Staff ───────────────────────────────────────────────────────────────────
export const staffApi = {
  getAll: () =>
    api.get('/api/staff'),
  create: (data: { name: string; email: string; phone?: string; hire_date: string }) =>
    api.post('/api/staff', data),
  update: (id: string, data: object) =>
    api.put(`/api/staff/${id}`, data),
  delete: (id: string) =>
    api.delete(`/api/staff/${id}`),
};

// ─── Messages ────────────────────────────────────────────────────────────────
export const messagesApi = {
  send: (data: { content: string; type: string }) =>
    api.post('/api/messages', data),
  getMyMessages: () =>
    api.get('/api/messages/my'),
  getAll: () =>
    api.get('/api/messages'),
  updateStatus: (id: string, status: string) =>
    api.patch(`/api/messages/${id}/status`, { status }),
};

// ─── Analytics ───────────────────────────────────────────────────────────────
export const analyticsApi = {
  getDashboard: () =>
    api.get('/api/analytics/dashboard'),
  getByProduct: (product_id: string) =>
    api.get(`/api/analytics/product/${product_id}`),
};

// ─── Admin Analytics ─────────────────────────────────────────────────────────
export const adminAnalyticsApi = {
  getDashboard: () =>
    api.get('/api/admin/analytics/dashboard'),
  getProducts: (params?: { start?: string; end?: string }) =>
    api.get('/api/admin/analytics/products', { params }),
  getRevenue: (params?: { period?: string; start?: string; end?: string }) =>
    api.get('/api/admin/analytics/revenue', { params }),
  manualEntry: (data: object) =>
    api.post('/api/admin/analytics/manual-entry', data),
  getStaffPerformance: (params?: { start?: string; end?: string }) =>
    api.get('/api/admin/analytics/staff-performance', { params }),
};

// ─── Admin Staff ──────────────────────────────────────────────────────────────
export const adminStaffApi = {
  getAll: () =>
    api.get('/api/admin/staff'),
  create: (data: object) =>
    api.post('/api/admin/staff', data),
  update: (id: string, data: object) =>
    api.patch(`/api/admin/staff/${id}`, data),
  delete: (id: string) =>
    api.delete(`/api/admin/staff/${id}`),
  assignDuty: (id: string, date: string, action: 'assign' | 'remove') =>
    api.patch(`/api/admin/staff/${id}/duty`, { date, action }),
  getDutyByDate: (date: string) =>
    api.get(`/api/admin/staff/duty/${date}`),
  clearDutyByDate: (date: string) =>
    api.delete(`/api/admin/staff/duty/${date}`),
  getDuties: (id: string, month?: string) =>
    api.get(`/api/admin/staff/${id}/duties`, { params: month ? { month } : undefined }),
  assignOrder: (orderId: string, staffId: string) =>
    api.post(`/api/admin/orders/${orderId}/assign-staff`, { staff_id: staffId }),
};

// ─── Admin Customers ─────────────────────────────────────────────────────────
export const adminCustomersApi = {
  getAll: (q?: string) =>
    api.get('/api/admin/customers', { params: q ? { q } : undefined }),
  getById: (id: string) =>
    api.get(`/api/admin/customers/${id}`),
  delete: (id: string) =>
    api.delete(`/api/admin/customers/${id}`),
};

// ─── Admin Messaging ─────────────────────────────────────────────────────────
export const adminMessagingApi = {
  getMessages: () =>
    api.get('/api/admin/messages'),
  replyToMessage: (id: string, reply: string) =>
    api.post(`/api/admin/messages/${id}/reply`, { reply }),
  updateMessageStatus: (id: string, status: string) =>
    api.patch(`/api/admin/messages/${id}/status`, { status }),
  generateMessage: (prompt: string, context?: string) =>
    api.post('/api/admin/generate-message', { prompt, context }),
  getNotifications: () =>
    api.get('/api/admin/notifications'),
  sendProductNotification: (data: { title: string; content: string; product_id?: string }) =>
    api.post('/api/admin/notifications/product', data),
};

// ─── Admin Social Posts ───────────────────────────────────────────────────────
export const adminSocialApi = {
  getAll: (platform?: string) =>
    api.get('/api/admin/social-posts', { params: platform ? { platform } : undefined }),
  create: (data: { platform: string; content: string; image_url?: string; scheduled_date?: string; product_id?: string }) =>
    api.post('/api/admin/social-posts', data),
  update: (id: string, data: object) =>
    api.patch(`/api/admin/social-posts/${id}`, data),
  delete: (id: string) =>
    api.delete(`/api/admin/social-posts/${id}`),
};

// ─── Admin ───────────────────────────────────────────────────────────────────
export const adminApi = {
  getDashboard: () =>
    api.get('/api/admin/dashboard'),

  // Products — send FormData (multipart) for image support
  createProduct: (formData: FormData) =>
    api.post('/api/admin/products', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updateProduct: (id: string, formData: FormData) =>
    api.patch(`/api/admin/products/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deleteProduct: (id: string) =>
    api.delete(`/api/admin/products/${id}`),
  getExpiringProducts: () =>
    api.get('/api/admin/products/expiring'),

  // Inventory — JSON patch for stock only
  updateStock: (id: string, stock: number) =>
    api.patch(`/api/admin/inventory/${id}`, { stock }),

  // Order status update (re-uses existing orders endpoint)
  updateOrderStatus: (id: string, status: string) =>
    api.patch(`/api/orders/${id}/status`, { status }),
};
