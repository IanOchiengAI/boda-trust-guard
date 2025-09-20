import { z } from 'zod';

// Enhanced email validation schema
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .max(254, 'Email address is too long')
  .refine(
    (email) => {
      // Additional security checks
      const blockedDomains = ['temp-mail.org', '10minutemail.com', 'guerrillamail.com'];
      const domain = email.split('@')[1];
      return !blockedDomains.includes(domain);
    },
    'Temporary email addresses are not allowed'
  );

// Enhanced phone validation schema
export const phoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .refine(
    (phone) => {
      // Remove all non-digit characters to check length
      const digitsOnly = phone.replace(/\D/g, '');
      return digitsOnly.length >= 10 && digitsOnly.length <= 15;
    },
    'Phone number must be between 10-15 digits'
  )
  .refine(
    (phone) => {
      // Check for international format or US format
      const internationalPattern = /^\+[1-9]\d{8,14}$/;
      const usPattern = /^(\+1|1)?[2-9]\d{2}[2-9]\d{2}\d{4}$/;
      const cleanPhone = phone.replace(/[\s\-\(\)\.]/g, '');
      
      return internationalPattern.test(cleanPhone) || usPattern.test(cleanPhone);
    },
    'Please enter a valid phone number in international format (+1234567890) or US format'
  );

// Contact name validation
export const contactNameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name is too long')
  .refine(
    (name) => {
      // Basic sanitization - no special characters that could be used for injection
      const allowedPattern = /^[a-zA-Z\s\-\'\.]+$/;
      return allowedPattern.test(name);
    },
    'Name can only contain letters, spaces, hyphens, apostrophes, and periods'
  );

// Relationship validation
export const relationshipSchema = z
  .string()
  .max(50, 'Relationship description is too long')
  .optional()
  .refine(
    (relationship) => {
      if (!relationship) return true;
      const allowedPattern = /^[a-zA-Z\s\-\'\.]+$/;
      return allowedPattern.test(relationship);
    },
    'Relationship can only contain letters, spaces, hyphens, apostrophes, and periods'
  );

// Input sanitization function
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/['"]/g, '') // Remove quotes that could be used for injection
    .substring(0, 1000); // Limit length
};

// Rate limiting check on client side
export const checkClientRateLimit = (key: string, maxAttempts: number = 5, windowMs: number = 60000): boolean => {
  const now = Date.now();
  const attempts = JSON.parse(localStorage.getItem(`rate_limit_${key}`) || '[]');
  
  // Filter out old attempts outside the window
  const recentAttempts = attempts.filter((timestamp: number) => now - timestamp < windowMs);
  
  if (recentAttempts.length >= maxAttempts) {
    return true; // Rate limited
  }
  
  // Add current attempt
  recentAttempts.push(now);
  localStorage.setItem(`rate_limit_${key}`, JSON.stringify(recentAttempts));
  
  return false; // Not rate limited
};

export const validateEmergencyContact = (contact: {
  name: string;
  phone_number: string;
  relationship?: string;
}) => {
  const nameValidation = contactNameSchema.safeParse(contact.name);
  const phoneValidation = phoneSchema.safeParse(contact.phone_number);
  const relationshipValidation = relationshipSchema.safeParse(contact.relationship);

  const errors: string[] = [];
  
  if (!nameValidation.success) {
    errors.push(nameValidation.error.errors[0].message);
  }
  
  if (!phoneValidation.success) {
    errors.push(phoneValidation.error.errors[0].message);
  }
  
  if (!relationshipValidation.success) {
    errors.push(relationshipValidation.error.errors[0].message);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};