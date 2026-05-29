import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Briefcase, AlertTriangle, Clock, Users, CheckCircle2, CalendarClock, ArrowRight, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Job, Client, User } from "@shared/schema";
import { format, isPast } from "date-fns";

export const STATUSES = ["Upcoming", "Scheduled", "Pending Response", "Completed"];

function Sparkline({ color, up }: { color: string; up: boolean }) {
  const points = up ? "0,20 8,16 16,14 24,10 32,8 40,5 48,3" : "0,5 8,8 16,7 24,12 32,14 40,16 48,18";
  return (
    <svg width="48" height="24" viewBox="0 0 48 24" fill="none">
      <polyline points={points} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
    </svg>
  );
}

function KpiIcon({ icon: Icon, glowClass, bgClass, iconClass }: { icon: any; glowClass: string; bgClass: string; iconClass: string }) {
  return (
    <div className={`w-14 h-14 rounded-full flex items-center justify-center ${bgClass} ${glowClass} shrink-0`}>
      <Icon className={`w-6 h-6 ${iconClass}`} strokeWidth={1.5} />
    </div>
  );
}

function statusPill(status: string) {
  switch (status) {
    case "Upcoming":      return "status-overdue";
    case "Scheduled":     return "status-on-track";
    case "Pending Response": return "status-due-soon";
    case "Completed":     return "status-not-started";
    default:              return "status-not-started";
  }
}

