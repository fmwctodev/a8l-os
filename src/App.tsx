import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PaymentsGate } from './components/PaymentsGate';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { Dashboard } from './pages/Dashboard';
import { Unauthorized } from './pages/Unauthorized';
import { FeatureDisabled } from './pages/FeatureDisabled';
import { NotFound } from './pages/NotFound';

// Lazy-loaded page components for code splitting
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const Conversations = lazy(() => import('./pages/modules/Conversations').then(m => ({ default: m.Conversations })));
const Calendars = lazy(() => import('./pages/modules/Calendars').then(m => ({ default: m.Calendars })));
const CalendarDetail = lazy(() => import('./pages/modules/CalendarDetail').then(m => ({ default: m.CalendarDetail })));
const Contacts = lazy(() => import('./pages/modules/Contacts').then(m => ({ default: m.Contacts })));
const ContactDetail = lazy(() => import('./pages/modules/ContactDetail').then(m => ({ default: m.ContactDetail })));
const Opportunities = lazy(() => import('./pages/modules/Opportunities').then(m => ({ default: m.Opportunities })));
const OpportunitiesListPage = lazy(() => import('./pages/modules/OpportunitiesListPage').then(m => ({ default: m.OpportunitiesListPage })));
const OpportunityDetail = lazy(() => import('./pages/modules/OpportunityDetail').then(m => ({ default: m.OpportunityDetail })));
const PipelinesPage = lazy(() => import('./pages/modules/PipelinesPage').then(m => ({ default: m.PipelinesPage })));
const OpportunitiesLayout = lazy(() => import('./layouts/OpportunitiesLayout').then(m => ({ default: m.OpportunitiesLayout })));
const GovContractSearch = lazy(() => import('./pages/modules/GovContractSearch'));
const ProjectsLayout = lazy(() => import('./layouts/ProjectsLayout').then(m => ({ default: m.ProjectsLayout })));
const Projects = lazy(() => import('./pages/modules/Projects').then(m => ({ default: m.Projects })));
const ProjectsListPage = lazy(() => import('./pages/modules/ProjectsListPage').then(m => ({ default: m.ProjectsListPage })));
const ProjectPipelinesPage = lazy(() => import('./pages/modules/ProjectPipelinesPage').then(m => ({ default: m.ProjectPipelinesPage })));
const ProjectProfitabilityPage = lazy(() => import('./pages/modules/ProjectProfitabilityPage').then(m => ({ default: m.ProjectProfitabilityPage })));
const ProjectDetail = lazy(() => import('./pages/modules/ProjectDetail').then(m => ({ default: m.ProjectDetail })));
const Payments = lazy(() => import('./pages/modules/Payments').then(m => ({ default: m.Payments })));
const InvoiceDetail = lazy(() => import('./pages/modules/InvoiceDetail').then(m => ({ default: m.InvoiceDetail })));
const Proposals = lazy(() => import('./pages/modules/Proposals').then(m => ({ default: m.Proposals })));
const ProposalDetail = lazy(() => import('./pages/modules/ProposalDetail').then(m => ({ default: m.ProposalDetail })));
const ProposalBuilder = lazy(() => import('./pages/modules/ProposalBuilder').then(m => ({ default: m.ProposalBuilder })));
const AIAgentsLayout = lazy(() => import('./layouts/AIAgentsLayout').then(m => ({ default: m.AIAgentsLayout })));
const AIAgentDetail = lazy(() => import('./pages/modules/AIAgentDetail').then(m => ({ default: m.AIAgentDetail })));
const VoiceAIPage = lazy(() => import('./pages/modules/voice-ai/VoiceAIPage').then(m => ({ default: m.VoiceAIPage })));
const VapiAssistantsListPage = lazy(() => import('./pages/modules/voice-ai/VapiAssistantsListPage').then(m => ({ default: m.VapiAssistantsListPage })));
const VapiAssistantDetailPage = lazy(() => import('./pages/modules/voice-ai/VapiAssistantDetailPage').then(m => ({ default: m.VapiAssistantDetailPage })));
const VapiNumbersPage = lazy(() => import('./pages/modules/voice-ai/VapiNumbersPage').then(m => ({ default: m.VapiNumbersPage })));
const VapiWidgetsPage = lazy(() => import('./pages/modules/voice-ai/VapiWidgetsPage').then(m => ({ default: m.VapiWidgetsPage })));
const VapiToolsPage = lazy(() => import('./pages/modules/voice-ai/VapiToolsPage').then(m => ({ default: m.VapiToolsPage })));
const VapiCallsPage = lazy(() => import('./pages/modules/voice-ai/VapiCallsPage').then(m => ({ default: m.VapiCallsPage })));
const VapiSessionsPage = lazy(() => import('./pages/modules/voice-ai/VapiSessionsPage').then(m => ({ default: m.VapiSessionsPage })));
const VapiAnalyticsPage = lazy(() => import('./pages/modules/voice-ai/VapiAnalyticsPage').then(m => ({ default: m.VapiAnalyticsPage })));
const VapiSettingsPage = lazy(() => import('./pages/modules/voice-ai/VapiSettingsPage').then(m => ({ default: m.VapiSettingsPage })));
const AIAgentsConversation = lazy(() => import('./pages/modules/AIAgentsConversation').then(m => ({ default: m.AIAgentsConversation })));
const AIAgentsKnowledge = lazy(() => import('./pages/modules/AIAgentsKnowledge').then(m => ({ default: m.AIAgentsKnowledge })));
const AIAgentsTemplates = lazy(() => import('./pages/modules/AIAgentsTemplates').then(m => ({ default: m.AIAgentsTemplates })));
const Marketing = lazy(() => import('./pages/modules/Marketing').then(m => ({ default: m.Marketing })));
const MarketingForms = lazy(() => import('./pages/modules/MarketingForms').then(m => ({ default: m.MarketingForms })));
const FormBuilder = lazy(() => import('./pages/modules/FormBuilder').then(m => ({ default: m.FormBuilder })));
const FormSubmissions = lazy(() => import('./pages/modules/FormSubmissions').then(m => ({ default: m.FormSubmissions })));
const MarketingSurveys = lazy(() => import('./pages/modules/MarketingSurveys').then(m => ({ default: m.MarketingSurveys })));
const SurveyBuilder = lazy(() => import('./pages/modules/SurveyBuilder').then(m => ({ default: m.SurveyBuilder })));
const SurveySubmissions = lazy(() => import('./pages/modules/SurveySubmissions').then(m => ({ default: m.SurveySubmissions })));
const AISocialManagerLayout = lazy(() => import('./layouts/AISocialManagerLayout').then(m => ({ default: m.AISocialManagerLayout })));
const PostComposer = lazy(() => import('./pages/modules/PostComposer').then(m => ({ default: m.PostComposer })));
const SocialCalendar = lazy(() => import('./pages/modules/SocialCalendar').then(m => ({ default: m.SocialCalendar })));
const SocialChat = lazy(() => import('./pages/modules/social/SocialChat').then(m => ({ default: m.SocialChat })));
const SocialPosts = lazy(() => import('./pages/modules/social/SocialPosts').then(m => ({ default: m.SocialPosts })));
const SocialCampaigns = lazy(() => import('./pages/modules/social/SocialCampaigns').then(m => ({ default: m.SocialCampaigns })));
const SocialCampaignDetail = lazy(() => import('./pages/modules/social/SocialCampaignDetail').then(m => ({ default: m.SocialCampaignDetail })));
const SocialGuidelines = lazy(() => import('./pages/modules/social/SocialGuidelines').then(m => ({ default: m.SocialGuidelines })));
const SocialAccounts = lazy(() => import('./pages/modules/social/SocialAccounts').then(m => ({ default: m.SocialAccounts })));
const SocialAnalytics = lazy(() => import('./pages/modules/social/SocialAnalytics').then(m => ({ default: m.SocialAnalytics })));
const Automation = lazy(() => import('./pages/modules/Automation').then(m => ({ default: m.Automation })));
const WorkflowBuilderV2 = lazy(() => import('./pages/modules/WorkflowBuilderV2').then(m => ({ default: m.WorkflowBuilderV2 })));
const WorkflowEnrollments = lazy(() => import('./pages/modules/WorkflowEnrollments').then(m => ({ default: m.WorkflowEnrollments })));
const WorkflowRuns = lazy(() => import('./pages/modules/WorkflowRuns'));
const WorkflowRunDetail = lazy(() => import('./pages/modules/WorkflowRunDetail'));
const WorkflowVersions = lazy(() => import('./pages/modules/WorkflowVersions'));
const WorkflowAnalytics = lazy(() => import('./pages/modules/WorkflowAnalytics'));
const AutomationTemplates = lazy(() => import('./pages/modules/AutomationTemplates'));
const AutomationTemplateViewer = lazy(() => import('./pages/modules/AutomationTemplateViewer'));
const AutomationTemplateEditor = lazy(() => import('./pages/modules/AutomationTemplateEditor'));
const AutomationApprovals = lazy(() => import('./pages/modules/AutomationApprovals'));
const AutomationLogs = lazy(() => import('./pages/modules/AutomationLogs'));
const MediaStorage = lazy(() => import('./pages/modules/MediaStorage').then(m => ({ default: m.MediaStorage })));
const Reputation = lazy(() => import('./pages/modules/Reputation').then(m => ({ default: m.Reputation })));
const Reporting = lazy(() => import('./pages/modules/Reporting').then(m => ({ default: m.Reporting })));
const AIReporting = lazy(() => import('./pages/modules/AIReporting').then(m => ({ default: m.AIReporting })));
const ReportView = lazy(() => import('./pages/modules/ReportView').then(m => ({ default: m.ReportView })));
const AuditLogsPage = lazy(() => import('./pages/admin/AuditLogs').then(m => ({ default: m.AuditLogsPage })));
const SettingsLayout = lazy(() => import('./layouts/SettingsLayout').then(m => ({ default: m.SettingsLayout })));
const MyProfilePage = lazy(() => import('./pages/settings/MyProfilePage').then(m => ({ default: m.MyProfilePage })));
const MyStaffPage = lazy(() => import('./pages/settings/MyStaffPage').then(m => ({ default: m.MyStaffPage })));
const OrganizationSettingsPage = lazy(() => import('./pages/settings/OrganizationSettingsPage').then(m => ({ default: m.OrganizationSettingsPage })));
const CalendarsSettingsPage = lazy(() => import('./pages/settings/CalendarsSettingsPage').then(m => ({ default: m.CalendarsSettingsPage })));
const ConversationsSettingsPage = lazy(() => import('./pages/settings/ConversationsSettingsPage').then(m => ({ default: m.ConversationsSettingsPage })));
const AIAgentsSettingsPage = lazy(() => import('./pages/settings/AIAgentsSettingsPage').then(m => ({ default: m.AIAgentsSettingsPage })));
const EmailServicesSettingsPage = lazy(() => import('./pages/settings/EmailServicesSettingsPage').then(m => ({ default: m.EmailServicesSettingsPage })));
const PhoneSystemSettingsPage = lazy(() => import('./pages/settings/PhoneSystemSettingsPage'));
const CustomFieldsSettingsPage = lazy(() => import('./pages/settings/CustomFieldsSettingsPage').then(m => ({ default: m.CustomFieldsSettingsPage })));
const CustomObjectsSettingsPage = lazy(() => import('./pages/settings/CustomObjectsSettingsPage').then(m => ({ default: m.CustomObjectsSettingsPage })));
const CustomObjectRecords = lazy(() => import('./pages/modules/CustomObjectRecords').then(m => ({ default: m.CustomObjectRecords })));
const CustomValuesSettingsPage = lazy(() => import('./pages/settings/CustomValuesSettingsPage').then(m => ({ default: m.CustomValuesSettingsPage })));
const ScoringSettingsPage = lazy(() => import('./pages/settings/ScoringSettingsPage'));
const IntegrationsSettingsPage = lazy(() => import('./pages/settings/IntegrationsSettingsPage').then(m => ({ default: m.IntegrationsSettingsPage })));
const BrandboardSettingsPage = lazy(() => import('./pages/settings/BrandboardSettingsPage').then(m => ({ default: m.BrandboardSettingsPage })));
const BrandKitDetailPage = lazy(() => import('./pages/settings/BrandKitDetailPage').then(m => ({ default: m.BrandKitDetailPage })));
const CRUDHealthCheckPage = lazy(() => import('./pages/settings/CRUDHealthCheckPage').then(m => ({ default: m.CRUDHealthCheckPage })));
const MeetingFollowUpSettingsPage = lazy(() => import('./pages/settings/MeetingFollowUpSettingsPage').then(m => ({ default: m.MeetingFollowUpSettingsPage })));
const AssistantSettingsPage = lazy(() => import('./pages/settings/AssistantSettingsPage'));
const MediaStylePresetsPage = lazy(() => import('./pages/settings/MediaStylePresetsPage').then(m => ({ default: m.MediaStylePresetsPage })));
const BookingPage = lazy(() => import('./pages/public/BookingPage').then(m => ({ default: m.BookingPage })));
const CalendarLandingPage = lazy(() => import('./pages/public/CalendarLandingPage').then(m => ({ default: m.CalendarLandingPage })));
const RescheduleAppointmentPage = lazy(() => import('./pages/public/RescheduleAppointmentPage'));
const CancelAppointmentPage = lazy(() => import('./pages/public/CancelAppointmentPage'));
const PublicFormPage = lazy(() => import('./pages/public/PublicFormPage').then(m => ({ default: m.PublicFormPage })));
const PublicSurveyPage = lazy(() => import('./pages/public/PublicSurveyPage').then(m => ({ default: m.PublicSurveyPage })));
const ReviewPage = lazy(() => import('./pages/public/ReviewPage').then(m => ({ default: m.ReviewPage })));
const PublicProposalPage = lazy(() => import('./pages/public/PublicProposalPage'));
const PublicProposalSignPage = lazy(() => import('./pages/public/PublicProposalSignPage').then(m => ({ default: m.PublicProposalSignPage })));
const Contracts = lazy(() => import('./pages/modules/Contracts').then(m => ({ default: m.Contracts })));
const ContractDetail = lazy(() => import('./pages/modules/ContractDetail').then(m => ({ default: m.ContractDetail })));
const PublicContractPage = lazy(() => import('./pages/public/PublicContractPage'));
const PublicContractSignPage = lazy(() => import('./pages/public/PublicContractSignPage').then(m => ({ default: m.PublicContractSignPage })));
const PostApprovalPage = lazy(() => import('./pages/public/PostApprovalPage'));
const OAuthCallbackPage = lazy(() => import('./pages/public/OAuthCallbackPage').then(m => ({ default: m.OAuthCallbackPage })));
const PublicChangeRequestPage = lazy(() => import('./pages/public/PublicChangeRequestPage').then(m => ({ default: m.PublicChangeRequestPage })));
const PublicChangeRequestStatusPage = lazy(() => import('./pages/public/PublicChangeRequestStatusPage').then(m => ({ default: m.PublicChangeRequestStatusPage })));
// Client portal (contact-scoped)
const ClientPortalLayoutV2 = lazy(() => import('./layouts/ClientPortalLayoutV2').then(m => ({ default: m.ClientPortalLayoutV2 })));
const ClientPortalLoginPage = lazy(() => import('./pages/public/client-portal/LoginPage').then(m => ({ default: m.ClientPortalLoginPage })));
const ClientPortalVerifyCodePage = lazy(() => import('./pages/public/client-portal/VerifyCodePage').then(m => ({ default: m.ClientPortalVerifyCodePage })));
const ClientPortalDashboardPage = lazy(() => import('./pages/public/client-portal/DashboardPage').then(m => ({ default: m.ClientPortalDashboardPage })));
const ClientPortalHomePage = lazy(() => import('./pages/public/portal/ClientPortalHomePage').then(m => ({ default: m.ClientPortalHomePage })));
const ClientPortalChangeRequestsPage = lazy(() => import('./pages/public/portal/ClientPortalChangeRequestsPage').then(m => ({ default: m.ClientPortalChangeRequestsPage })));
const ClientPortalChangeRequestDetailPage = lazy(() => import('./pages/public/portal/ClientPortalChangeRequestDetailPage').then(m => ({ default: m.ClientPortalChangeRequestDetailPage })));
const ClientPortalDocumentsPage = lazy(() => import('./pages/public/portal/ClientPortalDocumentsPage').then(m => ({ default: m.ClientPortalDocumentsPage })));
const ClientPortalSupportTicketsPage = lazy(() => import('./pages/public/portal/ClientPortalSupportTicketsPage').then(m => ({ default: m.ClientPortalSupportTicketsPage })));
const ClientPortalSupportTicketDetailPage = lazy(() => import('./pages/public/portal/ClientPortalSupportTicketDetailPage').then(m => ({ default: m.ClientPortalSupportTicketDetailPage })));
const ClientPortalProjectBridge = lazy(() => import('./components/portal/ClientPortalProjectBridge').then(m => ({ default: m.ClientPortalProjectBridge })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
          <SidebarProvider>
            <Suspense fallback={<PageLoader />}>
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
                path="/custom-objects/:slug"
                element={
                  <ProtectedRoute>
                    <CustomObjectRecords />
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
                path="/government"
                element={
                  <ProtectedRoute permission="opportunities.view" featureFlag="opportunities">
                    <GovContractSearch />
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
                <Route path="profitability" element={<PaymentsGate><ProjectProfitabilityPage /></PaymentsGate>} />
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
                    <PaymentsGate>
                      <Payments />
                    </PaymentsGate>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payments/invoices/:id"
                element={
                  <ProtectedRoute permission="payments.view" featureFlag="payments">
                    <PaymentsGate>
                      <InvoiceDetail />
                    </PaymentsGate>
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
                path="/contracts"
                element={
                  <ProtectedRoute permission="contracts.view" featureFlag="contracts">
                    <Contracts />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/contracts/:id"
                element={
                  <ProtectedRoute permission="contracts.view" featureFlag="contracts">
                    <ContractDetail />
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
                <Route index element={<Navigate to="/ai-agents/voice" replace />} />
                <Route path="getting-started" element={<Navigate to="/ai-agents/voice" replace />} />
                <Route path="voice" element={<VoiceAIPage />}>
                  <Route index element={<VapiAssistantsListPage />} />
                  <Route path="assistants" element={<VapiAssistantsListPage />} />
                  <Route path="assistants/:id" element={<VapiAssistantDetailPage />} />
                  <Route path="numbers" element={<VapiNumbersPage />} />
                  <Route path="widgets" element={<VapiWidgetsPage />} />
                  <Route path="tools" element={<VapiToolsPage />} />
                  <Route path="calls" element={<VapiCallsPage />} />
                  <Route path="sessions" element={<VapiSessionsPage />} />
                  <Route path="analytics" element={<VapiAnalyticsPage />} />
                  <Route path="settings" element={<VapiSettingsPage />} />
                </Route>
                <Route path="conversation" element={<AIAgentsConversation />} />
                <Route path="knowledge" element={<AIAgentsKnowledge />} />
                <Route path="templates" element={<AIAgentsTemplates />} />
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
                path="/marketing/forms/:id/submissions"
                element={
                  <ProtectedRoute permission="marketing.forms.view" featureFlag="marketing">
                    <FormSubmissions />
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
                path="/marketing/surveys/:id/submissions"
                element={
                  <ProtectedRoute permission="marketing.surveys.view" featureFlag="marketing">
                    <SurveySubmissions />
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
                path="/automation/templates"
                element={
                  <ProtectedRoute permission="automation.view" featureFlag="automation">
                    <AutomationTemplates />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/automation/templates/new"
                element={
                  <ProtectedRoute permission="automation.manage" featureFlag="automation">
                    <AutomationTemplateEditor />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/automation/templates/:templateId"
                element={
                  <ProtectedRoute permission="automation.view" featureFlag="automation">
                    <AutomationTemplateViewer />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/automation/templates/:templateId/edit"
                element={
                  <ProtectedRoute permission="automation.manage" featureFlag="automation">
                    <AutomationTemplateEditor />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/automation/approvals"
                element={
                  <ProtectedRoute permission="automation.view" featureFlag="automation">
                    <AutomationApprovals />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/automation/logs"
                element={
                  <ProtectedRoute permission="automation.view" featureFlag="automation">
                    <AutomationLogs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/automation/:id"
                element={
                  <ProtectedRoute permission="automation.view" featureFlag="automation">
                    <WorkflowBuilderV2 />
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
                path="/reporting/:id"
                element={
                  <ProtectedRoute permission="reporting.view" featureFlag="reporting">
                    <ReportView />
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
                  path="custom-objects"
                  element={
                    <ProtectedRoute>
                      <CustomObjectsSettingsPage />
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
            <Route path="/appointments/reschedule/:token" element={<RescheduleAppointmentPage />} />
            <Route path="/appointments/cancel/:token" element={<CancelAppointmentPage />} />
            <Route path="/f/:slug" element={<PublicFormPage />} />
            <Route path="/s/:slug" element={<PublicSurveyPage />} />
            <Route path="/r/:slug" element={<ReviewPage />} />
            <Route path="/p/:token" element={<PublicProposalPage />} />
            <Route path="/sign/proposal/:requestId" element={<PublicProposalSignPage />} />
            <Route path="/c/:token" element={<PublicContractPage />} />
            <Route path="/sign/contract/:requestId" element={<PublicContractSignPage />} />
            <Route path="/marketing/social/approve/:token" element={<PostApprovalPage />} />
            <Route path="/oauth/google-calendar/callback" element={<OAuthCallbackPage />} />
            <Route path="/project-change/submit" element={<PublicChangeRequestPage />} />
            <Route path="/project-change/status/:requestId" element={<PublicChangeRequestStatusPage />} />
            {/* Client portal — contact-scoped, permanent URL */}
            <Route path="/client-portal" element={<ClientPortalLayoutV2 />}>
              <Route index element={<ClientPortalLoginPage />} />
              <Route path="verify" element={<ClientPortalVerifyCodePage />} />
              <Route path="dashboard" element={<ClientPortalDashboardPage />} />
              <Route path="projects/:projectId" element={<ClientPortalProjectBridge />}>
                <Route index element={<ClientPortalHomePage />} />
                <Route path="change-requests" element={<ClientPortalChangeRequestsPage />} />
                <Route path="change-requests/:requestId" element={<ClientPortalChangeRequestDetailPage />} />
                <Route path="support-tickets" element={<ClientPortalSupportTicketsPage />} />
                <Route path="support-tickets/:ticketId" element={<ClientPortalSupportTicketDetailPage />} />
                <Route path="documents" element={<ClientPortalDocumentsPage />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </SidebarProvider>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
