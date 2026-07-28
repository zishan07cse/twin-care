import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listPackageEntitlements,
  upsertPackageEntitlement,
  deletePackageEntitlement,
} from "@/lib/entitlements.functions";
import { listInventoryItems } from "@/lib/inventory.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

type ItemLite = { id: string; name_en: string; category: string };

export function PackageDevicesDialog({
  planId,
  planName,
  open,
  onOpenChange,
}: {
  planId: string | null;
  planName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listPackageEntitlements);
  const upsertFn = useServerFn(upsertPackageEntitlement);
  const delFn = useServerFn(deletePackageEntitlement);
  const listItemsFn = useServerFn(listInventoryItems);

  const { data: rows = [] } = useQuery({
    queryKey: ["pkg-entitlements", planId],
    queryFn: () => listFn({ data: { plan_id: planId! } }),
    enabled: !!planId && open,
  });
  const { data: items = [] } = useQuery({
    queryKey: ["inventory-items-lite"],
    queryFn: () => listItemsFn(),
    enabled: open,
  });

  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState(1);
  const [ownership, setOwnership] = useState<"free" | "deposit" | "sold">("free");
  const [deposit, setDeposit] = useState(0);

  const add = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          values: {
            plan_id: planId!,
            item_id: itemId,
            quantity: qty,
            ownership_mode: ownership,
            deposit_bdt: deposit,
          },
        },
      }),
    onSuccess: () => {
      toast.success("Added");
      qc.invalidateQueries({ queryKey: ["pkg-entitlements", planId] });
      setItemId("");
      setQty(1);
      setDeposit(0);
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pkg-entitlements", planId] }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Device matrix · {planName}</DialogTitle>
          <DialogDescription>
            Items and quantities included in this package. New enrollments snapshot this matrix;
            edits only apply to future enrollments.
          </DialogDescription>
        </DialogHeader>

        <div className="border rounded">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2 px-3">Item</th>
                <th className="px-3">Qty</th>
                <th className="px-3">Ownership</th>
                <th className="px-3">Deposit ৳</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    No items yet.
                  </td>
                </tr>
              )}
              {(rows as unknown[]).map((r) => {
                const row = r as {
                  id: string;
                  quantity: number;
                  ownership_mode: string;
                  deposit_bdt: number;
                  item: { name_en: string; category: string } | null;
                };
                return (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="py-2 px-3">
                      <div className="font-medium">{row.item?.name_en}</div>
                      <Badge variant="secondary" className="text-xs">
                        {row.item?.category}
                      </Badge>
                    </td>
                    <td className="px-3 font-mono">{row.quantity}</td>
                    <td className="px-3">
                      <Badge variant="outline">{row.ownership_mode}</Badge>
                    </td>
                    <td className="px-3 font-mono">
                      {Number(row.deposit_bdt).toLocaleString()}
                    </td>
                    <td className="px-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => remove.mutate(row.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border rounded p-3 space-y-2">
          <div className="text-sm font-medium">Add item</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 space-y-1">
              <Label>Item</Label>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick an inventory item" />
                </SelectTrigger>
                <SelectContent>
                  {(items as ItemLite[]).map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name_en} · {i.category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={0}
                value={qty}
                onChange={(e) => setQty(Math.max(0, Math.floor(Number(e.target.value))))}
              />
            </div>
            <div className="space-y-1">
              <Label>Ownership</Label>
              <Select value={ownership} onValueChange={(v) => setOwnership(v as "free")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free with package</SelectItem>
                  <SelectItem value="deposit">Refundable deposit</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {ownership === "deposit" && (
              <div className="space-y-1 col-span-2">
                <Label>Deposit (৳)</Label>
                <Input
                  type="number"
                  min={0}
                  value={deposit}
                  onChange={(e) => setDeposit(Number(e.target.value) || 0)}
                />
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button size="sm" disabled={!itemId || add.isPending} onClick={() => add.mutate()}>
              <Plus className="h-4 w-4 mr-1" />
              Add / update
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
