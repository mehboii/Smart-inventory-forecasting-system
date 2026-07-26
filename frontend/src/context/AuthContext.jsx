import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem('token');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    localStorage.setItem('token', data.token);
    setUser(data.user);
  }

  async function register(payload) {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    localStorage.setItem('token', data.token);
    setUser(data.user);
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => null);
    localStorage.removeItem('token');
    setUser(null);
  }

  async function completeWalkthrough() {
    const data = await api('/auth/walkthrough', { method: 'PATCH' });
    setUser(data.user);
  }

  const value = useMemo(() => ({ user, loading, login, register, logout, completeWalkthrough }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
