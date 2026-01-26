import { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Calendar,
  Filter,
  Plus,
  Trash2,
  ChevronDown,
  RefreshCw,
  Info,
} from 'lucide-react';
import type {
  ScheduledTriggerConfig as ScheduledTriggerConfigType,
  ScheduledTriggerCadence,
  ReEnrollmentPolicy,
  ScheduledTriggerFilterRule,
} from '../../types';
import {
  CADENCE_OPTIONS,
  DAY_OF_WEEK_OPTIONS,
  RE_ENROLLMENT_OPTIONS,
  CONTACT_FILTER_FIELDS,
  FILTER_OPERATORS,
  TAG_OPERATORS,
  previewSchedule,
} from '../../services/workflowScheduledTriggers';

interface ScheduledTriggerConfigProps {
  config: ScheduledTriggerConfigType;
  onChange: (config: ScheduledTriggerConfigType) => void;
  tags?: Array<{ id: string; name: string }>;
  users?: Array<{ id: string; first_name: string; last_name: string }>;
  departments?: Array<{ id: string; name: string }>;
}

const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HST)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
];

export function ScheduledTriggerConfig({
  config,
  onChange,
  tags = [],
  users = [],
  departments = [],
}: ScheduledTriggerConfigProps) {
  const [showFilters, setShowFilters] = useState(
    (config.filterConfig?.rules?.length || 0) > 0
  );

  const schedulePreview = useMemo(() => {
    try {
      return previewSchedule(
        {
          cadence: config.cadence,
          time_of_day: config.timeOfDay,
          timezone: config.timezone,
          day_of_week: config.dayOfWeek,
          day_of_month: config.dayOfMonth,
        },
        5
      );
    } catch {
      return [];
    }
  }, [config.cadence, config.timeOfDay, config.timezone, config.dayOfWeek, config.dayOfMonth]);

  const updateConfig = (updates: Partial<ScheduledTriggerConfigType>) => {
    onChange({ ...config, ...updates });
  };

  const addFilterRule = () => {
    const newRule: ScheduledTriggerFilterRule = {
      field: 'status',
      operator: 'equals',
      value: '',
    };
    updateConfig({
      filterConfig: {
        ...config.filterConfig,
        logic: config.filterConfig?.logic || 'and',
        rules: [...(config.filterConfig?.rules || []), newRule],
      },
    });
  };

  const updateFilterRule = (index: number, updates: Partial<ScheduledTriggerFilterRule>) => {
    const rules = [...(config.filterConfig?.rules || [])];
    rules[index] = { ...rules[index], ...updates };
    updateConfig({
      filterConfig: {
        ...config.filterConfig,
        rules,
      },
    });
  };

  const removeFilterRule = (index: number) => {
    const rules = [...(config.filterConfig?.rules || [])];
    rules.splice(index, 1);
    updateConfig({
      filterConfig: {
        ...config.filterConfig,
        rules,
      },
    });
  };

  const getOperatorsForField = (field: string) => {
    if (field === 'tags') return TAG_OPERATORS;
    return FILTER_OPERATORS;
  };

  const renderValueInput = (rule: ScheduledTriggerFilterRule, index: number) => {
    const fieldConfig = CONTACT_FILTER_FIELDS.find((f) => f.value === rule.field);

    if (['is_empty', 'is_not_empty'].includes(rule.operator)) {
      return null;
    }

    if (rule.field === 'tags') {
      return (
        <select
          multiple
          value={Array.isArray(rule.value) ? rule.value as string[] : []}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
            updateFilterRule(index, { value: selected });
          }}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      );
    }

    if (fieldConfig?.type === 'select' && rule.field === 'status') {
      return (
        <select
          value={rule.value as string}
          onChange={(e) => updateFilterRule(index, { value: e.target.value })}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          <option value="">Select status</option>
          <option value="lead">Lead</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="customer">Customer</option>
        </select>
      );
    }

    if (fieldConfig?.type === 'user') {
      return (
        <select
          value={rule.value as string}
          onChange={(e) => updateFilterRule(index, { value: e.target.value })}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          <option value="">Select user</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.first_name} {user.last_name}
            </option>
          ))}
        </select>
      );
    }

    if (fieldConfig?.type === 'department') {
      return (
        <select
          value={rule.value as string}
          onChange={(e) => updateFilterRule(index, { value: e.target.value })}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          <option value="">Select department</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
      );
    }

    if (fieldConfig?.type === 'number' || ['in_last_days', 'not_in_last_days'].includes(rule.operator)) {
      return (
        <input
          type="number"
          value={rule.value as number}
          onChange={(e) => updateFilterRule(index, { value: Number(e.target.value) })}
          placeholder={['in_last_days', 'not_in_last_days'].includes(rule.operator) ? 'Days' : 'Value'}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      );
    }

    return (
      <input
        type="text"
        value={rule.value as string}
        onChange={(e) => updateFilterRule(index, { value: e.target.value })}
        placeholder="Value"
        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      />
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Schedule Name
        </label>
        <input
          type="text"
          value={config.name}
          onChange={(e) => updateConfig({ name: e.target.value })}
          placeholder="e.g., Daily Lead Follow-up"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Clock className="w-4 h-4 inline mr-1" />
            Cadence
          </label>
          <select
            value={config.cadence}
            onChange={(e) => updateConfig({ cadence: e.target.value as ScheduledTriggerCadence })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            {CADENCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Time of Day
          </label>
          <input
            type="time"
            value={config.timeOfDay}
            onChange={(e) => updateConfig({ timeOfDay: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
      </div>

      {config.cadence === 'weekly' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="w-4 h-4 inline mr-1" />
            Day of Week
          </label>
          <select
            value={config.dayOfWeek ?? 1}
            onChange={(e) => updateConfig({ dayOfWeek: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            {DAY_OF_WEEK_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {config.cadence === 'monthly' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="w-4 h-4 inline mr-1" />
            Day of Month
          </label>
          <select
            value={config.dayOfMonth ?? 1}
            onChange={(e) => updateConfig({ dayOfMonth: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
            <option value={32}>Last day of month</option>
          </select>
        </div>
      )}

      {config.cadence === 'custom_cron' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Cron Expression
          </label>
          <input
            type="text"
            value={config.cronExpression || ''}
            onChange={(e) => updateConfig({ cronExpression: e.target.value })}
            placeholder="0 9 * * *"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
          <p className="mt-1 text-xs text-gray-500">
            Format: minute hour day-of-month month day-of-week
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Timezone
        </label>
        <select
          value={config.timezone}
          onChange={(e) => updateConfig({ timezone: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          {TIMEZONE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {schedulePreview.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Next {schedulePreview.length} runs
          </h4>
          <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
            {schedulePreview.map((date, i) => (
              <li key={i}>
                {date.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          <Filter className="w-4 h-4" />
          Contact Filters
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          {(config.filterConfig?.rules?.length || 0) > 0 && (
            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-full">
              {config.filterConfig?.rules?.length}
            </span>
          )}
        </button>

        {showFilters && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Info className="w-4 h-4" />
              Only contacts matching these filters will be enrolled
            </div>

            {(config.filterConfig?.rules?.length || 0) > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Match</span>
                <select
                  value={config.filterConfig?.logic || 'and'}
                  onChange={(e) =>
                    updateConfig({
                      filterConfig: {
                        ...config.filterConfig,
                        logic: e.target.value as 'and' | 'or',
                      },
                    })
                  }
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="and">All conditions (AND)</option>
                  <option value="or">Any condition (OR)</option>
                </select>
              </div>
            )}

            <div className="space-y-3">
              {(config.filterConfig?.rules || []).map((rule, index) => (
                <div key={index} className="flex items-center gap-2">
                  <select
                    value={rule.field}
                    onChange={(e) => updateFilterRule(index, { field: e.target.value, value: '' })}
                    className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    {CONTACT_FILTER_FIELDS.map((field) => (
                      <option key={field.value} value={field.value}>
                        {field.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={rule.operator}
                    onChange={(e) => updateFilterRule(index, { operator: e.target.value })}
                    className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    {getOperatorsForField(rule.field).map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>

                  {renderValueInput(rule, index)}

                  <button
                    type="button"
                    onClick={() => removeFilterRule(index)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addFilterRule}
              className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <Plus className="w-4 h-4" />
              Add filter condition
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Re-enrollment Policy
        </label>
        <div className="space-y-2">
          {RE_ENROLLMENT_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                config.reEnrollmentPolicy === opt.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <input
                type="radio"
                name="reEnrollmentPolicy"
                value={opt.value}
                checked={config.reEnrollmentPolicy === opt.value}
                onChange={(e) => updateConfig({ reEnrollmentPolicy: e.target.value as ReEnrollmentPolicy })}
                className="mt-1"
              />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {opt.label}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {opt.description}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
