/** Store a dialable number without guessing a country code or claiming verification. */
export function normalizePhoneNumber(value: string): string {
  return value.trim().replace(/[\s().-]/g, '');
}

export function validatePhoneNumber(value = ''): string | null {
  if (!value.trim()) return null;
  if (value.length > 32 || !/^\+?[\d\s().-]+$/.test(value.trim()))
    return 'Enter a phone number with 7–15 digits, or leave it blank.';
  return /^\+?\d{7,15}$/.test(normalizePhoneNumber(value))
    ? null
    : 'Enter a phone number with 7–15 digits, or leave it blank.';
}
