import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  ClipboardList,
  Share2,
  Plus,
  TrendingUp,
  Users,
  Calendar,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getFormStats, createForm } from '../../services/forms';
import { getSurveyStats, createSurvey } from '../../services/surveys';
import { getSocialStats } from '../../services/socialAccounts';
import type { FormStats, SurveyStats, SocialStats } from '../../types';

export function Marketing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [formStats, setFormStats] = useState<FormStats | null>(null);
  const [surveyStats, setSurveyStats] = useState<SurveyStats | null>(null);
  const [socialStats, setSocialStats] = useState<SocialStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingForm, setCreatingForm] = useState(false);
  const [creatingSurvey, setCreatingSurvey] = useState(false);

  useEffect(() => {
    if (!user?.organization_id) return;

    async function loadStats() {
      try {
        const [forms, surveys, social] = await Promise.all([
          getFormStats(user!.organization_id),
          getSurveyStats(user!.organization_id),
          getSocialStats(user!.organization_id),
        ]);
        setFormStats(forms);
        setSurveyStats(surveys);
        setSocialStats(social);
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [user?.organization_id]);

  const modules = [
    {
      id: 'forms',
      name: 'Forms',
      description: 'Capture leads with customizable forms',
      icon: FileText,
      color: 'bg-blue-500',
      href: '/marketing/forms',
      stats: formStats
        ? [
            { label: 'Total Forms', value: formStats.totalForms },
            { label: 'Published', value: formStats.publishedForms },
            { label: 'Submissions (7d)', value: formStats.recentSubmissions },
          ]
        : [],
    },
    {
      id: 'surveys',
      name: 'Surveys',
      description: 'Gather feedback with multi-step surveys',
      icon: ClipboardList,
      color: 'bg-emerald-500',
      href: '/marketing/surveys',
      stats: surveyStats
        ? [
            { label: 'Total Surveys', value: surveyStats.totalSurveys },
            { label: 'Published', value: surveyStats.publishedSurveys },
            { label: 'Submissions', value: surveyStats.totalSubmissions },
          ]
        : [],
    },
    {
      id: 'social',
      name: 'Social Planner',
      description: 'Schedule and publish across platforms',
      icon: Share2,
      color: 'bg-rose-500',
      href: '/marketing/social',
      stats: socialStats
        ? [
            { label: 'Connected', value: socialStats.connectedAccounts },
            { label: 'Scheduled', value: socialStats.scheduledPosts },
            { label: 'Posted (7d)', value: socialStats.postedThisWeek },
          ]
        : [],
    },
  ];

  async function handleCreateForm() {
    if (!user?.organization_id || creatingForm) return;
    try {
      setCreatingForm(true);
      const form = await createForm(user.organization_id, user.id, 'New Form');
      navigate(`/marketing/forms/${form.id}/edit`);
    } catch (error) {
      console.error('Failed to create form:', error);
      setCreatingForm(false);
    }
  }

  async function handleCreateSurvey() {
    if (!user?.organization_id || creatingSurvey) return;
    try {
      setCreatingSurvey(true);
      const survey = await createSurvey(user.organization_id, user.id, 'New Survey');
      navigate(`/marketing/surveys/${survey.id}/edit`);
    } catch (error) {
      console.error('Failed to create survey:', error);
      setCreatingSurvey(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Marketing</h1>
          <p className="mt-1 text-sm text-gray-500">
            Forms, surveys, and social media management
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse"
            >
              <div className="h-12 w-12 bg-gray-200 rounded-lg mb-4" />
              <div className="h-6 w-32 bg-gray-200 rounded mb-2" />
              <div className="h-4 w-48 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {modules.map((module) => (
            <Link
              key={module.id}
              to={module.href}
              className="group bg-white rounded-xl border border-gray-200 p-6 hover:border-gray-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`p-3 rounded-lg ${module.color} text-white`}
                >
                  <module.icon className="w-6 h-6" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all" />
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {module.name}
              </h3>
              <p className="text-sm text-gray-500 mb-4">{module.description}</p>

              {module.stats.length > 0 && (
                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-100">
                  {module.stats.map((stat, idx) => (
                    <div key={idx} className="text-center">
                      <div className="text-lg font-semibold text-gray-900">
                        {stat.value}
                      </div>
                      <div className="text-xs text-gray-500">{stat.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Quick Actions</h3>
          </div>
          <div className="space-y-3">
            <button
              onClick={handleCreateForm}
              disabled={creatingForm}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="p-2 bg-blue-100 rounded-lg">
                {creatingForm ? (
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 text-blue-600" />
                )}
              </div>
              <div className="text-left">
                <div className="font-medium text-gray-900">
                  {creatingForm ? 'Creating...' : 'Create Form'}
                </div>
                <div className="text-sm text-gray-500">
                  Build a new lead capture form
                </div>
              </div>
            </button>
            <button
              onClick={handleCreateSurvey}
              disabled={creatingSurvey}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="p-2 bg-emerald-100 rounded-lg">
                {creatingSurvey ? (
                  <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 text-emerald-600" />
                )}
              </div>
              <div className="text-left">
                <div className="font-medium text-gray-900">
                  {creatingSurvey ? 'Creating...' : 'Create Survey'}
                </div>
                <div className="text-sm text-gray-500">
                  Design a feedback survey
                </div>
              </div>
            </button>
            <Link
              to="/marketing/social/new"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-rose-300 hover:bg-rose-50 transition-colors"
            >
              <div className="p-2 bg-rose-100 rounded-lg">
                <Plus className="w-4 h-4 text-rose-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">Schedule Post</div>
                <div className="text-sm text-gray-500">
                  Create a social media post
                </div>
              </div>
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Overview</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm text-gray-500">Total Submissions</div>
                <div className="text-xl font-semibold text-gray-900">
                  {(formStats?.totalSubmissions || 0) +
                    (surveyStats?.totalSubmissions || 0)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm text-gray-500">Connected Accounts</div>
                <div className="text-xl font-semibold text-gray-900">
                  {socialStats?.connectedAccounts || 0}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="p-2 bg-rose-100 rounded-lg">
                <Calendar className="w-5 h-5 text-rose-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm text-gray-500">Scheduled Posts</div>
                <div className="text-xl font-semibold text-gray-900">
                  {socialStats?.scheduledPosts || 0}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
