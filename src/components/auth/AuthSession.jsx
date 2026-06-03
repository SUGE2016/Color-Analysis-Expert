import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { message } from 'antd';
import {
  clearLogoutTimer,
  clearSession,
  isAuthenticated,
  scheduleAutoLogout,
} from '../../utils/session';

const PUBLIC_PATHS = ['/login', '/register'];

export default function AuthSession({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const isPublic = PUBLIC_PATHS.some((p) => location.pathname.startsWith(p));

    const goLogin = (reason, notify = true) => {
      clearSession();
      if (!isPublic) {
        if (notify && reason) message.warning(reason);
        navigate('/login', {
          replace: true,
          state: { from: location.pathname + location.search },
        });
      }
    };

    const onUnauthorized = (e) => {
      const reason = e.detail?.reason || '登录已过期，请重新登录';
      goLogin(reason, true);
    };

    window.addEventListener('auth:unauthorized', onUnauthorized);

    if (isPublic) {
      clearLogoutTimer();
      return () => {
        window.removeEventListener('auth:unauthorized', onUnauthorized);
      };
    }

    if (!isAuthenticated()) {
      goLogin('请先登录', false);
      return () => {
        window.removeEventListener('auth:unauthorized', onUnauthorized);
      };
    }

    scheduleAutoLogout((reason) => goLogin(reason, true));

    return () => {
      clearLogoutTimer();
      window.removeEventListener('auth:unauthorized', onUnauthorized);
    };
  }, [location.pathname, location.search, navigate, location]);

  return children;
}
