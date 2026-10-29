import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { projectLifecycleEnum } from "./enums";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

export const projectsTable = pgTable(
  "calibration_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    createdByUserId: varchar("created_by_user_id", { length: 255 }).notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    clientUserId: varchar("client_user_id", { length: 255 }).references(() => usersTable.id, { onDelete: "set null" }),
    assignedCalibratorUserId: varchar("assigned_calibrator_user_id", { length: 255 }).references(() => usersTable.id, { onDelete: "set null" }),
    engineArchitecture: varchar("engine_architecture", { length: 120 }).notNull(),
    ecuTargetPlatform: varchar("ecu_target_platform", { length: 120 }).notNull(),
    vehicleMake: varchar("vehicle_make", { length: 80 }),
    vehicleModel: varchar("vehicle_model", { length: 80 }),
    vehicleYear: integer("vehicle_year"),
    injectorFlowRatingCc: real("injector_flow_rating_cc").notNull(),
    inductionSpecs: jsonb("induction_specs").$type<Record<string, unknown>>().notNull().default({}),
    diagnosticTroubleCodes: text("diagnostic_trouble_codes").array().notNull().default(sql`'{}'::text[]`),
    lifecycleState: projectLifecycleEnum("lifecycle_state").notNull().default("AWAITING_BUILD_SHEET"),
    priceAmountCents: integer("price_amount_cents").notNull().default(45000),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("calibration_projects_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("calibration_projects_client_idx").on(table.clientUserId),
    index("calibration_projects_lifecycle_idx").on(table.tenantId, table.lifecycleState),
  ],
);

export type CalibrationProject = typeof projectsTable.$inferSelect;
