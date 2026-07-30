import { useState } from 'react';
import { navigate } from '../App.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (loginError) {
      setError(loginError.message);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <form className="card w-full max-w-md" onSubmit={submit}>
        <h1 className="text-2xl font-bold">Smart Inventory Forecasting</h1>
        <p className="mt-2 text-sm text-slate-500">Login to manage stock and generate forecasts.</p>
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <label className="mt-5 block text-sm font-medium">Email</label>
        <input className="input mt-1" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <label className="mt-4 block text-sm font-medium">Password</label>
        <input className="input mt-1" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <button className="btn mt-5 w-full">Login</button>
        <p className="mt-4 text-center text-sm text-slate-600">
          No account? <button className="font-semibold text-blue-700" type="button" onClick={() => navigate('/register')}>Register</button>
        </p>
      </form>
    </div>
  );
}
