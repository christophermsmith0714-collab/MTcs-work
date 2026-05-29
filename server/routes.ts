import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertClientSchema, insertJobSchema } from "@shared/schema";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

export async function runStartupSeed() {
  try {
    // Always ensure admin account exists
    const admin = storage.getUserByEmail("chris@mtcs.com");
    if (!admin) {
      const hash = await bcrypt.hash("mtcs2024", 10);
      storage.createUser({ name: "Chris", email: "chris@mtcs.com", passwordHash: hash, role: "admin", color: "#4F98A3" });
      console.log("[seed] Admin account created");
    }
    // Seed clients + jobs if empty
    const existing = storage.getClients();
    if (existing.length === 0) {
      const clientsPath = path.join(process.cwd(), "seed_clients.json");
      const jobsPath = path.join(process.cwd(), "seed_jobs.json");
      if (fs.existsSync(clientsPath)) storage.bulkInsertClients(JSON.parse(fs.readFileSync(clientsPath, "utf-8")));
      if (fs.existsSync(jobsPath)) storage.bulkInsertJobs(JSON.parse(fs.readFileSync(jobsPath, "utf-8")));
      console.log("[seed] Clients and jobs seeded");
    }
  } catch (err) {
    console.error("[seed] Startup seed failed:", err);
  }
}

function randomToken() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function getSession(req: Request) {
  const token = req.headers["x-session-token"] as string;
  if (!token) return null;
  return storage.getSession(token);
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  (req as any).session = session;
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  if (session.role !== "admin") return res.status(403).json({ error: "Admin only" });
  (req as any).session = session;
  next();
}

