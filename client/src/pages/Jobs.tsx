import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Search, Filter, Pencil, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertJobSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import type { Job, Client, User } from "@shared/schema";
import { format, isPast } from "date-fns";
import StatusBadge from "../components/StatusBadge";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";

const JOB_TYPES = ["SPCC Plan", "SWPPP", "Tank Inspection", "Tier II", "Stormwater Permit", "Other"];
const STATUSES = ["Not Started", "In Progress", "Done", "Sent to Client", "Uploaded to Onehub"];
const PRIORITIES = ["High", "Normal", "Low"];

const formSchema = insertJobSchema.extend({
  dueDate: z.string().optional(),
  clientId: z.coerce.number().min(1, "Client is required"),
});

export default function Jobs() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editJob, setEditJob] = useState<Job | null>(null);

  const { data: jobs, isLoading } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: users } = useQuery<User[]>({ queryKey: ["/api/users"] });

  const clientMap = new Map(clients?.map((c) => [c.id, c]) ?? []);
  const userMap = new Map(users?.map((u) => [u.id, u]) ?? []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "", jobType: "SPCC Plan", status: "Not Started", priority: "Normal",
      clientId: 0, description: "", dueDate: "", notes: "", assignedTo: undefined,
      createdAt: new Date().toISOString(),
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/jobs", { ...data, createdAt: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
      setDialogOpen(false);
      form.reset();
      toast({ title: "Job added" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/jobs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
      setDialogOpen(false);
      setEditJob(null);
      form.reset();
      toast({ title: "Job updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/jobs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Job deleted" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/jobs/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
    },
  });

  const openAdd = () => {
    setEditJob(null);
    form.reset({ title: "", jobType: "SPCC Plan", status: "Not Started", priority: "Normal", clientId: 0, description: "", dueDate: "", notes: "", assignedTo: undefined, createdAt: new Date().toISOString() });
    setDialogOpen(true);
  };

  const openEdit = (job: Job) => {
    setEditJob(job);
    form.reset({
      ...job,
      dueDate: job.dueDate ?? "",
      assignedTo: job.assignedTo ?? undefined,
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    if (editJob) {
      updateMutation.mutate({ id: editJob.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filtered = jobs?.filter((j) => {
    const client = clientMap.get(j.clientId);
    const matchSearch = !search ||
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      client?.company.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || j.status === filterStatus;
    const matchType = filterType === "all" || j.jobType === filterType;
    const matchAssignee = filterAssignee === "all" || String(j.assignedTo) === filterAssignee;
    return matchSearch && matchStatus && matchType && matchAssignee;
  }) ?? [];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Jobs</h1>
        <Button size="sm" onClick={openAdd} data-testid="button-add-job">
          <Plus className="w-4 h-4 mr-1" /> Add Job
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search jobs or clients..." className="pl-8 h-8 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-jobs" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-sm w-40" data-testid="select-filter-status">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 text-sm w-40" data-testid="select-filter-type">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {JOB_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="h-8 text-sm w-36" data-testid="select-filter-assignee">
            <SelectValue placeholder="All Staff" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Staff</SelectItem>
            {users?.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs">
                  <th className="text-left px-4 py-2.5 font-medium">Job</th>
                  <th className="text-left px-4 py-2.5 font-medium">Client</th>
                  <th className="text-left px-4 py-2.5 font-medium">Type</th>
                  <th className="text-left px-4 py-2.5 font-medium">Due Date</th>
                  <th className="text-left px-4 py-2.5 font-medium">Assigned</th>
                  <th className="text-left px-4 py-2.5 font-medium">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td></tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No jobs found</td></tr>
                ) : filtered.map((job) => {
                  const client = clientMap.get(job.clientId);
                  const assignee = job.assignedTo ? userMap.get(job.assignedTo) : null;
                  const due = job.dueDate ? new Date(job.dueDate) : null;
                  const isOverdue = due ? isPast(due) && !["Done","Sent to Client","Uploaded to Onehub"].includes(job.status) : false;
                  const currentStatusIdx = STATUSES.indexOf(job.status);

                  return (
                    <tr key={job.id} className="hover:bg-secondary/30 transition-colors" data-testid={`job-row-${job.id}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{job.title}</div>
                        {job.priority === "High" && <span className="text-[10px] text-red-400">High Priority</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{client?.company ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px]">{job.jobType}</Badge>
                      </td>
                      <td className={`px-4 py-3 text-xs font-medium ${isOverdue ? "text-red-400" : "text-foreground"}`}>
                        {due ? format(due, "MMM d, yyyy") : "—"}
                        {isOverdue && <div className="text-[10px] text-red-400">OVERDUE</div>}
                      </td>
                      <td className="px-4 py-3">
                        {assignee ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-background" style={{ background: assignee.color }}>
                              {assignee.name[0]}
                            </div>
                            <span className="text-xs text-muted-foreground">{assignee.name}</span>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Select value={job.status} onValueChange={(s) => statusMutation.mutate({ id: job.id, status: s })}>
                          <SelectTrigger className="h-7 border-0 bg-transparent p-0 shadow-none focus:ring-0 w-auto gap-1" data-testid={`select-status-${job.id}`}>
                            <StatusBadge status={job.status} />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(job)} data-testid={`button-edit-${job.id}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(job.id)} data-testid={`button-delete-${job.id}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editJob ? "Edit Job" : "Add New Job"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField control={form.control} name="clientId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value ? String(field.value) : ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-client"><SelectValue placeholder="Select client..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-60">
                      {clients?.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.company}{c.subLocation ? ` – ${c.subLocation}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Title</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. Annual SPCC Review" data-testid="input-job-title" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="jobType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-job-type"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{JOB_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="dueDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-due-date" /></FormControl>
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="assignedTo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign To</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === "none" ? undefined : parseInt(v))} value={field.value ? String(field.value) : "none"}>
                      <FormControl><SelectTrigger data-testid="select-assignee"><SelectValue placeholder="Unassigned" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {users?.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-priority"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea {...field} value={field.value ?? ""} rows={2} placeholder="Any additional notes..." data-testid="textarea-notes" /></FormControl>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-job">
                  {editJob ? "Save Changes" : "Add Job"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
