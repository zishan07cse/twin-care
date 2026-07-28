import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  listAppointments,
  createAppointment,
  updateAppointmentStatus,
  rescheduleAppointment,
  listProvidersForScheduling,
  type AppointmentValues,
} from "@/lib/scheduling.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Calendar, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/appointments")({
  component: AppointmentsPage,
});

const emptyForm: AppointmentValues = {
  patient_id: "",
  provider_kind: "doctor",
  doctor_id: null,
  nutritionist_id: null,
  coordinator_user_id: null,
  scheduled_at: "",
  duration_minutes: 30,
  mode: "in_person",
  location: "",
  meeting_link: "",
  reason: "",
  notes: "",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  scheduled: "default",
  completed: "secondary",
  missed: "destructive",
  cancelled: "outline",
  rescheduled: "outline",
};

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AppointmentsPage() {
  const { hasAnyRole } = useAuth();
  const canView = hasAnyRole([
    "super_admin",
    "admin",
    "care_coordinator",
    "doctor",
    "nutritionist",
  ]);
  const canEdit = hasAnyRole(["super_admin", "admin", "care_coordinator"]);

  const qc = useQueryClient();
  const listFn = useServerFn(listAppointments);
  const provFn = useServerFn(listProvidersForScheduling);
  const createFn = useServerFn(createAppointment);
  const updFn = useServerFn(updateAppointmentStatus);
  const reFn = useServerFn(rescheduleAppointment);

  const [filter, setFilter] = useState<"upcoming" | "today" | "past" | "all">("upcoming");
  const [statusFilter, setStatusFilter] = useState("all");

  const range = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
    if (filter === "today") return { from: startToday, to: endToday };
    if (filter === "upcoming") return { from: now.toISOString() };
    if (filter === "past") return { to: now.toISOString() };
    return {};
  }, [filter]);

  const { data: appts = [], isLoading } = useQuery({
    queryKey: ["appointments", filter, statusFilter],
    queryFn: () => listFn({ data: { ...range, status: statusFilter } }),
    enabled: canView,
  });

  const { data: providers } = useQuery({
    queryKey: ["scheduling-providers"],
    queryFn: () => provFn(),
    enabled: canView && canEdit,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AppointmentValues>(emptyForm);
  const [rescheduleFor, setRescheduleFor] = useState<any | null>(null);
  const [newTime, setNewTime] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          ...form,
          scheduled_at: new Date(form.scheduled_at).toISOString(),
        },
      }),
    onSuccess: () => {
      toast.success("Appointment scheduled");
      qc.invalidateQueries({ queryKey: ["appointments"] });
      setOpen(false);
    },
    onError: (e) =>
      toast.error("Schedule failed", { description: (e as Error).message }),
  });

  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: "completed" | "missed" | "cancelled" }) =>
      updFn({ data: v }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e) => toast.error("Update failed", { description: (e as Error).message }),
  });

  const doReschedule = useMutation({
    mutationFn: () =>
      reFn({
        data: {
          id: rescheduleFor!.id,
          scheduled_at: new Date(newTime).toISOString(),
        },
      }),
    onSuccess: () => {
      toast.success("Rescheduled");
      qc.invalidateQueries({ queryKey: ["appointments"] });
      setRescheduleFor(null);
    },
    onError: (e) => toast.error("Reschedule failed", { description: (e as Error).message }),
  });

  function openNew() {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    setForm({ ...emptyForm, scheduled_at: toLocalInput(d.toISOString()) });
    setOpen(true);
  }

  const stats = useMemo(() => {
    const arr = appts as any[];
    return {
      total: arr.length,
      scheduled: arr.filter((a) => a.status === "scheduled").length,
      completed: arr.filter((a) => a.status === "completed").length,
      missed: arr.filter((a) => a.status === "missed").length,
    };
  }, [appts]);

  if (!canView) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        You do not have access to this page.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Consultations</h1>
          <p className="text-sm text-muted-foreground">
            Schedule and track patient consultations with doctors, nutritionists, and coordinators.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            New appointment
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Showing" value={stats.total} icon={<Calendar className="h-4 w-4" />} />
        <StatCard label="Scheduled" value={stats.scheduled} icon={<Clock className="h-4 w-4" />} />
        <StatCard
          label="Completed"
          value={stats.completed}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard label="Missed" value={stats.missed} icon={<XCircle className="h-4 w-4" />} />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex rounded-md border overflow-hidden">
          {(["today", "upcoming", "past", "all"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-1.5 text-sm capitalize ${
                filter === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="missed">Missed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (appts as any[]).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No appointments in this view.
                </TableCell>
              </TableRow>
            )}
            {(appts as any[]).map((a) => {
              const when = new Date(a.scheduled_at);
              return (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="font-medium">{when.toLocaleDateString()}</div>
                    <div className="text-xs text-muted-foreground">
                      {when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ·{" "}
                      {a.duration_minutes}m
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{a.patient?.full_name}</div>
                    <div className="text-xs text-muted-foreground">{a.patient?.patient_code}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {a.doctor?.full_name || a.nutritionist?.full_name || "Coordinator"}
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">
                      {a.provider_kind}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {a.mode.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[a.status]} className="capitalize">
                      {a.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {canEdit && a.status === "scheduled" && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setStatus.mutate({ id: a.id, status: "completed" })
                          }
                        >
                          Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setStatus.mutate({ id: a.id, status: "missed" })
                          }
                        >
                          Missed
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setRescheduleFor(a);
                            setNewTime(toLocalInput(a.scheduled_at));
                          }}
                        >
                          Reschedule
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New appointment</DialogTitle>
            <DialogDescription>Schedule a consultation for a patient.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.patient_id || !form.scheduled_at) {
                toast.error("Patient and date/time are required");
                return;
              }
              create.mutate();
            }}
          >
            <div className="space-y-1">
              <Label>Patient</Label>
              <Select
                value={form.patient_id}
                onValueChange={(v) => setForm({ ...form, patient_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select patient" />
                </SelectTrigger>
                <SelectContent>
                  {providers?.patients.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.patient_code} — {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Provider type</Label>
                <Select
                  value={form.provider_kind}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      provider_kind: v as any,
                      doctor_id: null,
                      nutritionist_id: null,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="nutritionist">Nutritionist</SelectItem>
                    <SelectItem value="coordinator">Care coordinator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Provider</Label>
                {form.provider_kind === "doctor" ? (
                  <Select
                    value={form.doctor_id ?? ""}
                    onValueChange={(v) => setForm({ ...form, doctor_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers?.doctors.map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : form.provider_kind === "nutritionist" ? (
                  <Select
                    value={form.nutritionist_id ?? ""}
                    onValueChange={(v) => setForm({ ...form, nutritionist_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select nutritionist" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers?.nutritionists.map((n: any) => (
                        <SelectItem key={n.id} value={n.id}>
                          {n.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value="Assigned to you" disabled />
                )}
              </div>
              <div className="space-y-1">
                <Label>Date & time</Label>
                <Input
                  type="datetime-local"
                  required
                  value={form.scheduled_at}
                  onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Duration (min)</Label>
                <Input
                  type="number"
                  min={5}
                  max={480}
                  value={form.duration_minutes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      duration_minutes: Math.max(5, Math.floor(Number(e.target.value) || 30)),
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Mode</Label>
                <Select
                  value={form.mode}
                  onValueChange={(v) => setForm({ ...form, mode: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_person">In-person</SelectItem>
                    <SelectItem value="tele">Tele-consult</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Reason</Label>
                <Input
                  value={form.reason ?? ""}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                />
              </div>
            </div>
            {form.mode === "in_person" && (
              <div className="space-y-1">
                <Label>Location</Label>
                <Input
                  value={form.location ?? ""}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
            )}
            {form.mode === "tele" && (
              <div className="space-y-1">
                <Label>Meeting link</Label>
                <Input
                  value={form.meeting_link ?? ""}
                  onChange={(e) => setForm({ ...form, meeting_link: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Scheduling..." : "Schedule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reschedule dialog */}
      <Dialog open={!!rescheduleFor} onOpenChange={(o) => !o && setRescheduleFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reschedule</DialogTitle>
            <DialogDescription>
              {rescheduleFor?.patient?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>New date & time</Label>
            <Input
              type="datetime-local"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleFor(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => doReschedule.mutate()}
              disabled={doReschedule.isPending || !newTime}
            >
              {doReschedule.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
