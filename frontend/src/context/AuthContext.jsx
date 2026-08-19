import { createContext, useContext, useMemo, useState } from 'react';

const AuthContext = createContext(null);

function decodeRole(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.role;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user')) || null;
    } catch {
      return null;
    }
  });

  const role = user?.role || (token ? decodeRole(token) : null);
  const login = (nextToken, nextUser = {}) => {
    const nextRole = nextUser.role || decodeRole(nextToken);
    const storedUser = { ...nextUser, role: nextRole };
    localStorage.setItem('token', nextToken);
    localStorage.setItem('user', JSON.stringify(storedUser));
    setToken(nextToken);
    setUser(storedUser);
    return storedUser;
  };
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({
    token,
    user: user ? { ...user, role } : role ? { role } : null,
    role,
    login,
    logout,
    isTenant: () => role === 'tenant',
    isOwner: () => role === 'owner',
    isAdmin: () => role === 'admin',
  }), [token, user, role]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// The provider and hook intentionally share this context module.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
