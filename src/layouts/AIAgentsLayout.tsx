import { useState } from 'react';
import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { Bot, Plus, ChevronDown, Lightbulb, Mic, MessageSquare, Database, FileCode } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const tabs = [
  { path: '/ai-agents/getting-started', label: 'Getting Started', icon: Lightbulb },
  { path: '/ai-agents/voice', label: 'Voice AI', icon: Mic },
  { path: '/ai-agents/conversation', label: 'Conversation AI', icon: MessageSquare },
  { path: '/ai-agents/knowledge', label: 'Knowledge Base', icon: Database },
  { path: '/ai-agents/templates', label: 'Templates', icon: FileCode },
];

export function AIAgentsLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);

  const canManage = hasPermission('ai_agents.manage');

  const handleCreateVoiceAgent = () => {
    navigate('/ai-agents/voice?create=true');
    setShowCreateDropdown(false);
  };

  const handleCreateConversationAgent = () => {
    navigate('/ai-agents/conversation?create=true');
    setShowCreateDropdown(false);
  };

  const handleViewTemplates = () => {
    navigate('/ai-agents/templates');
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="border-b border-slate-700 bg-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 rounded-lg">
                <Bot className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">AI Agents</h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Build intelligent agents for voice calls and conversations
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {canManage && (
                <>
                  <button
                    onClick={handleViewTemplates}
                    className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                  >
                    View Templates
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setShowCreateDropdown(!showCreateDropdown)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Create Agent
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    {showCreateDropdown && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowCreateDropdown(false)}
                        />
                        <div className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
                          <button
                            onClick={handleCreateVoiceAgent}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left text-slate-300 hover:bg-slate-700 transition-colors"
                          >
                            <Mic className="w-4 h-4 text-cyan-400" />
                            <div>
                              <div className="font-medium">Voice AI Agent</div>
                              <div className="text-xs text-slate-400">Handle phone calls</div>
                            </div>
                          </button>
                          <button
                            onClick={handleCreateConversationAgent}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left text-slate-300 hover:bg-slate-700 transition-colors"
                          >
                            <MessageSquare className="w-4 h-4 text-cyan-400" />
                            <div>
                              <div className="font-medium">Conversation AI Agent</div>
                              <div className="text-xs text-slate-400">Chat via SMS, email, web</div>
                            </div>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <nav className="flex gap-1 mt-6 -mb-px overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = location.pathname === tab.path ||
                (location.pathname === '/ai-agents' && tab.path === '/ai-agents/getting-started') ||
                (location.pathname.startsWith(tab.path) && tab.path !== '/ai-agents/getting-started');

              return (
                <NavLink
                  key={tab.path}
                  to={tab.path}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? 'text-cyan-400 border-cyan-500'
                      : 'text-slate-400 border-transparent hover:text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </div>
    </div>
  );
}
