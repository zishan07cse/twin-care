import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useGoogleMaps } from "@/hooks/use-google-maps";

export type MapVisit = {
  visit_no: string | null;
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
  targetLabel?: string;
};

export function VisitMapDialog({
  visit,
  open,
  onOpenChange,
}: {
  visit: MapVisit | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { google, error } = useGoogleMaps();
  const mapEl = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !google || !mapEl.current || !visit) return;
    const points: { lat: number; lng: number; label: string; color: string }[] = [];
    if (visit.target_lat != null && visit.target_lng != null)
      points.push({ lat: visit.target_lat, lng: visit.target_lng, label: "Target", color: "#6366f1" });
    if (visit.checkin_lat != null && visit.checkin_lng != null)
      points.push({ lat: visit.checkin_lat, lng: visit.checkin_lng, label: "Check-in", color: "#16a34a" });
    if (visit.checkout_lat != null && visit.checkout_lng != null)
      points.push({ lat: visit.checkout_lat, lng: visit.checkout_lng, label: "Check-out", color: "#dc2626" });
    if (!points.length) return;

    const map = new google.maps.Map(mapEl.current, {
      center: points[0],
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
    });
    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => {
      new google.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map,
        title: p.label,
        label: { text: p.label[0], color: "white", fontWeight: "bold" },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: p.color,
          fillOpacity: 1,
          strokeColor: "white",
          strokeWeight: 2,
        },
      });
      bounds.extend(p);
    });
    if (points.length > 1) {
      new google.maps.Polyline({
        path: points.map((p) => ({ lat: p.lat, lng: p.lng })),
        map,
        strokeColor: "#64748b",
        strokeOpacity: 0.8,
        strokeWeight: 2,
      });
      map.fitBounds(bounds, 60);
    }
  }, [open, google, visit]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Visit map {visit?.visit_no ? `— ${visit.visit_no}` : ""}
            {visit?.distance_flagged && (
              <Badge variant="destructive" className="ml-2">
                Off-location
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {visit?.targetLabel ? `Target: ${visit.targetLabel}. ` : ""}
            {visit?.distance_from_target_m != null
              ? `~${Math.round(visit.distance_from_target_m)} m from target at check-in.`
              : "No target GPS on file — distance not computed."}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : !visit ||
          (visit.target_lat == null &&
            visit.checkin_lat == null &&
            visit.checkout_lat == null) ? (
          <div className="text-sm text-muted-foreground">No GPS data captured for this visit yet.</div>
        ) : (
          <div ref={mapEl} className="w-full h-[480px] rounded-md border bg-muted" />
        )}
        <div className="grid grid-cols-3 gap-3 text-xs">
          <Legend color="#6366f1" label="Target" />
          <Legend color="#16a34a" label="Check-in" />
          <Legend color="#dc2626" label="Check-out" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block h-3 w-3 rounded-full" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}
