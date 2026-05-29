import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, like, or, desc, asc, and, sql } from "drizzle-orm";
import {
  users, clients, jobs, activityLog,
  type User, type InsertUser,
  type Client, type InsertClient,
  type Job, type InsertJob,
  type Activity, type InsertActivity,
} from "@shared/schema";

const sqlite = new Database("data.db");
const db = drizzle(sqlite);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'staff',
    color TEXT NOT NULL DEFAULT '#4F98A3'
  );
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL DEFAULT 'Active',
    code TEXT, category TEXT,
    company TEXT NOT NULL,
    sub_location TEXT, parent_company TEXT,
    address1 TEXT, address2 TEXT, city TEXT, state TEXT,
    contact_name TEXT, contact_phone TEXT, contact_email TEXT,
    website TEXT, notes TEXT
  );
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    job_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT, due_date TEXT,
    original_date TEXT, five_yr_anniversary TEXT, renewal_note TEXT,
    status TEXT NOT NULL DEFAULT 'Not Started',
    assigned_to INTEGER,
    priority TEXT NOT NULL DEFAULT 'Normal',
    completed_at TEXT, sent_at TEXT, uploaded_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    created_by INTEGER
  );
  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER, client_id INTEGER, user_id INTEGER,
    action TEXT NOT NULL, detail TEXT,
    created_at TEXT NOT NULL
  );
`);

// Add missing columns if upgrading existing DB
try { sqlite.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''`); } catch {}
try { sqlite.exec(`ALTER TABLE jobs ADD COLUMN created_by INTEGER`); } catch {}

export interface IStorage {
  // Sessions
  createSession(token: string, userId: number, role: string, name: string): void;
  getSession(token: string): { userId: number; role: string; name: string } | null;
  deleteSession(token: string): void;

  getUsers(): User[];
  getUserById(id: number): User | undefined;
  getUserByEmail(email: string): User | undefined;
  createUser(data: InsertUser): User;
  updateUser(id: number, data: Partial<InsertUser>): User | undefined;
  deleteUser(id: number): void;

  getClients(search?: string, status?: string, category?: string): Client[];
  getClientById(id: number): Client | undefined;
  createClient(data: InsertClient): Client;
  updateClient(id: number, data: Partial<InsertClient>): Client | undefined;
  deleteClient(id: number): void;

  getJobs(filters?: { clientId?: number; assignedTo?: number; status?: string; jobType?: string; overdue?: boolean; completed?: boolean }): Job[];
  getJobById(id: number): Job | undefined;
  createJob(data: InsertJob): Job;
  updateJob(id: number, data: Partial<InsertJob>): Job | undefined;
  deleteJob(id: number): void;

  getDashboardStats(assignedTo?: number): { activeJobs: number; dueThisWeek: number; overdue: number; totalClients: number };
  getActivity(limit?: number): Activity[];
  logActivity(data: InsertActivity): Activity;
  bulkInsertClients(data: InsertClient[]): void;
  bulkInsertJobs(data: InsertJob[]): void;
}

export class Storage implements IStorage {
  createSession(token: string, userId: number, role: string, name: string): void {
    sqlite.prepare(`INSERT OR REPLACE INTO sessions (token, user_id, role, name, created_at) VALUES (?, ?, ?, ?, ?)`)
      .run(token, userId, role, name, new Date().toISOString());
  }
  getSession(token: string): { userId: number; role: string; name: string } | null {
    const row = sqlite.prepare(`SELECT user_id, role, name FROM sessions WHERE token = ?`).get(token) as any;
    if (!row) return null;
    return { userId: row.user_id, role: row.role, name: row.name };
  }
  deleteSession(token: string): void {
    sqlite.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
  }

