import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Briefcase, AlertTriangle, Clock, Users, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Job, Client, User } from "@shared/schema";
import { format, isPast, isWithinInterval, addDays } from "date-fns";

const STATUSES = ["Not Started", "In Progress", "Done", "Sent to Client", "Uploaded to Onehub"];

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

function getJobStatusPill(job: Job) {
  const today = new Date();
  const due = job.dueDate ? new Date(job.dueDate) : null;
  if (!due) return { label: job.status, cls: "status-not-started" };
  if (isPast(due) && !["Done","Sent to Client","Uploaded to Onehub"].includes(job.status)) return { label: "Overdue", cls: "status-overdue" };
  if (isWithinInterval(due, { start: today, end: addDays(today, 30) })) return { label: "Due Soon", cls: "status-due-soon" };
  return { label: "On Track", cls: "status-on-track" };
}

function JobTable({ jobs, clientMap, userMap, showAssigned, statusMutation, isAdmin }: {
  jobs: Job[]; clientMap: Map<number, Client>; userMap: Map<number, User>;
  showAssigned: boolean; statusMutation: any; isAdmin: boolean;
}) {
  const typeLabel = (jobType: string) => {
    if (jobType.includes("SPCC")) return <span className="text-primary text-[10px] font-semibold">SPCC</span>;
    if (jobType.includes("Storm") || jobType.includes("SWPPP")) return <span className="text-blue-400 text-[10px] font-semibold">SW</span>;
    return <span className="text-muted-foreground text-[10px] font-semibold">{jobType.slice(0, 3).toUpperCase()}</span>;
  };

  if (jobs.length === 0) {
    return <div className="p-10 text-center text-muted-foreground text-sm">No jobs to show here.</div>;
  }

  return (
    <div className="divide-y divide-border">
      {jobs.map((job) => {
        const client = clientMap.get(job.clientId);
        const due = job.dueDate ? new Date(job.dueDate) : null;
        const isOverdue = due ? isPast(due) && !["Done","Sent to Client","Uploaded to Onehub"].includes(job.status) : false;
        const pill = getJobStatusPill(job);
        const assignee = job.assignedTo ? userMap.get(job.assignedTo) : null;

        return (
          <div key={job.id} className={`grid gap-2 items-center px-5 py-3 hover:bg-secondary/30 transition-colors ${showAssigned ? "grid-cols-[2.5fr_1.5fr_1fr_1fr_1fr_1fr]" : "grid-cols-[2.5fr_1.5fr_1fr_1fr_1fr]"}`} data-testid={`job-row-${job.id}`}>
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
              {isAdmin ? (
                <Select value={job.status} onValueChange={(s) => statusMutation.mutate({ id: job.id, status: s })}>
                  <SelectTrigger className="h-auto border-0 bg-transparent p-0 shadow-none focus:ring-0 w-auto" data-testid={`select-status-${job.id}`}>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${pill.cls}`}>{pill.label}</span>
                  </SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Select value={job.status} onValueChange={(s) => statusMutation.mutate({ id: job.id, status: s })}>
                  <SelectTrigger className="h-auto border-0 bg-transparent p-0 shadow-none focus:ring-0 w-auto" data-testid={`select-status-${job.id}`}>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${pill.cls}`}>{pill.label}</span>
                  </SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              )}
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

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";

  const { data: stats, isLoading: statsLoading } = useQuery<{ activeJobs: number; dueThisWeek: number; overdue: number; totalClients: number }>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: completedJobs, isLoading: completedLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs?completed=true"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/jobs?completed=true");
      return res.json();
    },
    enabled: isAdmin,
  });
  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: users } = useQuery<User[]>({ queryKey: ["/api/users"] });

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/seed"),
    onSuccess: () => { queryClient.invalidateQueries(); toast({ title: "Data loaded" }); },
  });

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

  const urgentJobs = jobs
    ?.filter((j) => !["Done","Sent to Client","Uploaded to Onehub"].includes(j.status) && j.dueDate)
    .filter((j) => {
      const due = new Date(j.dueDate!);
      return isPast(due) || isWithinInterval(due, { start: today, end: addDays(today, 60) });
    })
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 15) ?? [];

  const tableHeaders = (showAssigned: boolean) => (
    <div className={`grid gap-2 px-5 py-2 border-b border-border text-[11px] text-muted-foreground font-medium uppercase tracking-wide ${showAssigned ? "grid-cols-[2.5fr_1.5fr_1fr_1fr_1fr_1fr]" : "grid-cols-[2.5fr_1.5fr_1fr_1fr_1fr]"}`}>
      <span>Job Name</span>
      <span>Client</span>
      <span>Due Date</span>
      <span>Type</span>
      <span>Status</span>
      {showAssigned && <span>Assigned</span>}
    </div>
  );

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
          <Button size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} data-testid="button-load-data">
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
          <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4" data-testid={`stat-${label}`}>
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

      {/* Upcoming Jobs table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Upcoming Job Deadlines</span>
          </div>
          <a href="#/jobs" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
            View All Jobs <ArrowRight className="w-3 h-3" />
          </a>
        </div>
        {tableHeaders(isAdmin)}
        {jobsLoading ? (
          <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <JobTable jobs={urgentJobs} clientMap={clientMap} userMap={userMap} showAssigned={isAdmin} statusMutation={statusMutation} isAdmin={isAdmin} />
        )}
      </div>

      {/* Admin only: Completed Jobs tab */}
      {isAdmin && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-sm font-semibold">Completed Jobs</span>
              {completedJobs && (
                <span className="text-xs bg-green-500/15 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full font-medium">
                  {completedJobs.length} done
                </span>
              )}
            </div>
            <a href="#/jobs" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
              View All Jobs <ArrowRight className="w-3 h-3" />
            </a>
          </div>
          {tableHeaders(true)}
          {completedLoading ? (
            <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <JobTable jobs={completedJobs ?? []} clientMap={clientMap} userMap={userMap} showAssigned={true} statusMutation={statusMutation} isAdmin={true} />
          )}
        </div>
      )}
    </div>
  );
}
