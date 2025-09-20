import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

export interface PhoneValidationResult {
  isValid: boolean;
  formatted?: string;
  error?: string;
}

export const validateAndFormatPhone = (phoneNumber: string, defaultCountry = 'US'): PhoneValidationResult => {
  if (!phoneNumber.trim()) {
    return {
      isValid: false,
      error: 'Phone number is required'
    };
  }

  try {
    // Check if it's a valid phone number
    if (!isValidPhoneNumber(phoneNumber, defaultCountry as any)) {
      return {
        isValid: false,
        error: 'Please enter a valid phone number (e.g., +1234567890 or (123) 456-7890)'
      };
    }

    // Parse and format the phone number
    const parsed = parsePhoneNumber(phoneNumber, defaultCountry as any);
    
    return {
      isValid: true,
      formatted: parsed.formatInternational()
    };
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid phone number format. Please use international format (+1234567890)'
    };
  }
};