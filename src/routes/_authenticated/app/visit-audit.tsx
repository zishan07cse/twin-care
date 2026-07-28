import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { listVisits } from "@/lib/visits.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, MapPin } from "lucide-react";
import { useGoogleMaps } from "@/hooks/use-google-maps";
import { VisitMapDialog } from "@/components/app/visit-map-dialog";

type Visit = {
  id: string;
  visit_no: string | null;
  target_type: string;
  status: string;
  assigned_to: string;
  target_lat: number | null;
  target_lng: number | null;
  checkin_lat: number | null;
  checkin_lng: number | null;
  checkin_at: string | null;
  checkout_lat: number | null;
  checkout_lng: number | null;
  checkout_at: string | null;
  distance_from_target_m: number | null;
  distance_flagged: boolean;
  doctor?: { full_name: string } | null;
  hospital?: { name: string } | null;
  patient?: { full_name: string; patient_code: string } | null;
  dealer?: { name: string } | null;
  pharmacy?: { name: string } | null;
  assigned_profile?: { id: string; full_name: string | null } | null;
};

export const Route = createFileRoute("/_authenticated/app/visit-audit")({
  component: VisitAuditPage,
});

function targetLabel(v: Visit): string {
  return (
    v.doctor?.full_name ||
    v.hospital?.name ||
    v.patient?.full_name ||
    v.dealer?.name ||
    v.pharmacy?.name ||
    "—"
  );
}

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function VisitAuditPage() {
  const { hasAnyRole } = useAuth();
  const allowed = hasAnyRole(["super_admin", "admin"]);
  const list = useServerFn(listVisits);

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(todayISO());
  const [rep, setRep] = useState<string>("all");
  const [routeDay, setRouteDay] = useState<string>(todayISO());
  const [mapVisit, setMapVisit] = useState<Visit | null>(null);

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ["visit-audit", from, to],
    queryFn: () =>
      list({
        data: {
          from: from ? new Date(from).toISOString() : undefined,
          to: to ? new Date(to + "T23:59:59").toISOString() : undefined,
        },
      }),
    enabled: allowed,
  });

  const reps = useMemo(() => {
    const map = new Map<string, string>();
    (visits as Visit[]).forEach((v) => {
      if (v.assigned_to) map.set(v.assigned_to, v.assigned_profile?.full_name || v.assigned_to.slice(0, 8));
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [visits]);

  const filtered = useMemo(
    () => (rep === "all" ? (visits as Visit[]) : (visits as Visit[]).filter((v) => v.assigned_to === rep)),
    [visits, rep],
  );

  const stats = useMemo(() => {
    const perRep = new Map<string, { name: string; total: number; flagged: number; completed: number; noGps: number }>();
    (visits as Visit[]).forEach((v) => {
      const key = v.assigned_to;
      const name = v.assigned_profile?.full_name || key.slice(0, 8);
      const s = perRep.get(key) || { name, total: 0, flagged: 0, completed: 0, noGps: 0 };
      s.total++;
      if (v.distance_flagged) s.flagged++;
      if (v.status === "completed") s.completed++;
      if (!v.checkin_at && v.status !== "planned") s.noGps++;
      perRep.set(key, s);
    });
    return Array.from(perRep.entries()).map(([id, s]) => ({ id, ...s }));
  }, [visits]);

  const flagged = useMemo(() => filtered.filter((v) => v.distance_flagged), [filtered]);

  const routeVisits = useMemo(() => {
    if (rep === "all") return [];
    return (visits as Visit[])
      .filter((v) => v.assigned_to === rep && v.checkin_at && v.checkin_at.slice(0, 10) === routeDay)
      .sort((a, b) => (a.checkin_at || "").localeCompare(b.checkin_at || ""));
  }, [visits, rep, routeDay]);

  if (!allowed) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">Admin access required.</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Visit GPS audit</h1>
        <p className="text-sm text-muted-foreground">
          Verify field visits — flagged off-location entries, per-rep stats, and daily route on map.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md border p-3 bg-muted/30">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Rep</Label>
          <Select value={rep} onValueChange={setRep}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reps</SelectItem>
              {reps.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Per-rep stats */}
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Per-rep summary</h2>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Rep</th>
                <th className="p-3">Total visits</th>
                <th className="p-3">Completed</th>
                <th className="p-3">Off-location</th>
                <th className="p-3">Missing GPS</th>
                <th className="p-3">Flag rate</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && stats.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No visits in range.</td></tr>
              )}
              {stats.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3">{s.total}</td>
                  <td className="p-3">{s.completed}</td>
                  <td className="p-3">
                    {s.flagged > 0 ? (
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="h-3 w-3" /> {s.flagged}
                      </span>
                    ) : "0"}
                  </td>
                  <td className="p-3">{s.noGps}</td>
                  <td className="p-3">
                    {s.total ? Math.round((s.flagged / s.total) * 100) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Flagged list */}
      <section className="space-y-2">
        <h2 className="text-lg font-medium">
          Flagged visits ({flagged.length})
          <span className="ml-2 text-xs text-muted-foreground font-normal">check-in &gt;500m from target</span>
        </h2>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Visit</th>
                <th className="p-3">Rep</th>
                <th className="p-3">Target</th>
                <th className="p-3">Check-in</th>
                <th className="p-3">Distance</th>
                <th className="p-3 text-right">Map</th>
              </tr>
            </thead>
            <tbody>
              {flagged.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No flagged visits — nice.</td></tr>
              )}
              {flagged.map((v) => (
                <tr key={v.id} className="border-t">
                  <td className="p-3 font-mono text-xs">{v.visit_no ?? v.id.slice(0, 8)}</td>
                  <td className="p-3">{v.assigned_profile?.full_name ?? "—"}</td>
                  <td className="p-3">
                    <div className="font-medium">{targetLabel(v)}</div>
                    <div className="text-xs text-muted-foreground capitalize">{v.target_type}</div>
                  </td>
                  <td className="p-3 text-xs">{v.checkin_at ? new Date(v.checkin_at).toLocaleString() : "—"}</td>
                  <td className="p-3">
                    <Badge variant="destructive">
                      ~{Math.round(v.distance_from_target_m || 0)} m
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setMapVisit(v)}>
                      <MapPin className="h-3 w-3 mr-1" /> View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Daily route map */}
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Daily route</h2>
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Day</Label>
            <Input type="date" value={routeDay} onChange={(e) => setRouteDay(e.target.value)} className="w-40" />
          </div>
          <p className="text-xs text-muted-foreground pb-2">
            {rep === "all" ? "Select a rep above to view their route." : `${routeVisits.length} check-in(s) on ${routeDay}`}
          </p>
        </div>
        {rep !== "all" && <RouteMap visits={routeVisits} onSelect={setMapVisit} />}
      </section>

      <VisitMapDialog
        open={!!mapVisit}
        onOpenChange={(o) => !o && setMapVisit(null)}
        visit={mapVisit ? { ...mapVisit, targetLabel: targetLabel(mapVisit) } : null}
      />
    </div>
  );
}

