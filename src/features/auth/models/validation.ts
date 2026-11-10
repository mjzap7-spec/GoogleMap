import type { AuthForm, AuthMode, UserProfile } from './auth';
import { validatePhoneNumber } from './phoneNumber';
export function validateAuthForm(mode: AuthMode, form: AuthForm): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    return 'Please enter a valid email address.';
  if (mode !== 'reset' && !form.password) return 'Please enter your password.';
  if (mode === 'signup' && form.password.length < 8)
    return 'Use at least 8 characters for your password.';
  if (mode === 'signup' && form.password !== form.confirm) return 'Your passwords do not match.';
  return null;
}

export function validateProfile(form: UserProfile, today = new Date()): string | null {
  if (!form.fullName.trim() || form.fullName.trim().length > 100)
    return 'Enter your full name (up to 100 characters).';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.birthday)) return 'Enter your birthday as YYYY-MM-DD.';
  const [year, month, day] = form.birthday.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (
    year < 1900 ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date > endOfToday
  )
    return 'Enter a valid birthday between 1900 and today.';
  if (!form.location.trim() || form.location.trim().length > 120)
    return 'Enter your location (up to 120 characters).';
  const phoneError = validatePhoneNumber(form.phoneNumber);
  if (phoneError) return phoneError;
  if (
    form.avatar &&
    (!form.avatar.base64 ||
      form.avatar.base64.length * 0.75 > 5 * 1024 * 1024 ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(form.avatar.contentType))
  )
    return 'Choose a JPG, PNG, or WebP avatar smaller than 5 MB.';
  return null;
}
