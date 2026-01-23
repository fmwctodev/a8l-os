import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Login } from './pages/Login';
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
import { OpportunityDetail } from './pages/modules/OpportunityDetail';
import { Payments } from './pages/modules/Payments';
import { InvoiceDetail } from './pages/modules/InvoiceDetail';
import { AIAgents } from './pages/modules/AIAgents';
import { AIAgentDetail } from './pages/modules/AIAgentDetail';
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
import { SettingsPage } from './pages/admin/Settings';
import { AuditLogsPage } from './pages/admin/AuditLogs';
import { ChannelSettings } from './pages/admin/ChannelSettings';
import { SettingsLayout } from './layouts/SettingsLayout';
import { MyProfilePage } from './pages/settings/MyProfilePage';
import { MyStaffPage } from './pages/settings/MyStaffPage';
import { OrganizationSettingsPage } from './pages/settings/OrganizationSettingsPage';
import { CalendarsSettingsPage } from './pages/settings/CalendarsSettingsPage';
import { AIAgentsSettingsPage } from './pages/settings/AIAgentsSettingsPage';
import { SettingsPlaceholder } from './pages/settings/SettingsPlaceholder';
import { Bell, Shield, CreditCard, Palette, Globe, Zap } from 'lucide-react';
import { CalendarDetail } from './pages/modules/CalendarDetail';
import { BookingPage } from './pages/public/BookingPage';
import { PublicFormPage } from './pages/public/PublicFormPage';
import { PublicSurveyPage } from './pages/public/PublicSurveyPage';
import { ReviewPage } from './pages/public/ReviewPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
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
                  <Opportunities />
                </ProtectedRoute>
              }
            />
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
              path="/ai-agents"
              element={
                <ProtectedRoute permission="ai_agents.view" featureFlag="ai_agents">
                  <AIAgents />
                </ProtectedRoute>
              }
            />
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
                path="notifications"
                element={
                  <SettingsPlaceholder
                    title="Notifications"
                    description="Manage your notification preferences and settings"
                    icon={Bell}
                  />
                }
              />
              <Route
                path="security"
                element={
                  <SettingsPlaceholder
                    title="Security"
                    description="Configure security settings and authentication methods"
                    icon={Shield}
                  />
                }
              />
              <Route
                path="billing"
                element={
                  <ProtectedRoute permission="settings.manage">
                    <SettingsPlaceholder
                      title="Billing"
                      description="Manage your subscription and billing information"
                      icon={CreditCard}
                    />
                  </ProtectedRoute>
                }
              />
              <Route
                path="branding"
                element={
                  <ProtectedRoute permission="settings.manage">
                    <SettingsPlaceholder
                      title="Branding"
                      description="Customize your organization's branding and appearance"
                      icon={Palette}
                    />
                  </ProtectedRoute>
                }
              />
              <Route
                path="domain"
                element={
                  <ProtectedRoute permission="settings.manage">
                    <SettingsPlaceholder
                      title="Domain"
                      description="Configure your custom domain settings"
                      icon={Globe}
                    />
                  </ProtectedRoute>
                }
              />
              <Route
                path="integrations"
                element={
                  <SettingsPlaceholder
                    title="Integrations"
                    description="Manage third-party integrations and API connections"
                    icon={Zap}
                  />
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
