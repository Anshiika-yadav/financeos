// ─── Tenant Context ───────────────────────────────────────────────────────────
// Every data-touching function receives this — derived from the authenticated
// session, never from raw client input.
import { Prisma } from '@prisma/client';

export interface TenantContext {
  tenantId: string;
  actorId: string;
  permittedScope: string[];
}

// ─── Shared Status Enum ───────────────────────────────────────────────────────
export enum RecordStatus {
  Draft = 'Draft',
  Pending = 'Pending',
  Approved = 'Approved',
  Posted = 'Posted',
  PartiallyPaid = 'Partially Paid',
  Paid = 'Paid',
  Rejected = 'Rejected',
  Cancelled = 'Cancelled',
  Closed = 'Closed',
  Exception = 'Exception',
}

// ─── Audit ────────────────────────────────────────────────────────────────────
export interface AuditEvent {
  tenantId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CursorPageParams {
  cursor?: string;
  limit?: number;
  [key: string]: unknown;
}

// ─── API Response ─────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
  meta?: Record<string, unknown>;
  correlationId?: string;
}

// ─── Permission ───────────────────────────────────────────────────────────────
export type Action =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'post'
  | 'reverse'
  | 'export'
  | 'import'
  | 'configure'
  | 'manage_users';

export type ResourceType =
  | 'journal'
  | 'account'
  | 'fiscal_period'
  | 'bill'
  | 'payment_run'
  | 'invoice'
  | 'receipt'
  | 'bank_account'
  | 'tenant'
  | 'user'
  | 'role'
  | 'report'
  | 'budget'
  | 'asset'
  | 'expense'
  | 'project'
  | 'contract'
  | 'inventory'
  | string;
export interface PermissionResource {
  type: ResourceType;
  module: string;
  id?: string;
  ownerId?: string;
  tenantId?: string;
  [key: string]: unknown;
}

// ─── Platform Roles ───────────────────────────────────────────────────────────
export enum PlatformRole {
  SuperAdmin = 'super_admin',
  SupportAgent = 'support_agent',
  BillingAdmin = 'billing_admin',
}

export enum TenantRole {
  Owner = 'owner',
  Admin = 'admin',
  Controller = 'controller',
  Accountant = 'accountant',
  Approver = 'approver',
  Viewer = 'viewer',
  Operator = 'operator',
}

// ─── Express augmentation ─────────────────────────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
      correlationId?: string;
      user?: {
        userId: string;
        email: string;
        platformRole?: PlatformRole;
      };
       withTenantDb?: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>;
    }
  }
}
