import { useState } from 'react';
import {
  Link,
  Copy,
  Check,
  RefreshCw,
  Shield,
  Plus,
  Trash2,
  AlertTriangle,
  Play,
  Info,
  ChevronDown,
  Eye,
  EyeOff,
} from 'lucide-react';
import type {
  WebhookTriggerConfig as WebhookTriggerConfigType,
  WebhookContactIdentifier,
  ReEnrollmentPolicy,
  WebhookPayloadMapping,
} from '../../types';
import {
  CONTACT_IDENTIFIER_OPTIONS,
  CONTACT_FIELD_OPTIONS,
  testWebhookTrigger,
} from '../../services/workflowWebhookTriggers';
import { RE_ENROLLMENT_OPTIONS } from '../../services/workflowScheduledTriggers';

interface WebhookTriggerConfigProps {
  config: WebhookTriggerConfigType;
  onChange: (config: WebhookTriggerConfigType) => void;
  onRegenerateToken?: () => Promise<{ token: string }>;
  onRegenerateSecret?: () => Promise<{ secret: string }>;
  onEnableSignature?: () => Promise<{ secret: string }>;
  onDisableSignature?: () => Promise<void>;
}

export function WebhookTriggerConfig({
  config,
  onChange,
  onRegenerateToken,
  onRegenerateSecret,
  onEnableSignature,
  onDisableSignature,
}: WebhookTriggerConfigProps) {
  const [copied, setCopied] = useState<'url' | 'secret' | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testPayload, setTestPayload] = useState('{\n  "email": "test@example.com",\n  "first_name": "John",\n  "last_name": "Doe"\n}');
  const [testResult, setTestResult] = useState<{
    success: boolean;
    contact_identifier_found: boolean;
    identifier_value: unknown;
    mapped_fields: Record<string, unknown>;
    validation_errors: string[];
  } | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const updateConfig = (updates: Partial<WebhookTriggerConfigType>) => {
    onChange({ ...config, ...updates });
  };

  const copyToClipboard = async (text: string, type: 'url' | 'secret') => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleRegenerateToken = async () => {
    if (!onRegenerateToken) return;
    setIsRegenerating(true);
    try {
      const result = await onRegenerateToken();
      updateConfig({ token: result.token });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleRegenerateSecret = async () => {
    if (!onRegenerateSecret) return;
    setIsRegenerating(true);
    try {
      await onRegenerateSecret();
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleToggleSignature = async () => {
    if (config.hasSignatureValidation) {
      if (onDisableSignature) {
        await onDisableSignature();
        updateConfig({ hasSignatureValidation: false });
      }
    } else {
      if (onEnableSignature) {
        await onEnableSignature();
        updateConfig({ hasSignatureValidation: true });
      }
    }
  };

  const addMapping = () => {
    const newMapping: WebhookPayloadMapping = {
      sourceField: '',
      targetField: 'first_name',
    };
    updateConfig({
      payloadMapping: [...config.payloadMapping, newMapping],
    });
  };

  const updateMapping = (index: number, updates: Partial<WebhookPayloadMapping>) => {
    const mappings = [...config.payloadMapping];
    mappings[index] = { ...mappings[index], ...updates };
    updateConfig({ payloadMapping: mappings });
  };

  const removeMapping = (index: number) => {
    const mappings = [...config.payloadMapping];
    mappings.splice(index, 1);
    updateConfig({ payloadMapping: mappings });
  };

  const runTest = async () => {
    if (!config.triggerId) {
      try {
        const payload = JSON.parse(testPayload);
        const identifierValue = getNestedValue(payload, config.contactIdentifierPath);
        const mappedFields: Record<string, unknown> = {};
        const errors: string[] = [];

        if (!identifierValue) {
          errors.push(`Contact identifier not found at path: ${config.contactIdentifierPath}`);
        }

        for (const mapping of config.payloadMapping) {
          const value = getNestedValue(payload, mapping.sourceField);
          if (value !== undefined) {
            mappedFields[mapping.targetField] = value;
          } else {
            errors.push(`Field not found at path: ${mapping.sourceField}`);
          }
        }

        setTestResult({
          success: errors.length === 0,
          contact_identifier_found: !!identifierValue,
          identifier_value: identifierValue,
          mapped_fields: mappedFields,
          validation_errors: errors,
        });
      } catch (err) {
        setTestResult({
          success: false,
          contact_identifier_found: false,
          identifier_value: null,
          mapped_fields: {},
          validation_errors: [`Invalid JSON: ${err instanceof Error ? err.message : 'Unknown error'}`],
        });
      }
      return;
    }

    try {
      const payload = JSON.parse(testPayload);
      const result = await testWebhookTrigger(config.triggerId, payload);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        contact_identifier_found: false,
        identifier_value: null,
        mapped_fields: {},
        validation_errors: [`Test failed: ${err instanceof Error ? err.message : 'Unknown error'}`],
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Webhook Name
        </label>
        <input
          type="text"
          value={config.name}
          onChange={(e) => updateConfig({ name: e.target.value })}
          placeholder="e.g., Zapier Lead Capture"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      </div>

      {config.webhookUrl && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Link className="w-4 h-4 inline mr-1" />
            Webhook URL
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono text-gray-800 dark:text-gray-200 truncate">
              {config.webhookUrl}
            </code>
            <button
              type="button"
              onClick={() => copyToClipboard(config.webhookUrl!, 'url')}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              title="Copy URL"
            >
              {copied === 'url' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
            {onRegenerateToken && (
              <button
                type="button"
                onClick={handleRegenerateToken}
                disabled={isRegenerating}
                className="p-2 text-gray-500 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                title="Regenerate token (invalidates current URL)"
              >
                <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            External services should POST JSON data to this URL
          </p>
        </div>
      )}

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Signature Validation
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.hasSignatureValidation || false}
              onChange={handleToggleSignature}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {config.hasSignatureValidation && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              When enabled, requests must include a valid <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">X-Webhook-Signature</code> header
            </p>
            {onRegenerateSecret && (
              <button
                type="button"
                onClick={handleRegenerateSecret}
                disabled={isRegenerating}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-orange-600 hover:text-orange-700 dark:text-orange-400"
              >
                <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                Regenerate Secret
              </button>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
          Contact Identification
        </h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Identifier Type
            </label>
            <select
              value={config.contactIdentifierField}
              onChange={(e) => updateConfig({ contactIdentifierField: e.target.value as WebhookContactIdentifier })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              {CONTACT_IDENTIFIER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              JSON Path
            </label>
            <input
              type="text"
              value={config.contactIdentifierPath}
              onChange={(e) => updateConfig({ contactIdentifierPath: e.target.value })}
              placeholder="e.g., data.customer.email"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>

        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Specify the path to the contact identifier in the webhook payload (use dot notation for nested fields)
        </p>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Contact Handling
          </h4>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={config.createContactIfMissing}
              onChange={(e) => updateConfig({ createContactIfMissing: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Create new contact if not found
            </span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={config.updateExistingContact}
              onChange={(e) => updateConfig({ updateExistingContact: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Update existing contact with payload data
            </span>
          </label>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Field Mapping
          </h4>
          <button
            type="button"
            onClick={addMapping}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            <Plus className="w-4 h-4" />
            Add Mapping
          </button>
        </div>

        {config.payloadMapping.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            No field mappings configured. Add mappings to extract data from the webhook payload.
          </p>
        ) : (
          <div className="space-y-3">
            {config.payloadMapping.map((mapping, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={mapping.sourceField}
                  onChange={(e) => updateMapping(index, { sourceField: e.target.value })}
                  placeholder="payload.field.path"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <span className="text-gray-400">→</span>
                <select
                  value={mapping.targetField}
                  onChange={(e) => updateMapping(index, { targetField: e.target.value })}
                  className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  {CONTACT_FIELD_OPTIONS.map((field) => (
                    <option key={field.value} value={field.value}>
                      {field.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeMapping(index)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
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

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <button
          type="button"
          onClick={() => setShowTestPanel(!showTestPanel)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          <Play className="w-4 h-4" />
          Test Webhook Configuration
          <ChevronDown className={`w-4 h-4 transition-transform ${showTestPanel ? 'rotate-180' : ''}`} />
        </button>

        {showTestPanel && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Sample Payload (JSON)
              </label>
              <textarea
                value={testPayload}
                onChange={(e) => setTestPayload(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <button
              type="button"
              onClick={runTest}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              <Play className="w-4 h-4" />
              Run Test
            </button>

            {testResult && (
              <div className={`p-4 rounded-lg ${
                testResult.success
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  {testResult.success ? (
                    <Check className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  )}
                  <span className={`font-medium ${
                    testResult.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                  }`}>
                    {testResult.success ? 'Configuration Valid' : 'Configuration Issues Found'}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 dark:text-gray-400">Contact identifier:</span>
                    {testResult.contact_identifier_found ? (
                      <code className="px-2 py-0.5 bg-white dark:bg-gray-800 rounded text-green-700 dark:text-green-300">
                        {String(testResult.identifier_value)}
                      </code>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">Not found</span>
                    )}
                  </div>

                  {Object.keys(testResult.mapped_fields).length > 0 && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Mapped fields:</span>
                      <ul className="mt-1 ml-4 space-y-1">
                        {Object.entries(testResult.mapped_fields).map(([key, value]) => (
                          <li key={key} className="text-gray-700 dark:text-gray-300">
                            <code className="text-xs">{key}</code>: {String(value)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {testResult.validation_errors.length > 0 && (
                    <div>
                      <span className="text-red-600 dark:text-red-400">Errors:</span>
                      <ul className="mt-1 ml-4 space-y-1">
                        {testResult.validation_errors.map((err, i) => (
                          <li key={i} className="text-red-700 dark:text-red-300 text-xs">
                            {err}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}