  getUsers(): User[] {
    return db.select().from(users).orderBy(asc(users.name)).all();
  }
  getUserById(id: number): User | undefined {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
  getUserByEmail(email: string): User | undefined {
    return db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
  }
  createUser(data: InsertUser): User {
    return db.insert(users).values({ ...data, email: data.email.toLowerCase() }).returning().get();
  }
  updateUser(id: number, data: Partial<InsertUser>): User | undefined {
    return db.update(users).set(data).where(eq(users.id, id)).returning().get();
  }
  deleteUser(id: number): void {
    db.delete(users).where(eq(users.id, id)).run();
  }

  getClients(search?: string, status?: string, category?: string): Client[] {
    const conditions: any[] = [];
    if (search) conditions.push(or(like(clients.company, `%${search}%`), like(clients.city, `%${search}%`), like(clients.state, `%${search}%`), like(clients.parentCompany, `%${search}%`), like(clients.contactName, `%${search}%`)));
    if (status) conditions.push(eq(clients.status, status));
    if (category) conditions.push(eq(clients.category, category));
    const q = db.select().from(clients);
    return conditions.length > 0 ? q.where(and(...conditions)).orderBy(asc(clients.company)).all() : q.orderBy(asc(clients.company)).all();
  }
  getClientById(id: number): Client | undefined {
    return db.select().from(clients).where(eq(clients.id, id)).get();
  }
  createClient(data: InsertClient): Client {
    return db.insert(clients).values(data).returning().get();
  }
  updateClient(id: number, data: Partial<InsertClient>): Client | undefined {
    return db.update(clients).set(data).where(eq(clients.id, id)).returning().get();
  }
  deleteClient(id: number): void {
    db.delete(clients).where(eq(clients.id, id)).run();
  }

  getJobs(filters?: { clientId?: number; assignedTo?: number; status?: string; jobType?: string; overdue?: boolean; completed?: boolean }): Job[] {
    const conditions: any[] = [];
    if (filters?.clientId) conditions.push(eq(jobs.clientId, filters.clientId));
    if (filters?.assignedTo) conditions.push(eq(jobs.assignedTo, filters.assignedTo));
    if (filters?.status) conditions.push(eq(jobs.status, filters.status));
    if (filters?.jobType) conditions.push(eq(jobs.jobType, filters.jobType));
    if (filters?.completed) {
      conditions.push(eq(jobs.status, "Done"));
    } else if (!filters?.status) {
      // Default: exclude completed
      conditions.push(sql`${jobs.status} != 'Done'`);
    }
    if (filters?.overdue) {
      const today = new Date().toISOString().split("T")[0];
      conditions.push(sql`${jobs.dueDate} < ${today} AND ${jobs.status} NOT IN ('Done','Sent to Client','Uploaded to Onehub')`);
    }
    const q = db.select().from(jobs);
    return conditions.length > 0 ? q.where(and(...conditions)).orderBy(asc(jobs.dueDate)).all() : q.orderBy(asc(jobs.dueDate)).all();
  }
  getJobById(id: number): Job | undefined {
    return db.select().from(jobs).where(eq(jobs.id, id)).get();
  }
  createJob(data: InsertJob): Job {
    return db.insert(jobs).values(data).returning().get();
  }
  updateJob(id: number, data: Partial<InsertJob>): Job | undefined {
    return db.update(jobs).set(data).where(eq(jobs.id, id)).returning().get();
  }
  deleteJob(id: number): void {
    db.delete(jobs).where(eq(jobs.id, id)).run();
  }

  getDashboardStats(assignedTo?: number) {
    const today = new Date().toISOString().split("T")[0];
    const weekOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const assignFilter = assignedTo ? `AND assigned_to = ${assignedTo}` : "";
    const activeJobs = (sqlite.prepare(`SELECT COUNT(*) as c FROM jobs WHERE status NOT IN ('Done','Sent to Client','Uploaded to Onehub') ${assignFilter}`).get() as any).c;
    const dueThisWeek = (sqlite.prepare(`SELECT COUNT(*) as c FROM jobs WHERE due_date >= '${today}' AND due_date <= '${weekOut}' AND status NOT IN ('Done','Sent to Client','Uploaded to Onehub') ${assignFilter}`).get() as any).c;
    const overdue = (sqlite.prepare(`SELECT COUNT(*) as c FROM jobs WHERE due_date < '${today}' AND status NOT IN ('Done','Sent to Client','Uploaded to Onehub') ${assignFilter}`).get() as any).c;
    const totalClients = (sqlite.prepare(`SELECT COUNT(*) as c FROM clients WHERE status = 'Active'`).get() as any).c;
    return { activeJobs, dueThisWeek, overdue, totalClients };
  }

  getActivity(limit = 25): Activity[] {
    return db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(limit).all();
  }
  logActivity(data: InsertActivity): Activity {
    return db.insert(activityLog).values(data).returning().get();
  }

  bulkInsertClients(data: InsertClient[]): void {
    for (let i = 0; i < data.length; i += 50) db.insert(clients).values(data.slice(i, i + 50)).run();
  }
  bulkInsertJobs(data: InsertJob[]): void {
    for (let i = 0; i < data.length; i += 50) db.insert(jobs).values(data.slice(i, i + 50)).run();
  }
}

export const storage = new Storage();
