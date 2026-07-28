import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listAuditLog,
  listAuditTables,
  listBackups,
  createBackupSnapshot,
  getBackupDownloadUrl,
  deleteBackup,
} from "@/lib/audit.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, RefreshCw, Trash2, Database, ScrollText, Eye } from "lucide-react";
import { formatDateBD } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/app/audit")({
  component: AuditPage,
  errorComponent: ({ error }) => <div className="p-4 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-4">Not found</div>,
});

type AuditRow = {
  id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  actor: string | null;
  before: unknown;
  after: unknown;
  created_at: string;
};

const actionColor: Record<string, string> = {
  insert: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  update: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  delete: "bg-destructive/15 text-destructive border-destructive/30",
};

function AuditPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Audit & Backups</h1>
      <Tabs defaultValue="audit">
        <TabsList>
          <TabsTrigger value="audit" className="gap-2">
            <ScrollText className="h-4 w-4" /> Audit log
          </TabsTrigger>
          <TabsTrigger value="backups" className="gap-2">
            <Database className="h-4 w-4" /> Backups
          </TabsTrigger>
        </TabsList>
        <TabsContent value="audit" className="mt-4">
          <AuditTab />
        </TabsContent>
        <TabsContent value="backups" className="mt-4">
          <BackupsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AuditTab() {
  const listFn = useServerFn(listAuditLog);
  const tablesFn = useServerFn(listAuditTables);
  const [table, setTable] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const { data: tables = [] } = useQuery({
    queryKey: ["audit-tables"],
    queryFn: () => tablesFn(),
  });

  const { data: rows = [], isFetching, refetch } = useQuery({
    queryKey: ["audit-log", table, action, from, to],
    queryFn: () =>
      listFn({
        data: {
          table_name: table === "all" ? undefined : table,
          action: action === "all" ? undefined : action,
          from: from ? new Date(from).toISOString() : undefined,
          to: to ? new Date(to).toISOString() : undefined,
        },
      }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap gap-2 items-end justify-between">
          <CardTitle>Change history</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-3">
          <Select value={table} onValueChange={setTable}>
            <SelectTrigger><SelectValue placeholder="Table" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tables</SelectItem>
              {tables.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="insert">Insert</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2">When</th>
                <th>Table</th>
                <th>Action</th>
                <th>Record</th>
                <th>Actor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(rows as AuditRow[]).map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/40">
                  <td className="py-2 whitespace-nowrap">{formatDateBD(r.created_at)}</td>
                  <td className="font-mono text-xs">{r.table_name}</td>
                  <td>
                    <Badge variant="outline" className={actionColor[r.action] ?? ""}>
                      {r.action}
                    </Badge>
                  </td>
                  <td className="font-mono text-xs truncate max-w-[160px]">{r.record_id ?? "—"}</td>
                  <td className="font-mono text-xs truncate max-w-[160px]">{r.actor ?? "system"}</td>
                  <td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No entries.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selected?.action} · {selected?.table_name}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="grid md:grid-cols-2 gap-4 text-xs">
              <div>
                <div className="font-semibold mb-1">Before</div>
                <pre className="bg-muted p-3 rounded max-h-96 overflow-auto">
                  {selected.before ? JSON.stringify(selected.before, null, 2) : "—"}
                </pre>
              </div>
              <div>
                <div className="font-semibold mb-1">After</div>
                <pre className="bg-muted p-3 rounded max-h-96 overflow-auto">
                  {selected.after ? JSON.stringify(selected.after, null, 2) : "—"}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function BackupsTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listBackups);
  const createFn = useServerFn(createBackupSnapshot);
  const urlFn = useServerFn(getBackupDownloadUrl);
  const delFn = useServerFn(deleteBackup);

  const { data: backups = [], isFetching } = useQuery({
    queryKey: ["backups"],
    queryFn: () => listFn(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["backups"] });
  const create = useMutation({ mutationFn: () => createFn(), onSuccess: invalidate });
  const remove = useMutation({
    mutationFn: (name: string) => delFn({ data: { name } }),
    onSuccess: invalidate,
  });

  async function download(name: string) {
    const { url } = await urlFn({ data: { name } });
    window.open(url, "_blank");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>About backups</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Lovable Cloud takes <strong>platform-level daily backups</strong> of your database automatically —
            use those for real disaster recovery.
          </p>
          <p>
            This page adds <strong>on-demand and nightly JSON snapshots</strong> of every business table,
            stored in a private storage bucket only admins can read. Download them for offsite archival
            or spot-restores through your data tools.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Snapshots</CardTitle>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              <Database className="h-4 w-4 mr-2" />
              {create.isPending ? "Creating…" : "Create snapshot now"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isFetching && backups.length === 0 && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2">Created</th>
                  <th>File</th>
                  <th>Size</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.name} className="border-b">
                    <td className="py-2 whitespace-nowrap">{formatDateBD(b.created_at)}</td>
                    <td className="font-mono text-xs">{b.name}</td>
                    <td>{(b.size / 1024).toFixed(1)} KB</td>
                    <td className="text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={() => download(b.name)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm(`Delete snapshot ${b.name}?`)) remove.mutate(b.name);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {backups.length === 0 && !isFetching && (
                  <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">
                    No snapshots yet. Nightly backups run at 02:00 Asia/Dhaka.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
