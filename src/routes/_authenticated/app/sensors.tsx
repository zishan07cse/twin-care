import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSensors, recordSensorApplication, removeSensor } from "@/lib/ops.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { formatDateBD } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/app/sensors")({
  component: SensorsPage,
  errorComponent: ({ error }) => <div className="p-4 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-4">Not found</div>,
});

type Row = {
  id: string; applied_at: string; expires_at: string; batch_no?: string | null; removed_at?: string | null;
  patient?: { id: string; patient_code: string; full_name_en: string } | null;
};

function SensorsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listSensors);
  const record = useServerFn(recordSensorApplication);
  const rm = useServerFn(removeSensor);
  const { data = [] } = useQuery({ queryKey: ["sensors"], queryFn: () => list() });
  const [patientId, setPatientId] = useState("");
  const [batch, setBatch] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["sensors"] });
  const add = useMutation({
    mutationFn: () => record({ data: { patient_id: patientId, batch_no: batch || undefined } }),
    onSuccess: () => { setPatientId(""); setBatch(""); invalidate(); },
  });
  const rmMut = useMutation({ mutationFn: (id: string) => rm({ data: { id } }), onSuccess: invalidate });

  const now = Date.now();
  const soon = (r: Row) => !r.removed_at && new Date(r.expires_at).getTime() - now < 5 * 86400000;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">CGM sensors</h1>
      <Card>
        <CardHeader><CardTitle>Record new application</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input placeholder="Patient ID (UUID)" value={patientId} onChange={(e) => setPatientId(e.target.value)} className="w-72" />
          <Input placeholder="Batch #" value={batch} onChange={(e) => setBatch(e.target.value)} className="w-40" />
          <Button onClick={() => add.mutate()} disabled={!patientId || add.isPending}>Record (+14d expiry)</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Sensors (nearest expiry first)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2">Patient</th><th>Applied</th><th>Expires</th><th>Batch</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {(data as Row[]).map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="py-2">
                      {r.patient ? (
                        <Link to="/app/patients/$patientId" params={{ patientId: r.patient.id }} className="text-primary hover:underline">
                          {r.patient.patient_code}
                        </Link>
                      ) : "—"}
                    </td>
                    <td>{formatDateBD(r.applied_at)}</td>
                    <td>{formatDateBD(r.expires_at)}</td>
                    <td>{r.batch_no ?? "—"}</td>
                    <td>
                      {r.removed_at ? <Badge variant="outline">removed</Badge>
                        : soon(r) ? <Badge className="bg-amber-500 text-white">expiring soon</Badge>
                        : <Badge variant="secondary">active</Badge>}
                    </td>
                    <td className="text-right">
                      {!r.removed_at && (
                        <Button size="sm" variant="outline" onClick={() => rmMut.mutate(r.id)}>Remove</Button>
                      )}
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No sensor applications yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
