import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const roles = ['user', 'manager', 'admin'];

function inviteLink(token) {
  return `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/register?invite=${token}`;
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [ownerId, setOwnerId] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [form, setForm] = useState({ email: '', role: 'user' });
  const [message, setMessage] = useState('');
  const [createdInviteLink, setCreatedInviteLink] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [userData, invitationData] = await Promise.all([api('/auth/admin/users'), api('/auth/admin/invitations')]);
    setUsers(userData.users);
    setOwnerId(userData.ownerId);
    setInvitations(invitationData.invitations);
  }, []);

  useEffect(() => { load().catch((loadError) => setError(loadError.message)); }, [load]);

  async function createInvitation(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setCreatedInviteLink('');
    try {
      const data = await api('/auth/admin/invitations', { method: 'POST', body: JSON.stringify(form) });
      const link = inviteLink(data.invitation.token);
      setInvitations((current) => [data.invitation, ...current]);
      setForm({ email: '', role: 'user' });
      setCreatedInviteLink(link);
      setMessage('Invitation created. Share this link securely with the invited email address.');
    } catch (inviteError) { setError(inviteError.message); }
  }

  async function copyInviteLink() {
    await navigator.clipboard.writeText(createdInviteLink);
    setMessage('Invitation link copied. Share it securely with the invited user.');
  }

  async function changeRole(id, role) {
    setError('');
    try {
      const data = await api(`/auth/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
      setUsers((current) => current.map((user) => user.id === id ? { ...user, role: data.user.role } : user));
    } catch (roleError) { setError(roleError.message); }
  }

  async function removeUser(member) {
    if (!window.confirm(`Remove ${member.name} from the team? Their account data will be deleted.`)) return;
    setError('');
    try {
      await api(`/auth/admin/users/${member.id}`, { method: 'DELETE' });
      setUsers((current) => current.filter((user) => user.id !== member.id));
    } catch (removeError) { setError(removeError.message); }
  }

  return (
    <section>
      <p className="eyebrow">Administration</p>
      <h2 className="page-title">Team access</h2>
      <p className="mt-2 text-slate-600 dark:text-slate-300">Invite team members and assign their role. Only administrators can change access.</p>
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"><p>{message}</p>{createdInviteLink && <div className="mt-3 flex flex-wrap items-center gap-3"><a className="font-semibold text-blue-700 underline" href={createdInviteLink} target="_blank" rel="noreferrer">Open invitation link</a><button className="btn-secondary px-3 py-1 text-sm" type="button" onClick={copyInviteLink}>Copy link</button></div>}</div>}
      <form className="card mt-6 grid gap-4 md:grid-cols-[1fr_180px_auto]" onSubmit={createInvitation}>
        <input className="input" type="email" placeholder="colleague@example.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        <select className="input" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
          {roles.map((role) => <option key={role} value={role}>{role[0].toUpperCase() + role.slice(1)}</option>)}
        </select>
        <button className="btn" type="submit">Create invite</button>
      </form>
      <div className="card mt-6 overflow-x-auto">
        <h3 className="text-lg font-semibold">Registered users</h3>
        <table className="mt-4 w-full text-left text-sm">
          <thead><tr className="border-b"><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Role</th><th className="p-2">Access</th></tr></thead>
          <tbody>{users.map((member) => { const isOwner = String(member.id) === String(ownerId); const canRemove = !isOwner && (String(currentUser?.id) === String(ownerId) || member.role !== 'admin'); return <tr className="border-b" key={member.id}><td className="p-2">{member.name}{isOwner && <span className="ml-2 text-xs font-semibold text-blue-700">Main owner</span>}</td><td className="p-2">{member.email}</td><td className="p-2"><select className="input py-1" value={member.role} disabled={isOwner} onChange={(event) => changeRole(member.id, event.target.value)}>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></td><td className="p-2">{canRemove ? <button className="btn-secondary px-3 py-1 text-sm" onClick={() => removeUser(member)}>Remove</button> : <span className="text-xs text-slate-500">{isOwner ? 'Protected' : 'Owner only'}</span>}</td></tr>; })}</tbody>
        </table>
      </div>
      <div className="card mt-6 overflow-x-auto">
        <h3 className="text-lg font-semibold">Pending invitations</h3>
        <table className="mt-4 w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Email</th><th className="p-2">Role</th><th className="p-2">Status</th></tr></thead><tbody>{invitations.map((invite) => <tr className="border-b" key={invite.id}><td className="p-2">{invite.email}</td><td className="p-2">{invite.role}</td><td className="p-2">{invite.accepted_at ? 'Accepted' : 'Pending'}</td></tr>)}</tbody></table>
      </div>
    </section>
  );
}
