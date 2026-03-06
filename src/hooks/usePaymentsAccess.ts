import { useAuth } from '../contexts/AuthContext';

const PAYMENTS_ALLOWED_EMAILS = ['sean@autom8ionlab.com'];

export function usePaymentsAccess(): boolean {
  const { user, isSuperAdmin } = useAuth();
  if (isSuperAdmin) return true;
  if (!user?.email) return false;
  return PAYMENTS_ALLOWED_EMAILS.includes(user.email.toLowerCase());
}