function RouteMap({ visits, onSelect }: { visits: Visit[]; onSelect: (v: Visit) => void }) {
  const { google, error } = useGoogleMaps();
  const mapEl = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!google || !mapEl.current) return;
    const pts = visits
      .filter((v) => v.checkin_lat != null && v.checkin_lng != null)
      .map((v) => ({ v, lat: v.checkin_lat!, lng: v.checkin_lng! }));
    const center = pts[0] ?? { lat: 23.8103, lng: 90.4125 }; // Dhaka fallback
    const map = new google.maps.Map(mapEl.current, {
      center,
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
    });
    if (!pts.length) return;
    const bounds = new google.maps.LatLngBounds();
    pts.forEach((p, i) => {
      const marker = new google.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map,
        title: `#${i + 1} ${p.v.checkin_at ? new Date(p.v.checkin_at).toLocaleTimeString() : ""}`,
        label: { text: String(i + 1), color: "white", fontWeight: "bold" },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: p.v.distance_flagged ? "#dc2626" : "#16a34a",
          fillOpacity: 1,
          strokeColor: "white",
          strokeWeight: 2,
        },
      });
      marker.addListener("click", () => onSelect(p.v));
      bounds.extend({ lat: p.lat, lng: p.lng });
    });
    if (pts.length > 1) {
      new google.maps.Polyline({
        path: pts.map((p) => ({ lat: p.lat, lng: p.lng })),
        map,
        strokeColor: "#3b82f6",
        strokeOpacity: 0.7,
        strokeWeight: 3,
      });
      map.fitBounds(bounds, 80);
    }
  }, [google, visits, onSelect]);

  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (!visits.length)
    return (
      <div className="text-sm text-muted-foreground rounded-md border p-6 text-center">
        No check-ins recorded for this day.
      </div>
    );
  return <div ref={mapEl} className="w-full h-[500px] rounded-md border bg-muted" />;
}