function JobTable({ jobs, clientMap, userMap, statusMutation, isAdmin, showAssigned, onComplete }: {
  jobs: Job[]; clientMap: Map<number, Client>; userMap: Map<number, User>;
  statusMutation: any; isAdmin: boolean; showAssigned: boolean;
  onComplete?: (job: Job) => void;
}) {
  const typeLabel = (jobType: string) => {
    if (jobType.includes("SPCC")) return <span className="text-primary text-[10px] font-semibold">SPCC</span>;
    if (jobType.includes("Storm") || jobType.includes("SWPPP")) return <span className="text-blue-400 text-[10px] font-semibold">SW</span>;
    return <span className="text-muted-foreground text-[10px] font-semibold">{jobType.slice(0, 3).toUpperCase()}</span>;
  };

  if (jobs.length === 0) {
    return <div className="p-8 text-center text-muted-foreground text-sm">No jobs here.</div>;
  }

  const cols = showAssigned
    ? "grid-cols-[2.5fr_1.5fr_1fr_1fr_1fr_1fr]"
    : "grid-cols-[2.5fr_1.5fr_1fr_1fr_1fr]";

  return (
    <div className="divide-y divide-border">
      {jobs.map((job) => {
        const client = clientMap.get(job.clientId);
        const due = job.dueDate ? new Date(job.dueDate) : null;
        const isOverdue = due ? isPast(due) && job.status !== "Completed" : false;
        const assignee = job.assignedTo ? userMap.get(job.assignedTo) : null;

        return (
          <div key={job.id} className={`grid gap-2 items-center px-5 py-3 hover:bg-secondary/30 transition-colors ${cols}`}>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded border border-border bg-secondary flex items-center justify-center shrink-0">
                <Briefcase className="w-3 h-3 text-muted-foreground" />
              </div>
              <span className="text-sm text-foreground truncate">{job.title}</span>
            </div>
            <span className="text-sm text-muted-foreground truncate">{client?.company ?? "—"}</span>
            <span className={`text-xs font-medium ${isOverdue ? "text-red-400" : "text-foreground"}`}>
              {due ? format(due, "MMM d, yyyy") : "—"}
            </span>
            <div>{typeLabel(job.jobType)}</div>
            <div>
              <Select
                value={job.status}
                onValueChange={(s) => {
                  if (s === "Completed" && onComplete) {
                    onComplete(job);
                  } else {
                    statusMutation.mutate({ id: job.id, status: s });
                  }
                }}
              >
                <SelectTrigger className="h-auto border-0 bg-transparent p-0 shadow-none focus:ring-0 w-auto" data-testid={`select-status-${job.id}`}>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusPill(job.status)}`}>
                    {job.status}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {showAssigned && (
              <div>
                {assignee ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-background shrink-0" style={{ background: assignee.color }}>
                      {assignee.name[0]}
                    </div>
                    <span className="text-xs text-muted-foreground truncate">{assignee.name}</span>
                  </div>
                ) : <span className="text-xs text-muted-foreground/40 italic">—</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TableHeader({ showAssigned }: { showAssigned: boolean }) {
  const cols = showAssigned
    ? "grid-cols-[2.5fr_1.5fr_1fr_1fr_1fr_1fr]"
    : "grid-cols-[2.5fr_1.5fr_1fr_1fr_1fr]";
  return (
    <div className={`grid gap-2 px-5 py-2 border-b border-border text-[11px] text-muted-foreground font-medium uppercase tracking-wide ${cols}`}>
      <span>Job Name</span>
      <span>Client</span>
      <span>Due Date</span>
      <span>Type</span>
      <span>Status</span>
      {showAssigned && <span>Assigned</span>}
    </div>
  );
}

interface Section {
  label: string;
  icon: any;
  iconColor: string;
  status: string;
  jobs: Job[];
  badge?: string;
  badgeClass?: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";

  // Completion dialog state
  const [completeDialog, setCompleteDialog] = useState<{ job: Job; renewDate: string } | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery<{ activeJobs: number; dueThisWeek: number; overdue: number; totalClients: number }>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: completedJobsData, isLoading: completedLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs?completed=true"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/jobs?completed=true");
      return res.json();
    },
  });
  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: users } = useQuery<User[]>({ queryKey: ["/api/users"] });

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/seed"),
    onSuccess: () => { queryClient.invalidateQueries(); toast({ title: "Data loaded" }); },
  });

  const completeMutation = useMutation({
    mutationFn: async ({ job, renewDate }: { job: Job; renewDate: string }) => {
      // Mark current job as Completed
      await apiRequest("PATCH", `/api/jobs/${job.id}`, { status: "Completed" });
      // Create renewal job with new date
      await apiRequest("POST", "/api/jobs", {
        clientId: job.clientId,
        jobType: job.jobType,
        title: job.title,
        description: job.description,
        dueDate: renewDate,
        assignedTo: job.assignedTo,
        priority: job.priority,
        notes: job.notes,
        status: "Upcoming",
        createdAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs?completed=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setCompleteDialog(null);
      toast({ title: "Job completed", description: "A new renewal job has been created." });
    },
  });

  const handleComplete = (job: Job) => {
    setCompleteDialog({ job, renewDate: "" });
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => apiRequest("PATCH", `/api/jobs/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs?completed=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
  });

  const clientMap = new Map(clients?.map((c) => [c.id, c]) ?? []);
  const userMap = new Map(users?.map((u) => [u.id, u]) ?? []);
  const today = new Date();

  // Split jobs into 4 buckets by status
  const allJobs = jobs?.filter((j) => j.dueDate) ?? [];

  const upcomingJobs = allJobs
    .filter((j) => j.status === "Upcoming")
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

  const scheduledJobs = allJobs
    .filter((j) => j.status === "Scheduled")
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

  const pendingJobs = allJobs
    .filter((j) => j.status === "Pending Response")
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

  const completedJobs = completedJobsData ?? [];

  const sections: Section[] = [
    {
      label: "Upcoming Jobs",
      icon: AlertTriangle,
      iconColor: "text-red-400",
      status: "Upcoming",
      jobs: upcomingJobs,
      badge: upcomingJobs.length > 0 ? `${upcomingJobs.length}` : undefined,
      badgeClass: "bg-red-500/15 text-red-400 border border-red-500/20",
    },
    {
      label: "Scheduled Jobs",
      icon: CalendarClock,
      iconColor: "text-primary",
      status: "Scheduled",
      jobs: scheduledJobs,
      badge: scheduledJobs.length > 0 ? `${scheduledJobs.length}` : undefined,
      badgeClass: "bg-primary/15 text-primary border border-primary/20",
    },
    {
      label: "Pending Response",
      icon: Send,
      iconColor: "text-orange-400",
      status: "Pending Response",
      jobs: pendingJobs,
      badge: pendingJobs.length > 0 ? `${pendingJobs.length}` : undefined,
      badgeClass: "bg-orange-500/15 text-orange-400 border border-orange-500/20",
    },
    {
      label: "Completed Jobs",
      icon: CheckCircle2,
      iconColor: "text-green-400",
      status: "Completed",
      jobs: completedJobs,
      badge: completedJobs.length > 0 ? `${completedJobs.length} done` : "0 done",
      badgeClass: "bg-green-500/15 text-green-400 border border-green-500/20",
    },
  ];

  return (
    <div className="p-5 space-y-5 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {isAdmin ? "Admin Dashboard" : `My Jobs — ${user?.name}`}
          </h1>
          <p className="text-xs text-muted-foreground">{format(today, "EEEE, MMMM d, yyyy")}</p>
        </div>
        {(!jobs || jobs.length === 0) && isAdmin && (
          <Button size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
            {seedMutation.isPending ? "Loading..." : "Load Client Data"}
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: isAdmin ? "Active Jobs" : "My Active Jobs", value: stats?.activeJobs, icon: Briefcase, glowClass: "icon-glow-teal", bgClass: "bg-primary/10 border border-primary/20", iconClass: "text-primary", valueClass: "text-foreground", sparkUp: true, sparkColor: "#3BADA0" },
          { label: "Due This Week", value: stats?.dueThisWeek, icon: Clock, glowClass: "icon-glow-orange", bgClass: "bg-orange-500/10 border border-orange-500/20", iconClass: "text-orange-400", valueClass: "text-orange-400", sparkUp: false, sparkColor: "#F59E0B" },
          { label: "Overdue", value: stats?.overdue, icon: AlertTriangle, glowClass: "icon-glow-red", bgClass: "bg-red-500/10 border border-red-500/20", iconClass: "text-red-400", valueClass: "text-red-400", sparkUp: false, sparkColor: "#EF4444" },
          { label: isAdmin ? "Active Clients" : "Total Clients", value: stats?.totalClients, icon: Users, glowClass: "icon-glow-teal", bgClass: "bg-primary/10 border border-primary/20", iconClass: "text-primary", valueClass: "text-foreground", sparkUp: true, sparkColor: "#3BADA0" },
        ].map(({ label, value, icon, glowClass, bgClass, iconClass, valueClass, sparkUp, sparkColor }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
            <KpiIcon icon={icon} glowClass={glowClass} bgClass={bgClass} iconClass={iconClass} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
              {statsLoading ? <Skeleton className="h-8 w-16" /> : (
                <p className={`text-4xl font-bold leading-none ${valueClass}`}>{value ?? 0}</p>
              )}
            </div>
            <Sparkline color={sparkColor} up={sparkUp} />
          </div>
        ))}
      </div>

      {/* 4 Job Tables */}
      {jobsLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      ) : (
        sections.map((section) => (
          <div key={section.status} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <div className="flex items-center gap-2">
                <section.icon className={`w-4 h-4 ${section.iconColor}`} />
                <span className="text-sm font-semibold">{section.label}</span>
                {section.badge && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${section.badgeClass}`}>
                    {section.badge}
                  </span>
                )}
              </div>
              <a href="#/jobs" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                View All Jobs <ArrowRight className="w-3 h-3" />
              </a>
            </div>
            <TableHeader showAssigned={isAdmin} />
            <JobTable
              jobs={section.jobs}
              clientMap={clientMap}
              userMap={userMap}
              statusMutation={statusMutation}
              isAdmin={isAdmin}
              showAssigned={isAdmin}
              onComplete={section.status !== "Completed" ? handleComplete : undefined}
            />
          </div>
        ))
      )}

      {/* Complete Job Dialog */}
      <Dialog open={!!completeDialog} onOpenChange={(open) => { if (!open) setCompleteDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark Job Complete</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Job</p>
              <p className="text-sm font-medium text-foreground">{completeDialog?.job.title}</p>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">Next Due Date for Renewal Job</label>
              <Input
                type="date"
                value={completeDialog?.renewDate ?? ""}
                onChange={(e) => setCompleteDialog((d) => d ? { ...d, renewDate: e.target.value } : null)}
              />
              <p className="text-xs text-muted-foreground mt-1">A new job will be created with this date in Upcoming.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialog(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!completeDialog?.renewDate) return;
                completeMutation.mutate({ job: completeDialog.job, renewDate: completeDialog.renewDate });
              }}
              disabled={!completeDialog?.renewDate || completeMutation.isPending}
            >
              {completeMutation.isPending ? "Saving..." : "Mark Complete & Schedule Renewal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
