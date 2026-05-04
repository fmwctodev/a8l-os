import { PlivoConfig } from '../../components/settings/PlivoConfig';

/**
 * Phone System settings — replaced the legacy 7-tab Twilio UI with the
 * unified PlivoConfig panel that handles connection, number assignment
 * (SMS → Clara/user, voice → Vapi assistant 1:1), Vapi SIP credentials,
 * and webhook URLs in a single page.
 */
export default function PhoneSystemSettingsPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-white">Phone System</h1>
        <p className="text-sm text-slate-400 mt-1">
          Connect Plivo for SMS/MMS and voice. Voice numbers route 1:1 to Vapi assistants;
          SMS routes to Clara (auto-reply) or to a user inbox.
        </p>
      </div>
      <PlivoConfig />
    </div>
  );
}
