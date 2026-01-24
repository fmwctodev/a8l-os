import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Settings, Menu, X } from 'lucide-react';
import { SettingsNav } from '../components/settings/SettingsNav';

export function SettingsLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/10 to-teal-500/10 border border-cyan-500/20">
            <Settings className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Settings</h1>
            <p className="text-sm text-slate-400 mt-0.5">Manage your account and preferences</p>
          </div>
        </div>

        <button
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="lg:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
        >
          {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        <aside
          className={`
            ${mobileNavOpen ? 'flex' : 'hidden'} lg:flex
            flex-col w-full lg:w-64 border-r border-slate-800 bg-slate-900/50
            absolute lg:relative z-40 h-[calc(100vh-88px)] lg:h-auto
          `}
        >
          <SettingsNav onNavigate={() => setMobileNavOpen(false)} />
        </aside>

        <main className="flex-1 overflow-auto isolate">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
