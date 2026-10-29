import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { invitationStatusEnum, tenantRoleEnum, tenantStatusEnum } from "./enums";
import { usersTable } from "./users";

export const tenantsTable = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyName: varchar("company_name", { length: 120 }).notNull(),
    corporateSlug: varchar("corporate_slug", { length: 140 }).notNull(),
    status: tenantStatusEnum("status").notNull().default("ACTIVE"),
    stripeConnectAccountId: varchar("stripe_connect_account_id", { length: 255 }),
    stripeOnboardingComplete: boolean("stripe_onboarding_complete").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("tenants_corporate_slug_unique").on(table.corporateSlug),
    uniqueIndex("tenants_stripe_account_unique").on(table.stripeConnectAccountId),
    index("tenants_status_idx").on(table.status),
  ],
);

export const tenantMembersTable = pgTable(
  "tenant_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 }).notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    role: tenantRoleEnum("role").notNull().default("END_USER_CLIENT"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("tenant_members_tenant_user_unique").on(table.tenantId, table.userId),
    index("tenant_members_user_idx").on(table.userId),
    index("tenant_members_tenant_idx").on(table.tenantId),
  ],
);

export const tenantInvitationsTable = pgTable(
  "tenant_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    role: tenantRoleEnum("role").notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    status: invitationStatusEnum("status").notNull().default("PENDING"),
    createdByUserId: varchar("created_by_user_id", { length: 255 }).notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("tenant_invitations_token_hash_unique").on(table.tokenHash),
    index("tenant_invitations_tenant_status_idx").on(table.tenantId, table.status),
    index("tenant_invitations_email_idx").on(table.email),
  ],
);

export type Tenant = typeof tenantsTable.$inferSelect;
export type TenantMember = typeof tenantMembersTable.$inferSelect;
export type TenantInvitation = typeof tenantInvitationsTable.$inferSelect;
