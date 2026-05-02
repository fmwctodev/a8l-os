import { X, Settings, Info } from 'lucide-react';
import type { WorkflowSettings } from '../../../../types/workflowBuilder';

interface WorkflowSettingsPanelProps {
  settings: WorkflowSettings;
  workflowName: string;
  workflowDescription: string;
  onChange: (settings: WorkflowSettings) => void;
  onNameChange: (name: string) => void;
  onDescriptionChange: (desc: string) => void;
  onClose: () => void;
}

export function WorkflowSettingsPanel({
  settings,
  workflowName,
  workflowDescription,
  onChange,
  onNameChange,
  onDescriptionChange,
  onClose,
}: WorkflowSettingsPanelProps) {
  const update = (partial: Partial<WorkflowSettings>) => {
    onChange({ ...settings, ...partial });
  };

  const updateEnrollment = (partial: Partial<WorkflowSettings['enrollmentRules']>) => {
    onChange({
      ...settings,
      enrollmentRules: { ...settings.enrollmentRules, ...partial },
    });
  };

  return (
    <div className="w-[440px] h-full bg-white border-l border-gray-200 flex flex-col shadow-xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-gray-800 flex items-center justify-center">
            <Settings className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Workflow Settings</h3>
            <p className="text-xs text-gray-500">Configure behavior and rules</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors">
          <X className="w-4.5 h-4.5 text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        <section className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">General</h4>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Workflow Name</label>
            <input
              type="text"
              value={workflowName}
              onChange={e => onNameChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={workflowDescription}
              onChange={e => onDescriptionChange(e.target.value)}
              placeholder="What does this workflow do?"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Folder</label>
              <input
                type="text"
                value={settings.folder ?? ''}
                onChange={e => update({ folder: e.target.value })}
                placeholder="Optional"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <input
                type="text"
                value={settings.category ?? ''}
                onChange={e => update({ category: e.target.value })}
                placeholder="Optional"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
        </section>

        <div className="border-t border-gray-100" />

        <section className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Enrollment Rules</h4>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Re-enrollment</label>
            <select
              value={settings.enrollmentRules.allow_re_enrollment}
              onChange={e => updateEnrollment({ allow_re_enrollment: e.target.value as any })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="never">Never allow re-enrollment</option>
              <option value="after_completion">After previous run completes</option>
              <option value="always">Always allow</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">Controls whether contacts can enter this workflow more than once.</p>
          </div>

          <label className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enrollmentRules.stop_existing_on_re_entry}
              onChange={e => updateEnrollment({ stop_existing_on_re_entry: e.target.checked })}
              className="rounded border-gray-300 mt-0.5"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">Stop existing enrollment on re-entry</span>
              <p className="text-xs text-gray-500 mt-0.5">If a contact re-enters, stop their current run first.</p>
            </div>
          </label>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Max Concurrent Enrollments</label>
            <input
              type="number"
              min={1}
              max={100}
              value={settings.enrollmentRules.max_concurrent_enrollments}
              onChange={e => updateEnrollment({ max_concurrent_enrollments: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <p className="text-xs text-gray-400 mt-1">Maximum active enrollments per contact at once.</p>
          </div>
        </section>

        <div className="border-t border-gray-100" />

        <section className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Execution</h4>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Wait Step Timeout (days)</label>
            <input
              type="number"
              min={1}
              max={365}
              value={settings.waitTimeoutDays}
              onChange={e => update({ waitTimeoutDays: parseInt(e.target.value) || 30 })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <p className="text-xs text-gray-400 mt-1">Auto-terminate enrollments stuck in a wait step after this many days.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Logging Level</label>
            <select
              value={settings.loggingVerbosity}
              onChange={e => update({ loggingVerbosity: e.target.value as any })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="minimal">Minimal</option>
              <option value="standard">Standard</option>
              <option value="verbose">Verbose (debug)</option>
            </select>
          </div>
        </section>

        <div className="border-t border-gray-100" />

        <section className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Reply & Drip Behavior</h4>

          <label className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={!!settings.stopOnResponse}
              onChange={e => update({ stopOnResponse: e.target.checked })}
              className="rounded border-gray-300 mt-0.5"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">Stop on Response</span>
              <p className="text-xs text-gray-500 mt-0.5">Auto-remove a contact from this workflow as soon as they reply on any channel after enrollment. Prevents the system from continuing automated follow-ups after a human conversation starts.</p>
            </div>
          </label>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Drip Throttle</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  type="number"
                  min={0}
                  max={10000}
                  value={settings.dripBatchSize ?? 0}
                  onChange={e => update({ dripBatchSize: parseInt(e.target.value) || 0 })}
                  placeholder="0 = no limit"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">contacts per window</p>
              </div>
              <div>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={settings.dripIntervalMinutes ?? 60}
                  onChange={e => update({ dripIntervalMinutes: parseInt(e.target.value) || 60 })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">window in minutes</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">Cap how many contacts move through this workflow per window. Use for bulk SMS / email sends to avoid carrier flagging or team overload. Set to 0 for no limit.</p>
          </div>
        </section>

        <div className="border-t border-gray-100" />

        <div className="flex items-start gap-2.5 p-3 bg-blue-50 rounded-lg">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            Changes to settings take effect on the next publish. They do not affect currently running enrollments.
          </p>
        </div>
      </div>
    </div>
  );
}
