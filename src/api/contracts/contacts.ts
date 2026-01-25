import type { ApiResponse, PaginatedResponse, ListQueryParams, BulkOperationResult, EntityRef, AuditInfo } from './common';

export interface ContactResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  source: string | null;
  status: ContactStatus;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  timezone: string | null;
  leadScore: number | null;
  lastActivityAt: string | null;
  owner: EntityRef | null;
  department: EntityRef | null;
  tags: string[];
  customFields: Record<string, unknown>;
  audit: AuditInfo;
}

export type ContactStatus = 'active' | 'inactive' | 'unsubscribed' | 'bounced' | 'blocked';

export interface CreateContactRequest {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  source?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  timezone?: string;
  ownerId?: string;
  departmentId?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

export interface UpdateContactRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  source?: string;
  status?: ContactStatus;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  timezone?: string;
  ownerId?: string;
  departmentId?: string;
  customFields?: Record<string, unknown>;
}

export interface ContactListParams extends ListQueryParams {
  status?: ContactStatus;
  ownerId?: string;
  departmentId?: string;
  tags?: string[];
  hasEmail?: boolean;
  hasPhone?: boolean;
  source?: string;
  createdAfter?: string;
  createdBefore?: string;
  lastActivityAfter?: string;
  lastActivityBefore?: string;
  leadScoreMin?: number;
  leadScoreMax?: number;
}

export interface BulkTagRequest {
  contactIds: string[];
  tags: string[];
  action: 'add' | 'remove' | 'replace';
}

export interface BulkAssignOwnerRequest {
  contactIds: string[];
  ownerId: string;
}

export interface BulkDeleteRequest {
  contactIds: string[];
}

export interface MergeContactsRequest {
  primaryContactId: string;
  secondaryContactIds: string[];
  fieldSelections?: Record<string, string>;
}

export interface ImportContactsRequest {
  data: Array<Record<string, unknown>>;
  fieldMapping: Record<string, string>;
  updateExisting?: boolean;
  matchField?: 'email' | 'phone';
  defaultOwnerId?: string;
  defaultTags?: string[];
}

export interface ImportContactsResponse {
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{
    row: number;
    error: string;
  }>;
}

export type GetContactResponse = ApiResponse<ContactResponse>;
export type ListContactsResponse = ApiResponse<PaginatedResponse<ContactResponse>>;
export type CreateContactResponse = ApiResponse<ContactResponse>;
export type UpdateContactResponse = ApiResponse<ContactResponse>;
export type DeleteContactResponse = ApiResponse<{ deleted: boolean }>;
export type BulkTagResponse = ApiResponse<BulkOperationResult>;
export type BulkAssignOwnerResponse = ApiResponse<BulkOperationResult>;
export type BulkDeleteResponse = ApiResponse<BulkOperationResult>;
export type MergeContactsResponse = ApiResponse<ContactResponse>;
export type ImportContactsApiResponse = ApiResponse<ImportContactsResponse>;
