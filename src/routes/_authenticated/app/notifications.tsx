import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  listNotificationRules,
  updateNotificationRule,
} from "@/lib/ops.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { NotificationTemplatesTab } from "@/components/app/notification-templates-tab";
import { NotificationSettingsTab } from "@/components/app/notification-settings-tab";
import { NotificationLogTab } from "@/components/app/notification-log-tab";

export const Route = createFileRoute("/_authenticated/app/notifications")({
  component: NotificationsPage,
  errorComponent: ({ error }) => <div className="p-4 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-4">Not found</div>,
});

function NotificationsPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Notifications</h1>
      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="log">Delivery log</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="inbox"><Inbox /></TabsContent>
        <TabsContent value="rules"><Rules /></TabsContent>
        <TabsContent value="templates"><NotificationTemplatesTab /></TabsContent>
        <TabsContent value="log"><NotificationLogTab /></TabsContent>
        <TabsContent value="settings"><NotificationSettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function Inbox() {
  const qc = useQueryClient();
  const router = useRouter();
  const list = useServerFn(listMyNotifications);
  const mark = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);
  const { data = [] } = useQuery({ queryKey: ["notifs"], queryFn: () => list() });
  const markMut = useMutation({
    mutationFn: (id: string) => mark({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifs"] });
      qc.invalidateQueries({ queryKey: ["notif-unread"] });
      router.invalidate();
    },
  });
  const markAllMut = useMutation({
    mutationFn: () => markAll(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifs"] });
      qc.invalidateQueries({ queryKey: ["notif-unread"] });
    },
  });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Inbox</CardTitle>
        <Button size="sm" variant="outline" onClick={() => markAllMut.mutate()}>Mark all read</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.length === 0 && <p className="text-sm text-muted-foreground">No notifications.</p>}
        {data.map((n: {
          id: string; title: string; body?: string | null; event_type: string;
          read_at?: string | null; created_at: string;
        }) => (
          <div key={n.id} className={`flex items-start justify-between gap-3 border rounded-md p-3 ${n.read_at ? "opacity-60" : ""}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-medium truncate">{n.title}</div>
                <Badge variant="outline" className="text-xs">{n.event_type}</Badge>
              </div>
              {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
              <div className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
            </div>
            {!n.read_at && (
              <Button size="sm" variant="ghost" onClick={() => markMut.mutate(n.id)}>Mark read</Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Rules() {
  const qc = useQueryClient();
  const list = useServerFn(listNotificationRules);
  const upd = useServerFn(updateNotificationRule);
  const { data = [] } = useQuery({ queryKey: ["notif-rules"], queryFn: () => list() });
  const mut = useMutation({
    mutationFn: (v: { id: string; is_active?: boolean }) => upd({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notif-rules"] }),
  });
  return (
    <Card>
      <CardHeader><CardTitle>Reminder rules</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {data.map((r: { id: string; event_type: string; offsets_days: number[]; channels: string[]; is_active: boolean }) => (
          <div key={r.id} className="flex items-center justify-between border rounded-md p-3">
            <div>
              <div className="font-medium">{r.event_type}</div>
              <div className="text-xs text-muted-foreground">
                Offsets (days): {r.offsets_days.join(", ")} · Channels: {r.channels.join(", ")}
              </div>
            </div>
            <Switch
              checked={r.is_active}
              onCheckedChange={(v) => mut.mutate({ id: r.id, is_active: v })}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
