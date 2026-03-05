import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { Dashboard } from './pages/Dashboard';
import { Profile } from './pages/Profile';
import { Unauthorized } from './pages/Unauthorized';
import { FeatureDisabled } from './pages/FeatureDisabled';
import { NotFound } from './pages/NotFound';
import { Conversations } from './pages/modules/Conversations';
import { Calendars } from './pages/modules/Calendars';
import { Contacts } from './pages/modules/Contacts';
import { ContactDetail } from './pages/modules/ContactDetail';
import { Opportunities } from './pages/modules/Opportunities';
import { OpportunitiesListPage } from './pages/modules/OpportunitiesListPage';
import { OpportunityDetail } from './pages/modules/OpportunityDetail';
import { PipelinesPage } from './pages/modules/PipelinesPage';
import { OpportunitiesLayout } from './layouts/OpportunitiesLayout';
import { ProjectsLayout } from './layouts/ProjectsLayout';
import { Projects } from './pages/modules/Projects';
import { ProjectsListPage } from './pages/modules/ProjectsListPage';
import { ProjectPipelinesPage } from './pages/modules/ProjectPipelinesPage';
import { ProjectProfitabilityPage } from './pages/modules/ProjectProfitabilityPage';
import { ProjectDetail } from './pages/modules/ProjectDetail';
import { Payments } from './pages/modules/Payments';
import { InvoiceDetail } from './pages/modules/InvoiceDetail';
import { Proposals } from './pages/modules/Proposals';
import { ProposalDetail } from './pages/modules/ProposalDetail';
import { ProposalBuilder } from './pages/modules/ProposalBuilder';
import { AIAgents } from './pages/modules/AIAgents';
import { AIAgentDetail } from './pages/modules/AIAgentDetail';
import { AIAgentsLayout } from './layouts/AIAgentsLayout';
import { AIAgentsGettingStarted } from './pages/modules/AIAgentsGettingStarted';
import { AIAgentsVoice } from './pages/modules/AIAgentsVoice';
import { AIAgentsConversation } from './pages/modules/AIAgentsConversation';
import { AIAgentsKnowledge } from './pages/modules/AIAgentsKnowledge';
import { AIAgentsTemplates } from './pages/modules/AIAgentsTemplates';
import { AIAgentsContent } from './pages/modules/AIAgentsContent';
import { ContentAIAnalytics } from './pages/modules/ContentAIAnalytics';
import { Marketing } from './pages/modules/Marketing';
import { MarketingForms } from './pages/modules/MarketingForms';
import { FormBuilder } from './pages/modules/FormBuilder';
import { MarketingSurveys } from './pages/modules/MarketingSurveys';
import { SurveyBuilder } from './pages/modules/SurveyBuilder';
import { AISocialManagerLayout } from './layouts/AISocialManagerLayout';
import { PostComposer } from './pages/modules/PostComposer';
import { SocialCalendar } from './pages/modules/SocialCalendar';
import { SocialChat } from './pages/modules/social/SocialChat';
import { SocialPosts } from './pages/modules/social/SocialPosts';
import { SocialCampaigns } from './pages/modules/social/SocialCampaigns';
import { SocialCampaignDetail } from './pages/modules/social/SocialCampaignDetail';
import { SocialGuidelines } from './pages/modules/social/SocialGuidelines';
import { SocialAccounts } from './pages/modules/social/SocialAccounts';
import { SocialAnalytics } from './pages/modules/social/SocialAnalytics';
import { Automation } from './pages/modules/Automation';
import { WorkflowBuilder } from './pages/modules/WorkflowBuilder';
import { WorkflowEnrollments } from './pages/modules/WorkflowEnrollments';
import WorkflowRuns from './pages/modules/WorkflowRuns';
import WorkflowRunDetail from './pages/modules/WorkflowRunDetail';
import WorkflowVersions from './pages/modules/WorkflowVersions';
import WorkflowAnalytics from './pages/modules/WorkflowAnalytics';
import { MediaStorage } from './pages/modules/MediaStorage';
import { Reputation } from './pages/modules/Reputation';
import { Reporting } from './pages/modules/Reporting';
import { AIReporting } from './pages/modules/AIReporting';
import { ReportBuilder } from './pages/modules/ReportBuilder';
import { ReportView } from './pages/modules/ReportView';
import { AuditLogsPage } from './pages/admin/AuditLogs';
import { SettingsLayout } from './layouts/SettingsLayout';
import { MyProfilePage } from './pages/settings/MyProfilePage';
import { MyStaffPage } from './pages/settings/MyStaffPage';
import { OrganizationSettingsPage } from './pages/settings/OrganizationSettingsPage';
import { CalendarsSettingsPage } from './pages/settings/CalendarsSettingsPage';
import { ConversationsSettingsPage } from './pages/settings/ConversationsSettingsPage';
import { AIAgentsSettingsPage } from './pages/settings/AIAgentsSettingsPage';
import { EmailServicesSettingsPage } from './pages/settings/EmailServicesSettingsPage';
import PhoneSystemSettingsPage from './pages/settings/PhoneSystemSettingsPage';
import { CustomFieldsSettingsPage } from './pages/settings/CustomFieldsSettingsPage';
import { CustomValuesSettingsPage } from './pages/settings/CustomValuesSettingsPage';
import ScoringSettingsPage from './pages/settings/ScoringSettingsPage';
import { IntegrationsSettingsPage } from './pages/settings/IntegrationsSettingsPage';
import { BrandboardSettingsPage } from './pages/settings/BrandboardSettingsPage';
import { BrandKitDetailPage } from './pages/settings/BrandKitDetailPage';
import { CRUDHealthCheckPage } from './pages/settings/CRUDHealthCheckPage';
import { MeetingFollowUpSettingsPage } from './pages/settings/MeetingFollowUpSettingsPage';
import AssistantSettingsPage from './pages/settings/AssistantSettingsPage';
import { MediaStylePresetsPage } from './pages/settings/MediaStylePresetsPage';
import { CalendarDetail } from './pages/modules/CalendarDetail';
import { BookingPage } from './pages/public/BookingPage';
import { CalendarLandingPage } from './pages/public/CalendarLandingPage';
import { PublicFormPage } from './pages/public/PublicFormPage';
import { PublicSurveyPage } from './pages/public/PublicSurveyPage';
import { ReviewPage } from './pages/public/ReviewPage';
import PublicProposalPage from './pages/public/PublicProposalPage';
import PostApprovalPage from './pages/public/PostApprovalPage';
import { OAuthCallbackPage } from './pages/public/OAuthCallbackPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
          <SidebarProvider>
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/feature-disabled" element={<FeatureDisabled />} />

            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />

              <Route
                path="/conversations"
                element={
                  <ProtectedRoute permission="conversations.view" featureFlag="conversations">
                    <Conversations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/conversations/:conversationId"
                element={
                  <ProtectedRoute permission="conversations.view" featureFlag="conversations">
                    <Conversations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calendars"
                element={
                  <ProtectedRoute permission="calendars.view" featureFlag="calendars">
                    <Calendars />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calendars/:id"
                element={
                  <ProtectedRoute permission="calendars.view" featureFlag="calendars">
                    <CalendarDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/contacts"
                element={
                  <ProtectedRoute permission="contacts.view" featureFlag="contacts">
                    <Contacts />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/contacts/:id"
                element={
                  <ProtectedRoute permission="contacts.view" featureFlag="contacts">
                    <ContactDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/opportunities"
                element={
                  <ProtectedRoute permission="opportunities.view" featureFlag="opportunities">
                    <OpportunitiesLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Opportunities />} />
                <Route path="list" element={<OpportunitiesListPage />} />
                <Route path="pipelines" element={<PipelinesPage />} />
              </Route>
              <Route
                path="/opportunities/:id"
                element={
                  <ProtectedRoute permission="opportunities.view" featureFlag="opportunities">
                    <OpportunityDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects"
                element={
                  <ProtectedRoute permission="projects.view" featureFlag="projects">
                    <ProjectsLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Projects />} />
                <Route path="list" element={<ProjectsListPage />} />
                <Route path="pipelines" element={<ProjectPipelinesPage />} />
                <Route path="profitability" element={<ProjectProfitabilityPage />} />
              </Route>
              <Route
                path="/projects/:id"
                element={
                  <ProtectedRoute permission="projects.view" featureFlag="projects">
                    <ProjectDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payments"
                element={
                  <ProtectedRoute permission="payments.view" featureFlag="payments">
                    <Payments />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payments/invoices/:id"
                element={
                  <ProtectedRoute permission="payments.view" featureFlag="payments">
                    <InvoiceDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/proposals"
                element={
                  <ProtectedRoute permission="proposals.view" featureFlag="proposals">
                    <Proposals />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/proposals/:id"
                element={
                  <ProtectedRoute permission="proposals.view" featureFlag="proposals">
                    <ProposalDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/proposals/:id/build"
                element={
                  <ProtectedRoute permission="proposals.edit" featureFlag="proposals">
                    <ProposalBuilder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ai-agents"
                element={
                  <ProtectedRoute permission="ai_agents.view" featureFlag="ai_agents">
                    <AIAgentsLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<AIAgentsGettingStarted />} />
                <Route path="getting-started" element={<AIAgentsGettingStarted />} />
                <Route path="voice" element={<AIAgentsVoice />} />
                <Route path="conversation" element={<AIAgentsConversation />} />
                <Route path="knowledge" element={<AIAgentsKnowledge />} />
                <Route path="templates" element={<AIAgentsTemplates />} />
                <Route path="content" element={<AIAgentsContent />} />
                <Route path="content/analytics" element={<ContentAIAnalytics />} />
              </Route>
              <Route
                path="/ai-agents/:agentId"
                element={
                  <ProtectedRoute permission="ai_agents.view" featureFlag="ai_agents">
                    <AIAgentDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/marketing"
                element={
                  <ProtectedRoute permission="marketing.view" featureFlag="marketing">
                    <Marketing />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/marketing/forms"
                element={
                  <ProtectedRoute permission="marketing.forms.view" featureFlag="marketing">
                    <MarketingForms />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/marketing/forms/new"
                element={
                  <ProtectedRoute permission="marketing.forms.manage" featureFlag="marketing">
                    <FormBuilder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/marketing/forms/:id"
                element={
                  <ProtectedRoute permission="marketing.forms.view" featureFlag="marketing">
                    <FormBuilder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/marketing/forms/:id/edit"
                element={
                  <ProtectedRoute permission="marketing.forms.manage" featureFlag="marketing">
                    <FormBuilder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/marketing/surveys"
                element={
                  <ProtectedRoute permission="marketing.surveys.view" featureFlag="marketing">
                    <MarketingSurveys />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/marketing/surveys/new"
                element={
                  <ProtectedRoute permission="marketing.surveys.manage" featureFlag="marketing">
                    <SurveyBuilder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/marketing/surveys/:id"
                element={
                  <ProtectedRoute permission="marketing.surveys.view" featureFlag="marketing">
                    <SurveyBuilder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/marketing/surveys/:id/edit"
                element={
                  <ProtectedRoute permission="marketing.surveys.manage" featureFlag="marketing">
                    <SurveyBuilder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/marketing/social"
                element={
                  <ProtectedRoute permission="marketing.social.view" featureFlag="marketing">
                    <AISocialManagerLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<SocialChat />} />
                <Route path="chat" element={<SocialChat />} />
                <Route path="posts" element={<SocialPosts />} />
                <Route path="posts/calendar" element={<SocialCalendar />} />
                <Route path="campaigns" element={<SocialCampaigns />} />
                <Route path="campaigns/:id" element={<SocialCampaignDetail />} />
                <Route path="guidelines" element={<SocialGuidelines />} />
                <Route path="accounts" element={<SocialAccounts />} />
                <Route path="analytics" element={<SocialAnalytics />} />
              </Route>
              <Route
                path="/marketing/social/posts/new"
                element={
                  <ProtectedRoute permission="marketing.social.manage" featureFlag="marketing">
                    <PostComposer />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/marketing/social/posts/:id/edit"
                element={
                  <ProtectedRoute permission="marketing.social.manage" featureFlag="marketing">
                    <PostComposer />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/automation"
                element={
                  <ProtectedRoute permission="automation.view" featureFlag="automation">
                    <Automation />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/automation/:id"
                element={
                  <ProtectedRoute permission="automation.view" featureFlag="automation">
                    <WorkflowBuilder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/automation/:id/enrollments"
                element={
                  <ProtectedRoute permission="automation.view" featureFlag="automation">
                    <WorkflowEnrollments />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/automation/:id/runs"
                element={
                  <ProtectedRoute permission="automation.view" featureFlag="automation">
                    <WorkflowRuns />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/automation/:id/runs/:enrollmentId"
                element={
                  <ProtectedRoute permission="automation.view" featureFlag="automation">
                    <WorkflowRunDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/automation/:id/versions"
                element={
                  <ProtectedRoute permission="automation.view" featureFlag="automation">
                    <WorkflowVersions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/automation/:id/analytics"
                element={
                  <ProtectedRoute permission="automation.view" featureFlag="automation">
                    <WorkflowAnalytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/media"
                element={
                  <ProtectedRoute permission="media.view" featureFlag="media">
                    <MediaStorage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reputation"
                element={
                  <ProtectedRoute permission="reputation.view" featureFlag="reputation">
                    <Reputation />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reporting"
                element={
                  <ProtectedRoute permission="reporting.view" featureFlag="reporting">
                    <Reporting />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reporting/ai"
                element={
                  <ProtectedRoute permission="reporting.ai.query" featureFlag="reporting">
                    <AIReporting />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reporting/new"
                element={
                  <ProtectedRoute permission="reporting.manage" featureFlag="reporting">
                    <ReportBuilder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reporting/:id"
                element={
                  <ProtectedRoute permission="reporting.view" featureFlag="reporting">
                    <ReportView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reporting/:id/edit"
                element={
                  <ProtectedRoute permission="reporting.manage" featureFlag="reporting">
                    <ReportBuilder />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <SettingsLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<MyProfilePage />} />
                <Route path="profile" element={<MyProfilePage />} />
                <Route
                  path="organization"
                  element={
                    <ProtectedRoute permission="settings.manage">
                      <OrganizationSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="staff"
                  element={
                    <ProtectedRoute permission="users.view">
                      <MyStaffPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="conversations"
                  element={
                    <ProtectedRoute featureFlag="snippets">
                      <ConversationsSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="calendars"
                  element={
                    <ProtectedRoute featureFlag="calendars">
                      <CalendarsSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="ai-agents"
                  element={
                    <ProtectedRoute permission="ai.settings.view" featureFlag="ai_agents">
                      <AIAgentsSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="meeting-follow-ups"
                  element={
                    <ProtectedRoute permission="calendars.view" featureFlag="calendars">
                      <MeetingFollowUpSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="assistant"
                  element={
                    <ProtectedRoute permission="personal_assistant.view" featureFlag="personal_assistant">
                      <AssistantSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="media-presets"
                  element={
                    <ProtectedRoute permission="ai.settings.view">
                      <MediaStylePresetsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="email-services"
                  element={
                    <ProtectedRoute featureFlag="email_services">
                      <EmailServicesSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="phone-system"
                  element={
                    <ProtectedRoute permission="phone.settings.view" featureFlag="phone_services">
                      <PhoneSystemSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="custom-fields"
                  element={
                    <ProtectedRoute>
                      <CustomFieldsSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="custom-values"
                  element={
                    <ProtectedRoute featureFlag="custom_values">
                      <CustomValuesSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="scoring"
                  element={
                    <ProtectedRoute featureFlag="scoring_management">
                      <ScoringSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="brandboard"
                  element={
                    <ProtectedRoute permission="brandboard.view" featureFlag="brandboard">
                      <BrandboardSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="brandboard/:brandId"
                  element={
                    <ProtectedRoute permission="brandboard.view" featureFlag="brandboard">
                      <BrandKitDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="integrations"
                  element={
                    <ProtectedRoute featureFlag="integrations">
                      <IntegrationsSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="system/crud-health-check"
                  element={
                    <ProtectedRoute permission="audit.view">
                      <CRUDHealthCheckPage />
                    </ProtectedRoute>
                  }
                />
              </Route>
              <Route
                path="/audit-logs"
                element={
                  <ProtectedRoute permission="audit_logs.view">
                    <AuditLogsPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="/book/:calendarSlug" element={<CalendarLandingPage />} />
            <Route path="/book/:calendarSlug/:typeSlug" element={<BookingPage />} />
            <Route path="/f/:slug" element={<PublicFormPage />} />
            <Route path="/s/:slug" element={<PublicSurveyPage />} />
            <Route path="/r/:slug" element={<ReviewPage />} />
            <Route path="/p/:token" element={<PublicProposalPage />} />
            <Route path="/marketing/social/approve/:token" element={<PostApprovalPage />} />
            <Route path="/oauth/google-calendar/callback" element={<OAuthCallbackPage />} />
            <Route path="*" element={<NotFound />} />
            </Routes>
          </SidebarProvider>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
