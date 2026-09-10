import { Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { defaultRouteFor } from '../utils/routes';

export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user?.role)) {
    return <Navigate to={defaultRouteFor(user?.role)} replace />;
  }

  return children;
}
