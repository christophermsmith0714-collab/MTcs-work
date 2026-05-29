import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Pencil, Trash2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import type { User, Job } from "@shared/schema";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import StatusBadge from "../components/StatusBadge";
import { format } from "date-fns";

// Custom form schema — password sent to server, server hashes it
const teamFormSchema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email("Valid email required"),
  password: z.string().optional(),
  role: z.enum(["admin", "staff"]),
  color: z.string(),
});
type TeamFormValues = z.infer<typeof teamFormSchema>;

const COLORS = ["#4F98A3", "#E8AF34", "#DD6974", "#6DAA45", "#A86FDF", "#BB653B", "#5591C7", "#FDAB43"];

export default function Team() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  const { data: users, isLoading } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: jobs } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });

  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: { name: "", email: "", password: "", role: "staff", color: COLORS[0] },
  });

  const createMutation = useMutation({
    mutationFn: (data: TeamFormValues) => apiRequest("POST", "/api/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setDialogOpen(false);
      form.reset();
      toast({ title: "Team member added" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TeamFormValues }) => apiRequest("PATCH", `/api/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setDialogOpen(false);
      setEditUser(null);
      form.reset();
      toast({ title: "Team member updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Team member removed" });
    },
  });

  const openAdd = () => {
    setEditUser(null);
    form.reset({ name: "", email: "", password: "", role: "staff", color: COLORS[0] });
    setDialogOpen(true);
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    form.reset({ name: user.name, email: user.email, password: "", role: user.role as "admin" | "staff", color: user.color });
    setDialogOpen(true);
  };

  const onSubmit = (data: TeamFormValues) => {
    if (editUser) {
      updateMutation.mutate({ id: editUser.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getJobsForUser = (userId: number) =>
    jobs?.filter((j) => j.assignedTo === userId && !["Done", "Sent to Client", "Uploaded to Onehub"].includes(j.status)) ?? [];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Team</h1>
        <Button size="sm" onClick={openAdd} data-testid="button-add-user">
          <Plus className="w-4 h-4 mr-1" /> Add Team Member
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : !users || users.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">No team members yet. Add your first team member.</div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {users.map((user) => {
            const activeJobs = getJobsForUser(user.id);
            return (
              <Card key={user.id} data-testid={`user-card-${user.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                        style={{ background: user.color }}
                      >
                        {user.name[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                        <div className="text-[10px] text-muted-foreground capitalize mt-0.5">{user.role}</div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(user)} data-testid={`button-edit-user-${user.id}`}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(user.id)} data-testid={`button-delete-user-${user.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="border-t border-border pt-3">
                    <div className="text-xs text-muted-foreground mb-2">Open Jobs ({activeJobs.length})</div>
                    {activeJobs.length === 0 ? (
                      <div className="text-[11px] text-muted-foreground italic">No open jobs</div>
                    ) : (
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {activeJobs.slice(0, 5).map((job) => (
                          <div key={job.id} className="flex items-center justify-between gap-2" data-testid={`user-job-${job.id}`}>
                            <span className="text-xs text-foreground truncate">{job.title}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {job.dueDate && <span className="text-[10px] text-muted-foreground">{format(new Date(job.dueDate), "MMM d")}</span>}
                              <StatusBadge status={job.status} />
                            </div>
                          </div>
                        ))}
                        {activeJobs.length > 5 && (
                          <div className="text-[10px] text-muted-foreground">+{activeJobs.length - 5} more</div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editUser ? "Edit Team Member" : "Add Team Member"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} data-testid="input-user-name" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" data-testid="input-user-email" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    <KeyRound className="w-3 h-3" />
                    {editUser ? "New Password (leave blank to keep current)" : "Password"}
                  </FormLabel>
                  <FormControl><Input {...field} type="password" placeholder={editUser ? "••••••••" : "Set login password"} data-testid="input-user-password" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem><FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-user-role"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="color" render={({ field }) => (
                <FormItem>
                  <FormLabel>Avatar Color</FormLabel>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => field.onChange(c)}
                        className={`w-7 h-7 rounded-full transition-transform ${field.value === c ? "ring-2 ring-white scale-110" : ""}`}
                        style={{ background: c }}
                        data-testid={`color-option-${c}`}
                      />
                    ))}
                  </div>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-user">
                  {editUser ? "Save" : "Add"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
