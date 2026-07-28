import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listPatientEntitlements,
  listExtraIssuances,
  requestExtraIssuance,
  decideExtraIssuance,
} from "@/lib/entitlements.functions";
import { listAssignments } from "@/lib/inventory.functions";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

type Ent = {
  id: string;
  quantity_entitled: number;
  quantity_delivered: number;
  ownership_mode: string;
  deposit_bdt: number;
  item: { id: string; name_en: string; category: string } | null;
  enrollment: { id: string; status: string; start_date: string; plan_id: string } | null;
};

type Extra = {
  id: string;
  quantity: number;
  reason: string;
  chargeable: boolean;
  amount_bdt: number;
  status: string;
  created_at: string;
  item: { name_en: string } | null;
};

type Assign = {
  id: string;
  quantity: number;
  assigned_at: string;
  expires_at: string | null;
  status: string;
  extra_issuance_id: string | null;
  item: { name_en: string; category: string; is_returnable: boolean } | null;
};

export function PatientDevicesTab({ patientId }: { patientId: string }) {
  const qc = useQueryClient();
  const { hasAnyRole } = useAuth();
  const canApprove = hasAnyRole(["super_admin", "admin"]);

  const entFn = useServerFn(listPatientEntitlements);
  const assignFn = useServerFn(listAssignments);
  const extrasFn = useServerFn(listExtraIssuances);
  const decideFn = useServerFn(decideExtraIssuance);

  const { data: ents = [] } = useQuery({
    queryKey: ["patient-ents", patientId],
    queryFn: () => entFn({ data: { patient_id: patientId } }),
  });
  const { data: assigns = [] } = useQuery({
    queryKey: ["patient-inv", patientId],
    queryFn: () => assignFn({ data: { patient_id: patientId } }),
  });
  const { data: extras = [] } = useQuery({
    queryKey: ["patient-extras", patientId],
    queryFn: () => extrasFn({ data: { patient_id: patientId } }),
  });

  const decide = useMutation({
    mutationFn: (v: { id: string; decision: "approved" | "rejected" }) =>
      decideFn({ data: v }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["patient-extras", patientId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Package entitlements</CardTitle>
          <CardDescription>
            Items included in this patient&apos;s enrolled package. Delivered vs. remaining is
            tracked automatically as items are assigned.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Ownership</TableHead>
                <TableHead>Entitled</TableHead>
                <TableHead>Delivered</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(ents as Ent[]).map((e) => {
                const remaining = Math.max(0, e.quantity_entitled - e.quantity_delivered);
                const pct = e.quantity_entitled
                  ? Math.min(100, Math.round((e.quantity_delivered * 100) / e.quantity_entitled))
                  : 0;
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="font-medium">{e.item?.name_en}</div>
                      <Badge variant="secondary" className="text-xs">
                        {e.item?.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{e.ownership_mode}</Badge>
                    </TableCell>
                    <TableCell className="font-mono">{e.quantity_entitled}</TableCell>
                    <TableCell className="font-mono">{e.quantity_delivered}</TableCell>
                    <TableCell className="font-mono">
                      <span className={remaining === 0 ? "text-muted-foreground" : "font-semibold"}>
                        {remaining}
                      </span>
                    </TableCell>
                    <TableCell className="w-40">
                      <Progress value={pct} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {ents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No entitlements — the enrolled plan has no device matrix, or no enrollment exists.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Extra issuances</CardTitle>
          <CardDescription>
            Requests to hand out items beyond package entitlement. Admin approval required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requested</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Charge</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(extras as Extra[]).map((x) => (
                <TableRow key={x.id}>
                  <TableCell className="text-xs">
                    {new Date(x.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-medium">{x.item?.name_en}</TableCell>
                  <TableCell className="font-mono">{x.quantity}</TableCell>
                  <TableCell className="text-sm">{x.reason}</TableCell>
                  <TableCell>
                    {x.chargeable ? `৳${Number(x.amount_bdt).toLocaleString()}` : "Free"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        x.status === "approved" || x.status === "consumed"
                          ? "default"
                          : x.status === "rejected"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {x.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canApprove && x.status === "pending" && (
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => decide.mutate({ id: x.id, decision: "approved" })}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => decide.mutate({ id: x.id, decision: "rejected" })}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {extras.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    None.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assigned</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Origin</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(assigns as unknown as Assign[]).map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{new Date(a.assigned_at).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{a.item?.name_en ?? "—"}</TableCell>
                  <TableCell className="font-mono">{a.quantity}</TableCell>
                  <TableCell>
                    {a.expires_at ? new Date(a.expires_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    {a.extra_issuance_id ? (
                      <Badge variant="outline">extra issuance</Badge>
                    ) : (
                      <Badge variant="secondary">entitlement</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.status === "active" ? "default" : "secondary"}>
                      {a.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {assigns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    None.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Inline "Request extra issuance" form ----------
export function RequestExtraIssuanceForm({
  patientId,
  itemId,
  suggestedQty,
  onCreated,
}: {
  patientId: string;
  itemId: string;
  suggestedQty: number;
  onCreated: (id: string) => void;
}) {
  const fn = useServerFn(requestExtraIssuance);
  const [quantity, setQuantity] = useState(suggestedQty);
  const [reason, setReason] = useState("");
  const [chargeable, setChargeable] = useState(false);
  const [amount, setAmount] = useState(0);

  const mut = useMutation({
    mutationFn: () =>
      fn({
        data: {
          patient_id: patientId,
          item_id: itemId,
          quantity,
          reason,
          chargeable,
          amount_bdt: amount,
        },
      }),
    onSuccess: (res) => {
      toast.success("Extra issuance requested. Await admin approval, then re-assign.");
      onCreated(res.id);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="border rounded p-3 space-y-2 bg-amber-50/40">
      <div className="text-sm font-medium">Request extra issuance</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs">Quantity</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value))))}
            className="w-full border rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="text-xs">Amount ৳ (if chargeable)</label>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            className="w-full border rounded px-2 py-1 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="text-xs">Reason</label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full border rounded px-2 py-1 text-sm"
          placeholder="e.g. Doctor prescribed extra sensors"
        />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={chargeable}
          onChange={(e) => setChargeable(e.target.checked)}
        />
        Chargeable
      </label>
      <div className="flex justify-end">
        <Button size="sm" disabled={!reason || mut.isPending} onClick={() => mut.mutate()}>
          Submit request
        </Button>
      </div>
    </div>
  );
}
