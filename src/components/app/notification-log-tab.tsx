import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listNotificationLog, retryFailedNotification } from "@/lib/notifications.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type LogRow = {
  id: string;
  sent_at: string;
  channel: string;
  event_type: string;
  template_key: string | null;
  status: string;
  error: string | null;
  attempt: number;
  patient?: { patient_code: string; full_name_en?: string } | null;
};

export function NotificationLogTab() {
  const qc = useQueryClient();
  const list = useServerFn(listNotificationLog);
  const retry = useServerFn(retryFailedNotification);
  const { data = [] } = useQuery<LogRow[]>({
    queryKey: ["notif-log"],
    queryFn: () => list({ data: {} }) as Promise<LogRow[]>,
    refetchInterval: 15_000,
  });
  const retryMut = useMutation({
    mutationFn: (log_id: string) => retry({ data: { log_id } }),
    onSuccess: () => {
      toast.success("Retry dispatched");
      qc.invalidateQueries({ queryKey: ["notif-log"] });
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Delivery log</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.length === 0 && (
          <p className="text-sm text-muted-foreground">No delivery attempts yet.</p>
        )}
        {data.map((r) => (
          <div
            key={r.id}
            className="flex items-start justify-between gap-3 border rounded-md p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{r.channel}</Badge>
                <Badge variant="secondary">{r.event_type}</Badge>
                <Badge
                  variant={
                    r.status === "sent"
                      ? "default"
                      : r.status === "failed"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {r.status}
                </Badge>
                {r.patient && (
                  <span className="text-xs text-muted-foreground">
                    {r.patient.patient_code}
                  </span>
                )}
              </div>
              {r.error && <div className="text-xs text-destructive mt-1">{r.error}</div>}
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(r.sent_at).toLocaleString()} · {r.template_key ?? "—"}
              </div>
            </div>
            {r.status === "failed" && (
              <Button size="sm" variant="outline" onClick={() => retryMut.mutate(r.id)}>
                Retry
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
