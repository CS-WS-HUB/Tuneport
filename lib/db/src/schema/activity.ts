import { index, jsonb, pgTable, text, timestamp, varchar, uuid } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

export const activityEventsTable = pgTable(
  "activity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    projectId: uuid("project_id"),
    actorUserId: varchar("actor_user_id", { length: 255 }).references(() => usersTable.id, { onDelete: "set null" }),
    actorName: varchar("actor_name", { length: 200 }).notNull().default("System"),
    action: varchar("action", { length: 80 }).notNull(),
    summary: text("summary").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("activity_events_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("activity_events_project_idx").on(table.projectId),
  ],
);

export type ActivityEvent = typeof activityEventsTable.$inferSelect;
