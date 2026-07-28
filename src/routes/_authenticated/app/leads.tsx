import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  listLeads,
  upsertLead,
  updateLeadStage,
  addLeadNote,
  deleteLead,
  convertLeadToPatient,
  getLead,
  listLeadRefData,
  type LeadValues,
} from "@/lib/leads.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Phone, Mail, ArrowRight, UserPlus, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/leads")({
  component: LeadsPage,
});

type Stage = "new" | "contacted" | "qualified" | "proposal" | "converted" | "lost";

const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: "new", label: "New", color: "bg-slate-100 border-slate-300" },
  { key: "contacted", label: "Contacted", color: "bg-blue-50 border-blue-300" },
  { key: "qualified", label: "Qualified", color: "bg-indigo-50 border-indigo-300" },
  { key: "proposal", label: "Proposal", color: "bg-amber-50 border-amber-300" },
  { key: "converted", label: "Converted", color: "bg-emerald-50 border-emerald-300" },
  { key: "lost", label: "Lost", color: "bg-rose-50 border-rose-300" },
];

const emptyLead: LeadValues = {
  full_name: "",
  phone: "",
  email: "",
  age: null,
  gender: "",
  city: "",
  source: "other",
  source_detail: "",
  referrer_doctor_id: "",
  interest_summary: "",
  next_follow_up_at: "",
  assigned_to: "",
};

