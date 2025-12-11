/**
 * Validation utilities for form inputs
 */

export const validators = {
  required: (value, fieldName = 'This field') => {
    if (!value || (typeof value === 'string' && !value.trim())) {
      return `${fieldName} is required`;
    }
    return null;
  },

  email: (value) => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Please enter a valid email address';
    }
    return null;
  },

  minLength: (value, min, fieldName = 'This field') => {
    if (!value) return null;
    if (value.length < min) {
      return `${fieldName} must be at least ${min} characters`;
    }
    return null;
  },

  maxLength: (value, max, fieldName = 'This field') => {
    if (!value) return null;
    if (value.length > max) {
      return `${fieldName} must not exceed ${max} characters`;
    }
    return null;
  },

  range: (value, min, max, fieldName = 'Value') => {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (isNaN(num)) {
      return `${fieldName} must be a number`;
    }
    if (num < min || num > max) {
      return `${fieldName} must be between ${min} and ${max}`;
    }
    return null;
  },

  url: (value) => {
    if (!value) return null;
    try {
      new URL(value);
      return null;
    } catch {
      return 'Please enter a valid URL';
    }
  },

  apiKey: (value) => {
    if (!value) return null;
    if (value.length < 20) {
      return 'API key seems too short. Please check your key.';
    }
    return null;
  },
};

/**
 * Validate a form object against validation rules
 * @param {Object} formData - The form data to validate
 * @param {Object} rules - Validation rules for each field
 * @returns {Object} - Object with field names as keys and error messages as values
 */
export const validateForm = (formData, rules) => {
  const errors = {};

  Object.keys(rules).forEach((field) => {
    const fieldRules = rules[field];
    const value = formData[field];

    for (const rule of fieldRules) {
      const error = rule(value);
      if (error) {
        errors[field] = error;
        break; // Stop at first error for this field
      }
    }
  });

  return errors;
};

/**
 * Check if errors object has any errors
 */
export const hasErrors = (errors) => {
  return Object.keys(errors).length > 0;
};

/**
 * Agent-specific validations
 */
export const agentValidation = {
  name: [
    (val) => validators.required(val, 'Agent name'),
    (val) => validators.minLength(val, 2, 'Agent name'),
    (val) => validators.maxLength(val, 50, 'Agent name'),
  ],
  system_prompt: [
    (val) => validators.required(val, 'System prompt'),
    (val) => validators.minLength(val, 10, 'System prompt'),
  ],
  temperature: [
    (val) => validators.required(val, 'Temperature'),
    (val) => validators.range(val, 0, 2, 'Temperature'),
  ],
  max_tokens: [
    (val) => validators.required(val, 'Max tokens'),
    (val) => validators.range(val, 100, 10000, 'Max tokens'),
  ],
};

/**
 * Provider-specific validations
 */
export const providerValidation = {
  name: [
    (val) => validators.required(val, 'Provider name'),
    (val) => validators.minLength(val, 2, 'Provider name'),
  ],
  api_key: [
    (val) => validators.required(val, 'API key'),
    (val) => validators.apiKey(val),
  ],
};

/**
 * User-specific validations
 */
export const userValidation = {
  name: [
    (val) => validators.required(val, 'Name'),
    (val) => validators.minLength(val, 2, 'Name'),
  ],
  email: [
    (val) => validators.required(val, 'Email'),
    (val) => validators.email(val),
  ],
  password: [
    (val) => validators.required(val, 'Password'),
    (val) => validators.minLength(val, 8, 'Password'),
  ],
};
