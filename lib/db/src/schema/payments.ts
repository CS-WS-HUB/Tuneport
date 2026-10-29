import {
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { paymentStateEnum } from "./enums";
import { projectsTable } from "./projects";

export const projectPaymentsTable = pgTable(
  "project_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    checkoutSessionId: varchar("checkout_session_id", { length: 255 }),
    paymentIntentId: varchar("payment_intent_id", { length: 255 }),
    transferId: varchar("transfer_id", { length: 255 }),
    state: paymentStateEnum("state").notNull().default("CHECKOUT_PENDING"),
    amountCents: integer("amount_cents").notNull(),
    applicationFeeCents: integer("application_fee_cents").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("usd"),
    authorizationExpiresAt: timestamp("authorization_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("project_payments_checkout_session_unique").on(table.checkoutSessionId),
    uniqueIndex("project_payments_intent_unique").on(table.paymentIntentId),
    uniqueIndex("project_payments_transfer_unique").on(table.transferId),
    index("project_payments_project_created_idx").on(table.projectId, table.createdAt),
    index("project_payments_state_idx").on(table.state),
  ],
);

export type ProjectPayment = typeof projectPaymentsTable.$inferSelect;
