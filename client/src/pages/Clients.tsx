import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Search, Phone, Mail, Globe, MapPin, Pencil, Trash2, ChevronDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertClientSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { z } from "zod";

const CATEGORIES = ["Construction", "Equipment Dealer", "Government", "Gov Landfill", "Landfill", "Manufacturing", "MSHA Mine/Quarry", "Ready Mix", "Other"];
const STATUSES = ["Active", "Inactive", "Secondary"];

export default function Clients() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients", search, filterStatus === "all" ? "" : filterStatus, filterCategory === "all" ? "" : filterCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterCategory !== "all") params.set("category", filterCategory);
      const res = await apiRequest("GET", `/api/clients?${params}`);
      return res.json();
    },
  });

  const form = useForm<z.infer<typeof insertClientSchema>>({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      company: "", status: "Active", category: "", subLocation: "", parentCompany: "",
      address1: "", city: "", state: "", contactName: "", contactPhone: "", contactEmail: "", website: "", notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/clients", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setDialogOpen(false);
      form.reset();
      toast({ title: "Client added" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/clients/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setDialogOpen(false);
      setEditClient(null);
      form.reset();
      toast({ title: "Client updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Client removed" });
    },
  });

  const openAdd = () => {
    setEditClient(null);
    form.reset({ company: "", status: "Active", category: "" });
    setDialogOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditClient(client);
    form.reset({ ...client });
    setDialogOpen(true);
  };

  const onSubmit = (data: z.infer<typeof insertClientSchema>) => {
    if (editClient) {
      updateMutation.mutate({ id: editClient.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const statusColor: Record<string, string> = {
    Active: "bg-green-500/15 text-green-400 border-green-500/20",
    Inactive: "bg-red-500/15 text-red-400 border-red-500/20",
    Secondary: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Clients</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{clients?.length ?? 0} clients</p>
        </div>
        <Button size="sm" onClick={openAdd} data-testid="button-add-client">
          <Plus className="w-4 h-4 mr-1" /> Add Client
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search by company, city, contact..." className="pl-8 h-8 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-clients" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-sm w-36" data-testid="select-filter-status">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="h-8 text-sm w-44" data-testid="select-filter-category">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Client List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !clients || clients.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">
              No clients found. Add a client or adjust filters.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {clients.map((client) => {
                const isExpanded = expandedId === client.id;
                return (
                  <div key={client.id} data-testid={`client-row-${client.id}`}>
                    <div
                      className="px-4 py-3 flex items-center gap-3 hover:bg-secondary/30 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : client.id)}
                    >
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground text-sm">{client.company}</span>
                          {client.subLocation && <span className="text-xs text-muted-foreground">– {client.subLocation}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {client.category && <span className="text-[10px] text-muted-foreground">{client.category}</span>}
                          {client.city && <span className="text-[10px] text-muted-foreground">· {client.city}, {client.state}</span>}
                          {client.parentCompany && <span className="text-[10px] text-muted-foreground">· Parent: {client.parentCompany}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {client.contactEmail && (
                          <a href={`mailto:${client.contactEmail}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:text-primary/80">
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {client.contactPhone && (
                          <a href={`tel:${client.contactPhone}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:text-primary/80">
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${statusColor[client.status] ?? ""}`}>
                          {client.status}
                        </span>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); openEdit(client); }} data-testid={`button-edit-client-${client.id}`}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(client.id); }} data-testid={`button-delete-client-${client.id}`}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </div>
                    </div>
                    {/* Expanded contact details */}
                    {isExpanded && (
                      <div className="px-6 pb-3 pt-0 bg-secondary/20 grid grid-cols-2 gap-2 text-xs text-muted-foreground border-t border-border">
                        {client.contactName && <div className="flex items-center gap-1.5 pt-2"><span className="font-medium text-foreground">Contact:</span> {client.contactName}</div>}
                        {client.contactPhone && <div className="flex items-center gap-1.5 pt-2"><Phone className="w-3 h-3" />{client.contactPhone}</div>}
                        {client.contactEmail && <div className="flex items-center gap-1.5 pt-2"><Mail className="w-3 h-3" />{client.contactEmail}</div>}
                        {client.website && <div className="flex items-center gap-1.5 pt-2"><Globe className="w-3 h-3" /><a href={client.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">{client.website}</a></div>}
                        {client.address1 && <div className="flex items-center gap-1.5 pt-2 col-span-2"><MapPin className="w-3 h-3" />{client.address1}{client.city ? `, ${client.city}, ${client.state}` : ""}</div>}
                        {client.notes && <div className="pt-2 col-span-2 text-muted-foreground italic">{client.notes}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editClient ? "Edit Client" : "Add New Client"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField control={form.control} name="company" render={({ field }) => (
                <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} data-testid="input-company" /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="subLocation" render={({ field }) => (
                  <FormItem><FormLabel>Sub-Location</FormLabel><FormControl><Input {...field} value={field.value ?? ""} placeholder="e.g. Main, Asphalt" data-testid="input-sublocation" /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="parentCompany" render={({ field }) => (
                  <FormItem><FormLabel>Parent Company</FormLabel><FormControl><Input {...field} value={field.value ?? ""} data-testid="input-parent" /></FormControl></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem><FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl><SelectTrigger data-testid="select-category"><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-client-status"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="address1" render={({ field }) => (
                <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} value={field.value ?? ""} data-testid="input-address" /></FormControl></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} value={field.value ?? ""} data-testid="input-city" /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="state" render={({ field }) => (
                  <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} value={field.value ?? ""} maxLength={2} placeholder="KS" data-testid="input-state" /></FormControl></FormItem>
                )} />
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground mb-2">Contact Info (add now or fill in later)</p>
                <div className="space-y-2">
                  <FormField control={form.control} name="contactName" render={({ field }) => (
                    <FormItem><FormLabel>Contact Name</FormLabel><FormControl><Input {...field} value={field.value ?? ""} data-testid="input-contact-name" /></FormControl></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="contactPhone" render={({ field }) => (
                      <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} value={field.value ?? ""} type="tel" data-testid="input-phone" /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="contactEmail" render={({ field }) => (
                      <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} value={field.value ?? ""} type="email" data-testid="input-email" /></FormControl></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="website" render={({ field }) => (
                    <FormItem><FormLabel>Website</FormLabel><FormControl><Input {...field} value={field.value ?? ""} placeholder="https://..." data-testid="input-website" /></FormControl></FormItem>
                  )} />
                </div>
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} rows={2} data-testid="textarea-client-notes" /></FormControl></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-client">
                  {editClient ? "Save Changes" : "Add Client"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
