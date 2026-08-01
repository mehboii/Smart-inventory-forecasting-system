import { useState } from 'react';
import { navigate } from '../App.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', inviteToken: new URLSearchParams(window.location.search).get('invite') || '' });
  const [error, setError] = useState('');

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await register(form);
      navigate('/');
    } catch (registerError) {
      setError(registerError.message);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <form className="card w-full max-w-md" onSubmit={submit}>
        <h1 className="text-2xl font-bold">Create account</h1>
        <p className="mt-2 text-sm text-slate-500">Your administrator assigns your role when they invite you.</p>
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <label className="mt-5 block text-sm font-medium">Name</label>
        <input className="input mt-1" value={form.name} onChange={(event) => update('name', event.target.value)} required />
        <label className="mt-4 block text-sm font-medium">Email</label>
        <input className="input mt-1" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} required />
        <label className="mt-4 block text-sm font-medium">Password</label>
        <input className="input mt-1" type="password" minLength="6" value={form.password} onChange={(event) => update('password', event.target.value)} required />
        <label className="mt-4 block text-sm font-medium">Invitation code</label>
        <input className="input mt-1" value={form.inviteToken} onChange={(event) => update('inviteToken', event.target.value)} placeholder="Paste the code from your administrator" />
        <button className="btn mt-5 w-full">Register</button>
        <p className="mt-4 text-center text-sm text-slate-600">
          Already registered? <button className="font-semibold text-blue-700" type="button" onClick={() => navigate('/login')}>Login</button>
        </p>
      </form>
    </div>
  );
}
