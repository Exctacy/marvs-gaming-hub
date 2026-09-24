import { z } from "zod";

const optionalText = z.string().trim().nullable().optional();

export const reportSchema = z.object({
  branchId: z.string().min(1).optional(),
  reportDate: z.coerce.date(),
  shift: z.enum(["Opening", "Mid", "Night"]),
  adminName: optionalText,
  techName: optionalText,
  status: z.enum(["draft", "submitted"]).default("draft"),
  changes: optionalText,
  followUp: optionalText,
  reportData: z.record(z.unknown()).default({}),
});

export const reportUpdateSchema = reportSchema.partial().extend({
  status: z.enum(["draft", "submitted"]).optional(),
});

const stringList = z.array(z.string().trim()).default([]);

export const configSchema = z.object({
  branchId: z.string().min(1).optional(),
  standardPcs: stringList.optional(),
  vipPcs: stringList.optional(),
  games: stringList.optional(),
  gameStatuses: stringList.optional(),
  shiftPcs: z.record(stringList).optional(),
  spareTypes: stringList.optional(),
  peripheralBrands: z.record(stringList).optional(),
});

export const staffCreateSchema = z.object({
  username: z.string().trim().min(1).max(100),
  full_name: z.string().trim().min(1).max(160).optional(),
  fullName: z.string().trim().min(1).max(160).optional(),
  email: z.string().trim().email().nullable().optional(),
  role: z.enum([
    "super_admin",
    "admin",
    "management",
    "counter_admin",
    "computer_tech",
    "team_leader",
  ]).default("counter_admin"),
  branch_id: z.string().nullable().optional(),
  branchId: z.string().nullable().optional(),
}).refine((data) => Boolean(data.full_name || data.fullName), {
  message: "Username and full name are required",
  path: ["full_name"],
});

export const branchCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  code: z.string().trim().min(1).max(30),
  address: z.string().trim().nullable().optional(),
});

export const branchUpdateSchema = branchCreateSchema.partial().extend({
  active: z.boolean().optional(),
});

export const staffActionSchema = z.object({
  action: z.enum(["reset_password", "deactivate", "activate", "change_role", "change_branch"]),
  new_role: z.string().optional(),
  newRole: z.string().optional(),
  new_branch_id: z.string().nullable().optional(),
  newBranchId: z.string().nullable().optional(),
});
