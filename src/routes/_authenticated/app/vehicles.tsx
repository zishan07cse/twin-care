import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  listVehicles,
  upsertVehicle,
  deleteVehicle,
  listTrips,
  startTrip,
  endTrip,
  cancelTrip,
  type VehicleValues,
} from "@/lib/vehicles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Car, Plus, Play, StopCircle, Trash2, Pencil, Ban } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/vehicles")({
  component: VehiclesPage,
});

type Vehicle = {
  id: string;
  code: string;
  name: string;
  make: string | null;
  model: string | null;
  plate_number: string | null;
  capacity: number | null;
  status: "available" | "in_use" | "maintenance" | "retired";
  notes: string | null;
  is_active: boolean;
};

type Trip = {
  id: string;
  vehicle_id: string;
  vehicle: { id: string; code: string; name: string; plate_number: string | null } | null;
  driver_user_id: string;
  driver_name: string | null;
  from_location: string;
  to_location: string;
  purpose: string | null;
  start_at: string;
  end_at: string | null;
  start_odometer: number | null;
  end_odometer: number | null;
  passengers: number | null;
  status: "ongoing" | "completed" | "cancelled";
  notes: string | null;
};

function statusVariant(s: Vehicle["status"]) {
  return s === "available" ? "default" : s === "in_use" ? "secondary" : s === "maintenance" ? "outline" : "destructive";
}

