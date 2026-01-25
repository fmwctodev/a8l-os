import type { ApiResponse, PaginatedResponse, ListQueryParams, EntityRef, AuditInfo } from './common';

export interface OpportunityResponse {
  id: string;
  name: string;
  value: number;
  status: OpportunityStatus;
  pipeline: EntityRef;
  stage: EntityRef;
  contact: EntityRef | null;
  owner: EntityRef | null;
  department: EntityRef | null;
  expectedCloseDate: string | null;
  actualCloseDate: string | null;
  probability: number | null;
  lostReason: EntityRef | null;
  notes: string | null;
  source: string | null;
  customFields: Record<string, unknown>;
  audit: AuditInfo;
}

export type OpportunityStatus = 'open' | 'won' | 'lost' | 'abandoned';

export interface CreateOpportunityRequest {
  name: string;
  value: number;
  pipelineId: string;
  stageId: string;
  contactId?: string;
  ownerId?: string;
  departmentId?: string;
  expectedCloseDate?: string;
  probability?: number;
  notes?: string;
  source?: string;
  customFields?: Record<string, unknown>;
}

export interface UpdateOpportunityRequest {
  name?: string;
  value?: number;
  stageId?: string;
  contactId?: string;
  ownerId?: string;
  departmentId?: string;
  expectedCloseDate?: string;
  probability?: number;
  notes?: string;
  customFields?: Record<string, unknown>;
}

export interface MoveStageRequest {
  stageId: string;
}

export interface CloseWonRequest {
  actualCloseDate?: string;
  notes?: string;
}

export interface CloseLostRequest {
  lostReasonId: string;
  actualCloseDate?: string;
  notes?: string;
}

export interface OpportunityListParams extends ListQueryParams {
  pipelineId?: string;
  stageId?: string;
  status?: OpportunityStatus;
  ownerId?: string;
  contactId?: string;
  valueMin?: number;
  valueMax?: number;
  expectedCloseBefore?: string;
  expectedCloseAfter?: string;
  createdAfter?: string;
  createdBefore?: string;
}

export interface PipelineResponse {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  sortOrder: number;
  stages: StageResponse[];
  audit: AuditInfo;
}

export interface StageResponse {
  id: string;
  name: string;
  probability: number;
  sortOrder: number;
  color: string | null;
  rotting: {
    enabled: boolean;
    days: number | null;
  };
}

export interface CreatePipelineRequest {
  name: string;
  description?: string;
  isDefault?: boolean;
  stages: Array<{
    name: string;
    probability: number;
    color?: string;
    rottingEnabled?: boolean;
    rottingDays?: number;
  }>;
}

export interface UpdatePipelineRequest {
  name?: string;
  description?: string;
  isDefault?: boolean;
}

export interface CreateStageRequest {
  name: string;
  probability: number;
  color?: string;
  rottingEnabled?: boolean;
  rottingDays?: number;
}

export interface UpdateStageRequest {
  name?: string;
  probability?: number;
  color?: string;
  rottingEnabled?: boolean;
  rottingDays?: number;
}

export interface ReorderStagesRequest {
  stageIds: string[];
}

export type GetOpportunityResponse = ApiResponse<OpportunityResponse>;
export type ListOpportunitiesResponse = ApiResponse<PaginatedResponse<OpportunityResponse>>;
export type CreateOpportunityResponse = ApiResponse<OpportunityResponse>;
export type UpdateOpportunityResponse = ApiResponse<OpportunityResponse>;
export type MoveStageResponse = ApiResponse<OpportunityResponse>;
export type CloseWonResponse = ApiResponse<OpportunityResponse>;
export type CloseLostResponse = ApiResponse<OpportunityResponse>;
export type DeleteOpportunityResponse = ApiResponse<{ deleted: boolean }>;
export type GetPipelineResponse = ApiResponse<PipelineResponse>;
export type ListPipelinesResponse = ApiResponse<PipelineResponse[]>;
export type CreatePipelineResponse = ApiResponse<PipelineResponse>;
export type UpdatePipelineResponse = ApiResponse<PipelineResponse>;
