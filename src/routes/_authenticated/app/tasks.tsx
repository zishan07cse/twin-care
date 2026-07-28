import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyTasks, updateTask, createTask, generateMyDayTasks } from "@/lib/ops.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/app/tasks")({
  component: TasksPage,
  errorComponent: ({ error }) => <div className="p-4 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-4">Not found</div>,
});

const priorityColor: Record<string, string> = {
  urgent: "bg-destructive text-destructive-foreground",
  high: "bg-amber-500 text-white",
  normal: "bg-secondary",
  low: "bg-muted",
};

function TasksPage() {
  const qc = useQueryClient();
  const list = useServerFn(listMyTasks);
  const upd = useServerFn(updateTask);
  const create = useServerFn(createTask);
  const gen = useServerFn(generateMyDayTasks);
  const { data = [] } = useQuery({ queryKey: ["tasks"], queryFn: () => list({ data: {} }) });
  const [title, setTitle] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["tasks"] });
  const done = useMutation({ mutationFn: (id: string) => upd({ data: { id, status: "done" } }), onSuccess: invalidate });
  const createMut = useMutation({
    mutationFn: () => create({ data: { title, priority: "normal" } }),
    onSuccess: () => { setTitle(""); invalidate(); },
  });
  const genMut = useMutation({ mutationFn: () => gen(), onSuccess: invalidate });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Day</h1>
        <Button onClick={() => genMut.mutate()} disabled={genMut.isPending} variant="outline">
          {genMut.isPending ? "Scanning…" : "Auto-generate tasks"}
        </Button>
      </div>
      <Card>
        <CardHeader><CardTitle>New task</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Button onClick={() => createMut.mutate()} disabled={!title || createMut.isPending}>Add</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Open tasks ({data.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.length === 0 && <p className="text-sm text-muted-foreground">Inbox zero.</p>}
          {data.map((t: { id: string; title: string; description?: string | null; due_at?: string | null; priority: string; source?: string | null }) => (
            <div key={t.id} className="flex items-start justify-between gap-3 border rounded-md p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{t.title}</span>
                  <Badge className={priorityColor[t.priority] ?? ""}>{t.priority}</Badge>
                  {t.source && <Badge variant="outline" className="text-xs">{t.source}</Badge>}
                </div>
                {t.description && <div className="text-sm text-muted-foreground">{t.description}</div>}
                {t.due_at && <div className="text-xs text-muted-foreground mt-1">Due {new Date(t.due_at).toLocaleString()}</div>}
              </div>
              <Button size="sm" variant="outline" onClick={() => done.mutate(t.id)}>Done</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
