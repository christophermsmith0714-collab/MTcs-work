import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Users (MTCS staff) ──────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull().default(""),
  role: text("role").notNull().default("staff"), // admin | staff
  color: text("color").notNull().default("#4F98A3"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ── Clients ─────────────────────────────────────────────────────────
export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status").notNull().default("Active"),
  code: text("code"),
  category: text("category"),
  company: text("company").notNull(),
  subLocation: text("sub_location"),
  parentCompany: text("parent_company"),
  address1: text("address1"),
  address2: text("address2"),
  city: text("city"),
  state: text("state"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  website: text("website"),
  notes: text("notes"),
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// ── Jobs ─────────────────────────────────────────────────────────────
export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),
  jobType: text("job_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: text("due_date"),
  originalDate: text("original_date"),
  fiveYrAnniversary: text("five_yr_anniversary"),
  renewalNote: text("renewal_note"),
  status: text("status").notNull().default("Not Started"),
  assignedTo: integer("assigned_to"),
  priority: text("priority").notNull().default("Normal"),
  completedAt: text("completed_at"),
  sentAt: text("sent_at"),
  uploadedAt: text("uploaded_at"),
  hoursSpent: text("hours_spent"),
  milesDriven: text("miles_driven"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  createdBy: integer("created_by"),
});

export const insertJobSchema = createInsertSchema(jobs).omit({ id: true });
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

// ── Activity Log ─────────────────────────────────────────────────────
export const activityLog = sqliteTable("activity_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id"),
  clientId: integer("client_id"),
  userId: integer("user_id"),
  action: text("action").notNull(),
  detail: text("detail"),
  createdAt: text("created_at").notNull(),
});

export const insertActivitySchema = createInsertSchema(activityLog).omit({ id: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activityLog.$inferSelect;
