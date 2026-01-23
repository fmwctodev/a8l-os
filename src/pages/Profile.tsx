import { useAuth } from '../contexts/AuthContext';
import { Mail, Building2, Shield, Calendar } from 'lucide-react';

export function Profile() {
  const { user } = useAuth();

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-6">Profile</h1>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-xl font-semibold text-white">{initials}</span>
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{user.name}</h2>
              <p className="text-slate-400">{user.role?.name}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
              <Mail className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Email</p>
              <p className="text-white">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
              <Shield className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Role</p>
              <p className="text-white">{user.role?.name}</p>
            </div>
          </div>

          {user.department && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Department</p>
                <p className="text-white">{user.department.name}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Member Since</p>
              <p className="text-white">
                {new Date(user.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-800/50">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                user.status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : user.status === 'pending'
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
