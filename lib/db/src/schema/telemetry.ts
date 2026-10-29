import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { telemetryValidationEnum } from "./enums";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const telemetryLogsTable = pgTable(
  "telemetry_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    uploadedByUserId: varchar("uploaded_by_user_id", { length: 255 }).notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    objectPath: text("object_path").notNull(),
    filename: varchar("filename", { length: 200 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    validationStatus: telemetryValidationEnum("validation_status").notNull().default("PENDING"),
    expectedXUnit: varchar("expected_x_unit", { length: 30 }).notNull(),
    expectedYUnit: varchar("expected_y_unit", { length: 30 }).notNull(),
    xUnit: varchar("x_unit", { length: 30 }).notNull().default(""),
    yUnit: varchar("y_unit", { length: 30 }).notNull().default(""),
    isMonotonic: boolean("is_monotonic").notNull().default(false),
    detectedRows: integer("detected_rows").notNull().default(0),
    detectedCols: integer("detected_cols").notNull().default(0),
    unitSystemVerified: boolean("unit_system_verified").notNull().default(false),
    errors: jsonb("errors").$type<string[]>().notNull().default([]),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("telemetry_logs_project_created_idx").on(table.projectId, table.createdAt),
    index("telemetry_logs_object_path_idx").on(table.objectPath),
  ],
);

export type TelemetryLog = typeof telemetryLogsTable.$inferSelect;
