import type { AIAgent } from '../../../types';

export interface KnowledgeFormProps {
  sourceName: string;
  setSourceName: (name: string) => void;
  existingConfig: Record<string, unknown>;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
  saving: boolean;
  isEditing: boolean;
}

export interface KnowledgeFormPropsWithAgents extends KnowledgeFormProps {
  agents: AIAgent[];
  selectedAgentId: string;
  setSelectedAgentId: (id: string) => void;
}

export interface GlobalKnowledgeFormProps extends KnowledgeFormProps {
  description: string;
  setDescription: (desc: string) => void;
  applyToAllAgents: boolean;
  setApplyToAllAgents: (value: boolean) => void;
}