function VehiclesPage() {
  const { hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole(["admin", "super_admin"]);
  const qc = useQueryClient();

  const listVeh = useServerFn(listVehicles);
  const listT = useServerFn(listTrips);
  const upsertVeh = useServerFn(upsertVehicle);
  const delVeh = useServerFn(deleteVehicle);
  const startTr = useServerFn(startTrip);
  const endTr = useServerFn(endTrip);
  const cancelTr = useServerFn(cancelTrip);

  const vehiclesQ = useQuery({ queryKey: ["vehicles"], queryFn: () => listVeh() });
  const tripsQ = useQuery({
    queryKey: ["vehicle_trips", isAdmin ? "all" : "mine"],
    queryFn: () => listT({ data: { scope: isAdmin ? "all" : "mine" } }),
  });

  const vehicles = (vehiclesQ.data ?? []) as Vehicle[];
  const trips = (tripsQ.data ?? []) as Trip[];

  const [vehDialog, setVehDialog] = useState<{ open: boolean; vehicle: Vehicle | null }>({ open: false, vehicle: null });
  const [tripDialog, setTripDialog] = useState<{ open: boolean; vehicleId?: string }>({ open: false });
  const [endDialog, setEndDialog] = useState<{ open: boolean; trip: Trip | null }>({ open: false, trip: null });

  const upsertMut = useMutation({
    mutationFn: (p: { id?: string; values: VehicleValues }) => upsertVeh({ data: p }),
    onSuccess: () => {
      toast.success("Saved");
      setVehDialog({ open: false, vehicle: null });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delVeh({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["vehicles"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const startMut = useMutation({
    mutationFn: (v: {
      vehicle_id: string;
      from_location: string;
      to_location: string;
      purpose?: string | null;
      start_odometer?: number | null;
      passengers?: number | null;
      notes?: string | null;
    }) => startTr({ data: v }),
    onSuccess: () => {
      toast.success("Trip started");
      setTripDialog({ open: false });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["vehicle_trips"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const endMut = useMutation({
    mutationFn: (v: {
      id: string;
      end_odometer?: number | null;
      notes?: string | null;
      to_location?: string | null;
    }) => endTr({ data: v }),
    onSuccess: () => {
      toast.success("Trip ended");
      setEndDialog({ open: false, trip: null });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["vehicle_trips"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelTr({ data: { id } }),
    onSuccess: () => {
      toast.success("Trip cancelled");
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["vehicle_trips"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const availableVehicles = vehicles.filter((v) => v.is_active && v.status === "available");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Car className="h-6 w-6" /> Vehicles
          </h1>
          <p className="text-sm text-muted-foreground">Office car pool — pick an available car and log your trip.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setTripDialog({ open: true })} disabled={availableVehicles.length === 0}>
            <Play className="h-4 w-4 mr-1" /> Start trip
          </Button>
          {isAdmin && (
            <Button variant="outline" onClick={() => setVehDialog({ open: true, vehicle: null })}>
              <Plus className="h-4 w-4 mr-1" /> Add vehicle
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="pool" className="w-full">
        <TabsList>
          <TabsTrigger value="pool">Car pool ({vehicles.length})</TabsTrigger>
          <TabsTrigger value="trips">{isAdmin ? "All trips" : "My trips"} ({trips.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pool" className="mt-4">
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="p-2">Code</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Plate</th>
                  <th className="p-2">Make/Model</th>
                  <th className="p-2">Cap.</th>
                  <th className="p-2">Status</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id} className="border-t">
                    <td className="p-2 font-mono">{v.code}</td>
                    <td className="p-2">{v.name}</td>
                    <td className="p-2">{v.plate_number || "—"}</td>
                    <td className="p-2">{[v.make, v.model].filter(Boolean).join(" ") || "—"}</td>
                    <td className="p-2">{v.capacity ?? "—"}</td>
                    <td className="p-2">
                      <Badge variant={statusVariant(v.status)}>{v.status.replace("_", " ")}</Badge>
                      {!v.is_active && <Badge variant="outline" className="ml-1">inactive</Badge>}
                    </td>
                    <td className="p-2 text-right space-x-1">
                      {v.status === "available" && v.is_active && (
                        <Button size="sm" variant="secondary" onClick={() => setTripDialog({ open: true, vehicleId: v.id })}>
                          <Play className="h-3 w-3 mr-1" /> Start
                        </Button>
                      )}
                      {isAdmin && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setVehDialog({ open: true, vehicle: v })}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => {
                            if (confirm(`Delete vehicle ${v.name}?`)) delMut.mutate(v.id);
                          }}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {vehicles.length === 0 && (
                  <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">No vehicles yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="trips" className="mt-4">
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="p-2">Vehicle</th>
                  {isAdmin && <th className="p-2">Driver</th>}
                  <th className="p-2">From → To</th>
                  <th className="p-2">Purpose</th>
                  <th className="p-2">Start</th>
                  <th className="p-2">End</th>
                  <th className="p-2">Km</th>
                  <th className="p-2">Status</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((t) => {
                  const km = t.start_odometer != null && t.end_odometer != null ? t.end_odometer - t.start_odometer : null;
                  return (
                    <tr key={t.id} className="border-t">
                      <td className="p-2">
                        <div className="font-medium">{t.vehicle?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{t.vehicle?.plate_number ?? ""}</div>
                      </td>
                      {isAdmin && <td className="p-2">{t.driver_name || t.driver_user_id.slice(0, 8)}</td>}
                      <td className="p-2">
                        <div>{t.from_location}</div>
                        <div className="text-xs text-muted-foreground">→ {t.to_location}</div>
                      </td>
                      <td className="p-2 max-w-[200px] truncate">{t.purpose || "—"}</td>
                      <td className="p-2 whitespace-nowrap">{new Date(t.start_at).toLocaleString()}</td>
                      <td className="p-2 whitespace-nowrap">{t.end_at ? new Date(t.end_at).toLocaleString() : "—"}</td>
                      <td className="p-2">{km ?? "—"}</td>
                      <td className="p-2">
                        <Badge variant={t.status === "ongoing" ? "default" : t.status === "completed" ? "secondary" : "outline"}>
                          {t.status}
                        </Badge>
                      </td>
                      <td className="p-2 text-right space-x-1">
                        {t.status === "ongoing" && (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => setEndDialog({ open: true, trip: t })}>
                              <StopCircle className="h-3 w-3 mr-1" /> End
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => {
                              if (confirm("Cancel this trip?")) cancelMut.mutate(t.id);
                            }}>
                              <Ban className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {trips.length === 0 && (
                  <tr><td colSpan={isAdmin ? 9 : 8} className="p-4 text-center text-muted-foreground">No trips yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <VehicleDialog
        open={vehDialog.open}
        vehicle={vehDialog.vehicle}
        onClose={() => setVehDialog({ open: false, vehicle: null })}
        onSave={(values, id) => upsertMut.mutate({ id, values })}
        saving={upsertMut.isPending}
      />

      <TripDialog
        open={tripDialog.open}
        vehicles={availableVehicles}
        preselect={tripDialog.vehicleId}
        onClose={() => setTripDialog({ open: false })}
        onStart={(v) => startMut.mutate(v)}
        starting={startMut.isPending}
      />

      <EndTripDialog
        open={endDialog.open}
        trip={endDialog.trip}
        onClose={() => setEndDialog({ open: false, trip: null })}
        onEnd={(v) => endMut.mutate(v)}
        ending={endMut.isPending}
      />
    </div>
  );
}

function VehicleDialog({
  open, vehicle, onClose, onSave, saving,
}: {
  open: boolean;
  vehicle: Vehicle | null;
  onClose: () => void;
  onSave: (values: VehicleValues, id?: string) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<VehicleValues>({
    code: "", name: "", make: "", model: "", plate_number: "",
    capacity: null, status: "available", notes: "", is_active: true,
  });

  // Reset form when opening
  const opening = open && (vehicle?.id ?? "") !== (form as unknown as { _id?: string })._id;
  if (opening) {
    setTimeout(() => {
      setForm({
        code: vehicle?.code ?? "",
        name: vehicle?.name ?? "",
        make: vehicle?.make ?? "",
        model: vehicle?.model ?? "",
        plate_number: vehicle?.plate_number ?? "",
        capacity: vehicle?.capacity ?? null,
        status: vehicle?.status ?? "available",
        notes: vehicle?.notes ?? "",
        is_active: vehicle?.is_active ?? true,
      });
      (form as unknown as { _id?: string })._id = vehicle?.id ?? "";
    }, 0);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{vehicle ? "Edit vehicle" : "Add vehicle"}</DialogTitle>
          <DialogDescription>Configure the pool car.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Code *</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="V-001" />
            </div>
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Toyota Axio" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Make</Label>
              <Input value={form.make ?? ""} onChange={(e) => setForm({ ...form, make: e.target.value })} />
            </div>
            <div>
              <Label>Model</Label>
              <Input value={form.model ?? ""} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Plate number</Label>
              <Input value={form.plate_number ?? ""} onChange={(e) => setForm({ ...form, plate_number: e.target.value })} />
            </div>
            <div>
              <Label>Capacity (seats)</Label>
              <Input
                type="number"
                value={form.capacity ?? ""}
                onChange={(e) => setForm({ ...form, capacity: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as VehicleValues["status"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="in_use">In use</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Active
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={saving || !form.code.trim() || !form.name.trim()}
            onClick={() => onSave(form, vehicle?.id)}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TripDialog({
  open, vehicles, preselect, onClose, onStart, starting,
}: {
  open: boolean;
  vehicles: Vehicle[];
  preselect?: string;
  onClose: () => void;
  onStart: (v: {
    vehicle_id: string;
    from_location: string;
    to_location: string;
    purpose?: string | null;
    start_odometer?: number | null;
    passengers?: number | null;
    notes?: string | null;
  }) => void;
  starting: boolean;
}) {
  const [vehicleId, setVehicleId] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [purpose, setPurpose] = useState("");
  const [odo, setOdo] = useState("");
  const [pax, setPax] = useState("");
  const [notes, setNotes] = useState("");

  const opening = open && !vehicleId;
  if (opening) {
    setTimeout(() => setVehicleId(preselect ?? vehicles[0]?.id ?? ""), 0);
  }

  const reset = () => {
    setVehicleId(""); setFrom(""); setTo(""); setPurpose(""); setOdo(""); setPax(""); setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start trip</DialogTitle>
          <DialogDescription>Pick a car and log where you're going.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label>Vehicle *</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger><SelectValue placeholder="Select an available vehicle" /></SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name} {v.plate_number ? `· ${v.plate_number}` : ""} ({v.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {vehicles.length === 0 && (
              <p className="text-xs text-destructive mt-1">No vehicles are currently available.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>From *</Label>
              <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Office" />
            </div>
            <div>
              <Label>To *</Label>
              <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Client site" />
            </div>
          </div>
          <div>
            <Label>Purpose</Label>
            <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Client meeting" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start odometer (km)</Label>
              <Input type="number" value={odo} onChange={(e) => setOdo(e.target.value)} />
            </div>
            <div>
              <Label>Passengers</Label>
              <Input type="number" value={pax} onChange={(e) => setPax(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button
            disabled={starting || !vehicleId || !from.trim() || !to.trim()}
            onClick={() =>
              onStart({
                vehicle_id: vehicleId,
                from_location: from.trim(),
                to_location: to.trim(),
                purpose: purpose.trim() || null,
                start_odometer: odo ? Number(odo) : null,
                passengers: pax ? Number(pax) : null,
                notes: notes.trim() || null,
              })
            }
          >
            <Play className="h-4 w-4 mr-1" /> Start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EndTripDialog({
  open, trip, onClose, onEnd, ending,
}: {
  open: boolean;
  trip: Trip | null;
  onClose: () => void;
  onEnd: (v: { id: string; end_odometer?: number | null; notes?: string | null; to_location?: string | null }) => void;
  ending: boolean;
}) {
  const [odo, setOdo] = useState("");
  const [notes, setNotes] = useState("");
  const [to, setTo] = useState("");

  const opening = open && trip && to === "" && notes === "" && odo === "";
  if (opening) {
    setTimeout(() => {
      setTo(trip!.to_location ?? "");
      setNotes(trip!.notes ?? "");
    }, 0);
  }

  const reset = () => { setOdo(""); setNotes(""); setTo(""); };

  if (!trip) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>End trip</DialogTitle>
          <DialogDescription>
            {trip.vehicle?.name} · {trip.from_location} → {trip.to_location}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label>Final destination</Label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label>End odometer (km)</Label>
            <Input type="number" value={odo} onChange={(e) => setOdo(e.target.value)} />
            {trip.start_odometer != null && (
              <p className="text-xs text-muted-foreground mt-1">Start: {trip.start_odometer} km</p>
            )}
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button
            disabled={ending}
            onClick={() =>
              onEnd({
                id: trip.id,
                end_odometer: odo ? Number(odo) : null,
                notes: notes.trim() || null,
                to_location: to.trim() || null,
              })
            }
          >
            <StopCircle className="h-4 w-4 mr-1" /> End trip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
