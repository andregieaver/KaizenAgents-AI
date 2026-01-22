/**
 * Application-wide constants
 * Centralized configuration to avoid duplication across components
 */

// API Configuration
export const API_BASE_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

// API Endpoints - organized by feature
export const API_ENDPOINTS = {
  // Authentication
  auth: {
    login: `${API_BASE_URL}/auth/login`,
    register: `${API_BASE_URL}/auth/register`,
    forgotPassword: `${API_BASE_URL}/auth/forgot-password`,
    resetPassword: `${API_BASE_URL}/auth/reset-password`,
    verifyEmail: `${API_BASE_URL}/auth/verify-email`,
  },

  // Users
  users: {
    base: `${API_BASE_URL}/users`,
    me: `${API_BASE_URL}/users/me`,
    byId: (id) => `${API_BASE_URL}/users/${id}`,
  },

  // Profile
  profile: {
    base: `${API_BASE_URL}/profile`,
    password: `${API_BASE_URL}/profile/password`,
    avatar: `${API_BASE_URL}/profile/avatar`,
  },

  // Tenants
  tenants: {
    base: `${API_BASE_URL}/tenants`,
    byId: (id) => `${API_BASE_URL}/tenants/${id}`,
    switch: `${API_BASE_URL}/tenants/switch`,
  },

  // Conversations
  conversations: {
    base: `${API_BASE_URL}/conversations`,
    byId: (id) => `${API_BASE_URL}/conversations/${id}`,
    messages: (id) => `${API_BASE_URL}/conversations/${id}/messages`,
    close: (id) => `${API_BASE_URL}/conversations/${id}/close`,
    transfer: (id) => `${API_BASE_URL}/conversations/${id}/transfer`,
  },

  // Settings
  settings: {
    base: `${API_BASE_URL}/settings`,
    widget: `${API_BASE_URL}/settings/widget`,
    integration: `${API_BASE_URL}/settings/integration`,
  },

  // Agents
  agents: {
    base: `${API_BASE_URL}/agents`,
    byId: (id) => `${API_BASE_URL}/agents/${id}`,
    active: `${API_BASE_URL}/agents/active`,
  },

  // Providers
  providers: {
    base: `${API_BASE_URL}/providers`,
    models: (provider) => `${API_BASE_URL}/providers/${provider}/models`,
  },

  // Analytics
  analytics: {
    base: `${API_BASE_URL}/analytics`,
    dashboard: `${API_BASE_URL}/analytics/dashboard`,
  },

  // Admin
  admin: {
    base: `${API_BASE_URL}/admin`,
    users: `${API_BASE_URL}/admin/users`,
    tenants: `${API_BASE_URL}/admin/tenants`,
    stats: `${API_BASE_URL}/admin/stats`,
  },

  // Widget
  widget: {
    base: `${API_BASE_URL}/widget`,
    session: `${API_BASE_URL}/widget/session`,
    message: `${API_BASE_URL}/widget/message`,
  },

  // Media/Upload
  media: {
    upload: `${API_BASE_URL}/media/upload`,
  },

  // Rate Limits
  rateLimits: {
    base: `${API_BASE_URL}/rate-limits`,
  },

  // Subscriptions
  subscriptions: {
    base: `${API_BASE_URL}/subscriptions`,
    plans: `${API_BASE_URL}/subscription-plans`,
    checkout: `${API_BASE_URL}/subscriptions/create-checkout`,
    portal: `${API_BASE_URL}/subscriptions/customer-portal`,
  },

  // Email Templates
  emailTemplates: {
    base: `${API_BASE_URL}/email-templates`,
    byId: (id) => `${API_BASE_URL}/email-templates/${id}`,
  },

  // Marketplace
  marketplace: {
    base: `${API_BASE_URL}/marketplace`,
    install: (id) => `${API_BASE_URL}/marketplace/${id}/install`,
  },

  // Observability
  observability: {
    base: `${API_BASE_URL}/observability`,
    logs: `${API_BASE_URL}/observability/logs`,
    metrics: `${API_BASE_URL}/observability/metrics`,
  },

  // Storage
  storage: {
    config: `${API_BASE_URL}/storage/config`,
  },

  // Affiliates
  affiliates: {
    base: `${API_BASE_URL}/affiliates`,
    stats: `${API_BASE_URL}/affiliates/stats`,
  },

  // Waitlist
  waitlist: {
    base: `${API_BASE_URL}/waitlist`,
  },

  // Custom Emails
  customEmails: {
    base: `${API_BASE_URL}/custom-emails`,
    send: `${API_BASE_URL}/custom-emails/send`,
  },

  // Pages (CMS)
  pages: {
    base: `${API_BASE_URL}/pages`,
    bySlug: (slug) => `${API_BASE_URL}/pages/${slug}`,
  },

  // Menus
  menus: {
    base: `${API_BASE_URL}/menus`,
    byId: (id) => `${API_BASE_URL}/menus/${id}`,
  },

  // Discount Codes
  discounts: {
    base: `${API_BASE_URL}/discount-codes`,
    validate: `${API_BASE_URL}/discount-codes/validate`,
  },
};

// Other constants
export const APP_NAME = 'AI Support Hub';
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Polling intervals (in milliseconds)
export const POLLING_INTERVALS = {
  conversations: 5000, // 5 seconds
  transfers: 5000, // 5 seconds
  analytics: 30000, // 30 seconds
};

// Status mappings
export const CONVERSATION_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
  PENDING: 'pending',
};

export const USER_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  SUPER_ADMIN: 'super_admin',
};
