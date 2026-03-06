import { Navigate } from 'react-router-dom';
import { usePaymentsAccess } from '../hooks/usePaymentsAccess';

export function PaymentsGate({ children }: { children: React.ReactNode }) {
  const canAccess = usePaymentsAccess();
  if (!canAccess) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
}