export function registerRoutes(httpServer: Server, app: Express): Server {

  // ── Auth ─────────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    const user = storage.getUserByEmail(email);
    if (!user) return res.status(401).json({ error: "Invalid email or password" });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });
    const token = randomToken();
    storage.createSession(token, user.id, user.role, user.name);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, color: user.color } });
  });

  app.post("/api/auth/logout", (req, res) => {
    const token = req.headers["x-session-token"] as string;
    if (token) storage.deleteSession(token);
    res.json({ success: true });
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    const session = (req as any).session;
    const user = storage.getUserById(session.userId);
    if (!user) return res.status(401).json({ error: "User not found" });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, color: user.color });
  });

  // ── Seed ─────────────────────────────────────────────────────────────
  app.post("/api/seed", async (_req, res) => {
    try {
      const existing = storage.getClients();
      if (existing.length > 0) return res.json({ message: "Already seeded", clients: existing.length });

      const clientsPath = path.join(process.cwd(), "seed_clients.json");
      const jobsPath = path.join(process.cwd(), "seed_jobs.json");
      if (fs.existsSync(clientsPath)) storage.bulkInsertClients(JSON.parse(fs.readFileSync(clientsPath, "utf-8")));
      if (fs.existsSync(jobsPath)) storage.bulkInsertJobs(JSON.parse(fs.readFileSync(jobsPath, "utf-8")));

      // Create default admin account
      if (storage.getUsers().length === 0) {
        const hash = await bcrypt.hash("mtcs2024", 10);
        storage.createUser({ name: "Chris", email: "chris@mtcs.com", passwordHash: hash, role: "admin", color: "#4F98A3" });
      }
      res.json({ message: "Seeded" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Users ─────────────────────────────────────────────────────────────
  app.get("/api/users", requireAuth, (_req, res) => {
    // Return users without passwordHash
    const u = storage.getUsers().map(({ passwordHash, ...rest }) => rest);
    res.json(u);
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    const { password, ...rest } = req.body;
    if (!password) return res.status(400).json({ error: "Password required" });
    // Check for duplicate email
    const existing = storage.getUserByEmail(rest.email);
    if (existing) return res.status(400).json({ error: "A user with that email already exists" });
    const hash = await bcrypt.hash(password, 10);
    const parsed = insertUserSchema.safeParse({ ...rest, passwordHash: hash });
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const { passwordHash, ...user } = storage.createUser(parsed.data);
    res.json(user);
  });

  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const session = (req as any).session;
    const { password, passwordHash: _ignored, ...rest } = req.body;
    // Only allow safe fields to be updated
    const updates: any = {
      name: rest.name,
      email: rest.email,
      role: rest.role,
      color: rest.color,
    };
    // Only hash+update password if a new one was provided
    if (password && password.trim() !== "") {
      updates.passwordHash = await bcrypt.hash(password, 10);
    }
    const updated = storage.updateUser(id, updates);
    if (!updated) return res.status(404).json({ error: "User not found" });
    const { passwordHash, ...user } = updated;
    res.json(user);
  });

  app.delete("/api/users/:id", requireAdmin, (req, res) => {
    const id = parseInt(req.params.id);
    const session = (req as any).session;
    // Prevent admin from deleting themselves
    if (id === session.userId) return res.status(400).json({ error: "You cannot delete your own account" });
    storage.deleteUser(id);
    res.json({ success: true });
  });

  // ── Clients ───────────────────────────────────────────────────────────
  app.get("/api/clients", requireAuth, (req, res) => {
    const { search, status, category } = req.query as Record<string, string>;
    res.json(storage.getClients(search, status, category));
  });

  app.get("/api/clients/:id", requireAuth, (req, res) => {
    const client = storage.getClientById(parseInt(req.params.id));
    if (!client) return res.status(404).json({ error: "Not found" });
    res.json(client);
  });

  app.post("/api/clients", requireAuth, (req, res) => {
    const parsed = insertClientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const client = storage.createClient(parsed.data);
    storage.logActivity({ clientId: client.id, action: "created", detail: `Client "${client.company}" added`, createdAt: new Date().toISOString() });
    res.json(client);
  });

  app.patch("/api/clients/:id", requireAuth, (req, res) => {
    const updated = storage.updateClient(parseInt(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.delete("/api/clients/:id", requireAdmin, (req, res) => {
    storage.deleteClient(parseInt(req.params.id));
    res.json({ success: true });
  });

  // ── Jobs ──────────────────────────────────────────────────────────────
  app.get("/api/jobs", requireAuth, (req, res) => {
    const session = (req as any).session;
    const { clientId, assignedTo, status, jobType, overdue, completed } = req.query as Record<string, string>;

    // Staff only see their own assigned jobs
    let effectiveAssignedTo = assignedTo ? parseInt(assignedTo) : undefined;
    if (session.role === "staff") effectiveAssignedTo = session.userId;

    res.json(storage.getJobs({
      clientId: clientId ? parseInt(clientId) : undefined,
      assignedTo: effectiveAssignedTo,
      status: status || undefined,
      jobType: jobType || undefined,
      overdue: overdue === "true",
      completed: completed === "true",
    }));
  });

  app.get("/api/jobs/:id", requireAuth, (req, res) => {
    const job = storage.getJobById(parseInt(req.params.id));
    if (!job) return res.status(404).json({ error: "Not found" });
    res.json(job);
  });

  app.post("/api/jobs", requireAuth, (req, res) => {
    const session = (req as any).session;
    const data = { ...req.body, createdAt: new Date().toISOString(), createdBy: session.userId };
    const parsed = insertJobSchema.safeParse(data);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const job = storage.createJob(parsed.data);
    storage.logActivity({ jobId: job.id, clientId: job.clientId, userId: session.userId, action: "created", detail: `Job "${job.title}" created by ${session.name}`, createdAt: new Date().toISOString() });
    res.json(job);
  });

  app.patch("/api/jobs/:id", requireAuth, (req, res) => {
    const session = (req as any).session;
    const id = parseInt(req.params.id);
    const existing = storage.getJobById(id);
    if (!existing) return res.status(404).json({ error: "Not found" });

    // Staff can only update their own assigned jobs
    if (session.role === "staff" && existing.assignedTo !== session.userId) {
      return res.status(403).json({ error: "Not your job" });
    }

    const now = new Date().toISOString();
    const updates: any = { ...req.body };
    if (updates.status && updates.status !== existing.status) {
      if (updates.status === "Completed") updates.completedAt = now;
      if (updates.status === "Sent to Client") updates.sentAt = now;
      if (updates.status === "Uploaded to Onehub") updates.uploadedAt = now;
      storage.logActivity({ jobId: id, clientId: existing.clientId, userId: session.userId, action: "status_change", detail: `"${existing.title}" → ${updates.status} (by ${session.name})`, createdAt: now });
    }

    const updated = storage.updateJob(id, updates);
    res.json(updated);
  });

  // Reopen a completed job (moves it back to Upcoming, clears billing data)
  app.post("/api/jobs/:id/reopen", requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    const existing = storage.getJobById(id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    const updated = storage.updateJob(id, {
      status: "Upcoming",
      completedAt: null,
      hoursSpent: null,
      milesDriven: null,
    } as any);
    res.json(updated);
  });

  app.delete("/api/jobs/:id", requireAdmin, (req, res) => {
    storage.deleteJob(parseInt(req.params.id));
    res.json({ success: true });
  });

  // ── Dashboard stats ───────────────────────────────────────────────────
  app.get("/api/dashboard/stats", requireAuth, (req, res) => {
    const session = (req as any).session;
    const assignedTo = session.role === "staff" ? session.userId : undefined;
    res.json(storage.getDashboardStats(assignedTo));
  });

  // ── Activity ──────────────────────────────────────────────────────────
  app.get("/api/activity", requireAuth, (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 25;
    res.json(storage.getActivity(limit));
  });

  return httpServer;
}