function LeadsPage() {
  const { hasAnyRole } = useAuth();
  const canView = hasAnyRole(["super_admin", "admin", "care_coordinator"]);
  const canDelete = hasAnyRole(["super_admin", "admin"]);
  const nav = useNavigate();

  const qc = useQueryClient();
  const listFn = useServerFn(listLeads);
  const refFn = useServerFn(listLeadRefData);
  const upsertFn = useServerFn(upsertLead);
  const stageFn = useServerFn(updateLeadStage);
  const delFn = useServerFn(deleteLead);
  const convertFn = useServerFn(convertLeadToPatient);
  const getFn = useServerFn(getLead);
  const noteFn = useServerFn(addLeadNote);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: () => listFn(),
    enabled: canView,
  });
  const { data: refData } = useQuery({
    queryKey: ["leads-ref"],
    queryFn: () => refFn(),
    enabled: canView,
  });

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<LeadValues>(emptyLead);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const buckets = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = (leads as any[]).filter((l) =>
      !term
        ? true
        : [l.full_name, l.phone, l.email, l.city]
            .filter(Boolean)
            .some((v: string) => v.toLowerCase().includes(term)),
    );
    const map: Record<Stage, any[]> = {
      new: [], contacted: [], qualified: [], proposal: [], converted: [], lost: [],
    };
    for (const l of filtered) map[l.stage as Stage]?.push(l);
    return map;
  }, [leads, q]);

  const save = useMutation({
    mutationFn: () => upsertFn({ data: { id: editing?.id, values: form } }),
    onSuccess: () => {
      toast.success(editing ? "Lead updated" : "Lead added");
      qc.invalidateQueries({ queryKey: ["leads"] });
      setOpenForm(false);
    },
    onError: (e) => toast.error("Save failed", { description: (e as Error).message }),
  });

  const setStage = useMutation({
    mutationFn: (v: { id: string; stage: Stage; lost_reason?: string }) =>
      stageFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead", openLeadId] });
    },
    onError: (e) => toast.error("Update failed", { description: (e as Error).message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e) => toast.error("Delete failed", { description: (e as Error).message }),
  });

  const convert = useMutation({
    mutationFn: (id: string) => convertFn({ data: { id } }),
    onSuccess: (r: any) => {
      toast.success(`Converted → ${r.patient_code}`);
      qc.invalidateQueries({ queryKey: ["leads"] });
      nav({ to: "/app/patients" });
    },
    onError: (e) => toast.error("Convert failed", { description: (e as Error).message }),
  });

  function openNew() {
    setEditing(null);
    setForm(emptyLead);
    setOpenForm(true);
  }
  function openEdit(l: any) {
    setEditing(l);
    setForm({
      full_name: l.full_name,
      phone: l.phone,
      email: l.email ?? "",
      age: l.age,
      gender: l.gender ?? "",
      city: l.city ?? "",
      source: l.source,
      source_detail: l.source_detail ?? "",
      referrer_doctor_id: l.referrer_doctor_id ?? "",
      interest_summary: l.interest_summary ?? "",
      next_follow_up_at: l.next_follow_up_at
        ? new Date(l.next_follow_up_at).toISOString().slice(0, 16)
        : "",
      assigned_to: l.assigned_to ?? "",
    });
    setOpenForm(true);
  }

  if (!canView) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        You do not have access to this page.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Track prospects from first contact through enrollment.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Search leads..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs"
          />
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add lead
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground">Loading pipeline...</div>
      )}

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((s) => (
          <div
            key={s.key}
            className={`rounded-lg border ${s.color} p-3 min-h-[300px] space-y-2`}
          >
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
              <span>{s.label}</span>
              <Badge variant="secondary">{buckets[s.key].length}</Badge>
            </div>
            {buckets[s.key].map((l) => (
              <LeadCard
                key={l.id}
                lead={l}
                onOpen={() => setOpenLeadId(l.id)}
                onEdit={() => openEdit(l)}
                onDelete={() => canDelete && remove.mutate(l.id)}
                onMove={(stage) => setStage.mutate({ id: l.id, stage })}
                onConvert={() => convert.mutate(l.id)}
                canDelete={canDelete}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Form dialog */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit lead" : "Add lead"}</DialogTitle>
            <DialogDescription>Capture prospect details.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Full name</Label>
                <Input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>City</Label>
                <Input
                  value={form.city ?? ""}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Age</Label>
                <Input
                  type="number"
                  min={0}
                  max={120}
                  value={form.age ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      age: e.target.value ? Math.floor(Number(e.target.value)) : null,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Gender</Label>
                <Select
                  value={form.gender ?? ""}
                  onValueChange={(v) => setForm({ ...form, gender: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Source</Label>
                <Select
                  value={form.source}
                  onValueChange={(v) => setForm({ ...form, source: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      ["walk_in", "Walk-in"],
                      ["phone", "Phone"],
                      ["whatsapp", "WhatsApp"],
                      ["facebook", "Facebook"],
                      ["instagram", "Instagram"],
                      ["website", "Website"],
                      ["referral", "Referral"],
                      ["doctor", "Doctor"],
                      ["event", "Event"],
                      ["other", "Other"],
                    ].map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.source === "doctor" && (
                <div className="space-y-1">
                  <Label>Referring doctor</Label>
                  <Select
                    value={form.referrer_doctor_id ?? ""}
                    onValueChange={(v) => setForm({ ...form, referrer_doctor_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {refData?.doctors.map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1 col-span-2">
                <Label>Source detail</Label>
                <Input
                  value={form.source_detail ?? ""}
                  onChange={(e) => setForm({ ...form, source_detail: e.target.value })}
                  placeholder="Campaign, ad, event name..."
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Next follow-up</Label>
                <Input
                  type="datetime-local"
                  value={form.next_follow_up_at ?? ""}
                  onChange={(e) => setForm({ ...form, next_follow_up_at: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Interest / notes</Label>
              <Textarea
                rows={3}
                value={form.interest_summary ?? ""}
                onChange={(e) => setForm({ ...form, interest_summary: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <LeadDetailDialog
        leadId={openLeadId}
        onClose={() => setOpenLeadId(null)}
        getFn={getFn}
        noteFn={noteFn}
        stageFn={stageFn}
        convertFn={convertFn}
        onConverted={() => nav({ to: "/app/patients" })}
      />
    </div>
  );
}

function LeadCard({
  lead,
  onOpen,
  onEdit,
  onDelete,
  onMove,
  onConvert,
  canDelete,
}: {
  lead: any;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (s: Stage) => void;
  onConvert: () => void;
  canDelete: boolean;
}) {
  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <button className="text-left font-medium leading-tight hover:underline" onClick={onOpen}>
            {lead.full_name}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
              {lead.stage !== "converted" && (
                <DropdownMenuItem onClick={onConvert}>
                  <UserPlus className="h-3.5 w-3.5 mr-2" /> Convert to patient
                </DropdownMenuItem>
              )}
              <div className="border-t my-1" />
              {STAGES.filter((s) => s.key !== lead.stage).map((s) => (
                <DropdownMenuItem key={s.key} onClick={() => onMove(s.key)}>
                  <ArrowRight className="h-3.5 w-3.5 mr-2" /> Move to {s.label}
                </DropdownMenuItem>
              ))}
              {canDelete && (
                <>
                  <div className="border-t my-1" />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => {
                      if (confirm(`Delete ${lead.full_name}?`)) onDelete();
                    }}
                  >
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Phone className="h-3 w-3" /> {lead.phone}
        </div>
        {lead.email && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mail className="h-3 w-3" /> {lead.email}
          </div>
        )}
        <div className="flex flex-wrap gap-1 pt-1">
          <Badge variant="outline" className="text-[10px] capitalize">
            {lead.source.replace("_", " ")}
          </Badge>
          {lead.city && (
            <Badge variant="secondary" className="text-[10px]">
              {lead.city}
            </Badge>
          )}
        </div>
        {lead.next_follow_up_at && (
          <div className="text-[11px] text-amber-700">
            Follow-up: {new Date(lead.next_follow_up_at).toLocaleDateString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LeadDetailDialog({
  leadId,
  onClose,
  getFn,
  noteFn,
  stageFn,
  convertFn,
  onConverted,
}: {
  leadId: string | null;
  onClose: () => void;
  getFn: any;
  noteFn: any;
  stageFn: any;
  convertFn: any;
  onConverted: () => void;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const { data } = useQuery({
    queryKey: ["lead", leadId],
    queryFn: () => getFn({ data: { id: leadId! } }),
    enabled: !!leadId,
  });

  const addNote = useMutation({
    mutationFn: () => noteFn({ data: { lead_id: leadId!, note } }),
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
    },
  });

  const move = useMutation({
    mutationFn: (stage: Stage) => stageFn({ data: { id: leadId!, stage } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const convert = useMutation({
    mutationFn: () => convertFn({ data: { id: leadId! } }),
    onSuccess: (r: any) => {
      toast.success(`Converted → ${r.patient_code}`);
      qc.invalidateQueries({ queryKey: ["leads"] });
      onClose();
      onConverted();
    },
    onError: (e: any) => toast.error("Convert failed", { description: e.message }),
  });

  const lead = data?.lead;
  const notes = data?.notes ?? [];

  return (
    <Dialog open={!!leadId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead?.full_name ?? "Lead"}</DialogTitle>
          <DialogDescription>
            {lead && (
              <>
                <Badge variant="secondary" className="mr-2 capitalize">
                  {lead.stage}
                </Badge>
                Source: <span className="capitalize">{lead?.source?.replace("_", " ")}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {lead && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Phone</div>
                <div>{lead.phone}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Email</div>
                <div>{lead.email || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">City</div>
                <div>{lead.city || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Age / Gender</div>
                <div>
                  {lead.age ?? "—"} / {lead.gender || "—"}
                </div>
              </div>
              {lead.referrer && (
                <div className="col-span-2">
                  <div className="text-muted-foreground">Referring doctor</div>
                  <div>{lead.referrer.full_name}</div>
                </div>
              )}
              {lead.interest_summary && (
                <div className="col-span-2">
                  <div className="text-muted-foreground">Interest</div>
                  <div className="whitespace-pre-wrap">{lead.interest_summary}</div>
                </div>
              )}
              {lead.patient && (
                <div className="col-span-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-emerald-900">
                  Converted to patient <b>{lead.patient.patient_code}</b> — {lead.patient.full_name}
                </div>
              )}
            </div>

            {lead.stage !== "converted" && (
              <div className="flex flex-wrap gap-2 border-t pt-3">
                {STAGES.filter((s) => s.key !== lead.stage && s.key !== "converted").map((s) => (
                  <Button key={s.key} size="sm" variant="outline" onClick={() => move.mutate(s.key)}>
                    → {s.label}
                  </Button>
                ))}
                <Button size="sm" onClick={() => convert.mutate()}>
                  <UserPlus className="h-3.5 w-3.5 mr-1" /> Convert to patient
                </Button>
              </div>
            )}

            <div className="space-y-2 border-t pt-3">
              <div className="text-sm font-semibold">Activity</div>
              <div className="flex gap-2">
                <Textarea
                  rows={2}
                  placeholder="Add a note..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button
                  onClick={() => note.trim() && addNote.mutate()}
                  disabled={!note.trim() || addNote.isPending}
                >
                  Add
                </Button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {notes.length === 0 && (
                  <div className="text-xs text-muted-foreground">No activity yet.</div>
                )}
                {notes.map((n: any) => (
                  <div key={n.id} className="rounded border p-2 text-sm">
                    <div className="text-xs text-muted-foreground flex justify-between">
                      <span className="capitalize">{n.activity_type.replace("_", " ")}</span>
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    <div className="whitespace-pre-wrap">{n.note}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
