import type { StorageAdapter } from "@gridseal/core";

/**
 * Factory that creates a tenant-scoped StorageAdapter.
 * When tenantId is provided, all operations are scoped to that tenant.
 */
export type StorageFactory = (tenantId: string) => StorageAdapter;

/** Default tenant ID used when multi-tenancy is not enabled. */
export const DEFAULT_TENANT_ID = "__default__";
