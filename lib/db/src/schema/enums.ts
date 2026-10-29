import { pgEnum } from "drizzle-orm/pg-core";

export const globalRoleEnum = pgEnum("global_role", ["USER", "SUPER_ADMIN"]);

export const tenantRoleEnum = pgEnum("tenant_role", [
  "SUPER_ADMIN",
  "SHOP_OWNER",
  "STAFF_CALIBRATOR",
  "END_USER_CLIENT",
]);

export const tenantStatusEnum = pgEnum("tenant_status", [
  "PROVISIONING",
  "ACTIVE",
  "SUSPENDED",
  "TERMINATED",
]);

export const projectLifecycleEnum = pgEnum("project_lifecycle", [
  "AWAITING_BUILD_SHEET",
  "DIAGNOSTIC_MAPPING",
  "LOGGING_PENDING",
  "CALIBRATION_READY",
  "COMPLETION_VERIFIED",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "PENDING",
  "ACCEPTED",
  "REVOKED",
]);

export const telemetryValidationEnum = pgEnum("telemetry_validation", [
  "PENDING",
  "VALID",
  "WARNING",
  "INVALID",
]);

export const paymentStateEnum = pgEnum("payment_state", [
  "CHECKOUT_PENDING",
  "AUTHORIZED",
  "CAPTURED",
  "TRANSFERRED",
  "CANCELED",
  "FAILED",
  "AUTHORIZATION_EXPIRED",
]);
