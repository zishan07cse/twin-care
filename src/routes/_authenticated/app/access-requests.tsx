import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, ROLE_LABELS, type AppRole } from "@/lib/auth";
import {
  listAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
  resendInvite,
} from "@/lib/access.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, MailCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/access-requests")({
  component: AccessRequestsPage,
});

function AccessRequestsPage() {
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["super_admin", "admin"]);

  const list = useServerFn(listAccessRequests);
  const approve = useServerFn(approveAccessRequest);
  const reject = useServerFn(rejectAccessRequest);
  const resend = useServerFn(resendInvite);
  const qc = useQueryClient();

  const { data: requests, isLoading, error } = useQuery({
    queryKey: ["access_requests"],
    queryFn: () => list(),
    enabled: canManage,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["access_requests"] });

  const approveMut = useMutation({
    mutationFn: (id: string) =>
      approve({ data: { id, redirect_origin: window.location.origin } }),
    onSuccess: () => {
      toast.success("Invite email sent");
      invalidate();
    },
    onError: (e) => toast.error("Approval failed", { description: (e as Error).message }),
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => reject({ data: { id } }),
    onSuccess: () => {
      toast.success("Request rejected");
      invalidate();
    },
    onError: (e) => toast.error("Reject failed", { description: (e as Error).message }),
  });

  const resendMut = useMutation({
    mutationFn: (id: string) =>
      resend({ data: { id, redirect_origin: window.location.origin } }),
    onSuccess: () => toast.success("Invite resent"),
    onError: (e) => toast.error("Resend failed", { description: (e as Error).message }),
  });

  if (!canManage) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Access requests</CardTitle>
            <CardDescription>Only super admins and admins can view this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Access requests</h1>
        <p className="text-sm text-muted-foreground">
          Approve requests to send an email invite. The user sets their password from the link.
        </p>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading...</div>}
      {error && (
        <div className="text-sm text-destructive">
          Failed to load: {(error as Error).message}
        </div>
      )}

      {requests && requests.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No access requests yet.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {requests?.map((r) => (
          <Card key={r.id}>
            <CardContent className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-medium">{r.full_name}</div>
                  <Badge variant="outline">{ROLE_LABELS[r.requested_role as AppRole].en}</Badge>
                  <StatusBadge status={r.status} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.email}
                  {r.phone ? ` · ${r.phone}` : ""}
                </div>
                {r.message && <div className="text-sm mt-1">{r.message}</div>}
                <div className="text-[11px] text-muted-foreground">
                  Requested {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {r.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => approveMut.mutate(r.id)}
                      disabled={approveMut.isPending}
                    >
                      <Check className="h-4 w-4 mr-1" /> Approve & invite
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectMut.mutate(r.id)}
                      disabled={rejectMut.isPending}
                    >
                      <X className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </>
                )}
                {(r.status === "approved" || r.status === "completed") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resendMut.mutate(r.id)}
                    disabled={resendMut.isPending}
                  >
                    <MailCheck className="h-4 w-4 mr-1" /> Resend invite
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "Pending", variant: "secondary" },
    approved: { label: "Invited", variant: "default" },
    completed: { label: "Active", variant: "default" },
    rejected: { label: "Rejected", variant: "destructive" },
  };
  const m = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
