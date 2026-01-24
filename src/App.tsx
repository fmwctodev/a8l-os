import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SidebarProvider } from './contexts/SidebarContext';
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
import { Marketing } from './pages/modules/Marketing';
import { MarketingForms } from './pages/modules/MarketingForms';
import { FormBuilder } from './pages/modules/FormBuilder';
import { MarketingSurveys } from './pages/modules/MarketingSurveys';
import { SurveyBuilder } from './pages/modules/SurveyBuilder';
import { SocialPlanner } from './pages/modules/SocialPlanner';
import { Automation } from './pages/modules/Automation';
import { WorkflowBuilder } from './pages/modules/WorkflowBuilder';
import { WorkflowEnrollments } from './pages/modules/WorkflowEnrollments';
import { MediaStorage } from './pages/modules/MediaStorage';
import { Reputation } from './pages/modules/Reputation';
import { Reporting } from './pages/modules/Reporting';
import { ReportBuilder } from './pages/modules/ReportBuilder';
import { ReportView } from './pages/modules/ReportView';
import { UsersPage } from './pages/admin/Users';
import { AuditLogsPage } from './pages/admin/AuditLogs';
import { ChannelSettings } from './pages/admin/ChannelSettings';
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
import { SecretsSettingsPage } from './pages/settings/SecretsSettingsPage';
import ScoringSettingsPage from './pages/settings/ScoringSettingsPage';
import { IntegrationsSettingsPage } from './pages/settings/IntegrationsSettingsPage';
import { BrandboardSettingsPage } from './pages/settings/BrandboardSettingsPage';
import { CalendarDetail } from './pages/modules/CalendarDetail';
import { BookingPage } from './pages/public/BookingPage';
import { PublicFormPage } from './pages/public/PublicFormPage';
import { PublicSurveyPage } from './pages/public/PublicSurveyPage';
import { ReviewPage } from './pages/public/ReviewPage';
import PublicProposalPage from './pages/public/PublicProposalPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
                path="/marketing/social"
                element={
                  <ProtectedRoute permission="marketing.social.view" featureFlag="marketing">
                    <SocialPlanner />
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
                path="/users"
                element={
                  <ProtectedRoute permission="users.view">
                    <UsersPage />
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
                    <ProtectedRoute permission="snippets.view" featureFlag="snippets">
                      <ConversationsSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="calendars"
                  element={
                    <ProtectedRoute permission="calendars.view" featureFlag="calendars">
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
                  path="email-services"
                  element={
                    <ProtectedRoute permission="email.settings.view" featureFlag="email_services">
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
                    <ProtectedRoute permission="custom_fields.view">
                      <CustomFieldsSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="secrets"
                  element={
                    <ProtectedRoute permission="secrets.view" featureFlag="secrets_management">
                      <SecretsSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="scoring"
                  element={
                    <ProtectedRoute permission="scoring.view" featureFlag="scoring_management">
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
                  path="integrations"
                  element={
                    <ProtectedRoute permission="integrations.view" featureFlag="integrations">
                      <IntegrationsSettingsPage />
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
              <Route
                path="/channels"
                element={
                  <ProtectedRoute permission="channels.configure">
                    <ChannelSettings />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="/book/:calendarSlug/:typeSlug" element={<BookingPage />} />
            <Route path="/f/:slug" element={<PublicFormPage />} />
            <Route path="/s/:slug" element={<PublicSurveyPage />} />
            <Route path="/r/:slug" element={<ReviewPage />} />
            <Route path="/p/:token" element={<PublicProposalPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SidebarProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
