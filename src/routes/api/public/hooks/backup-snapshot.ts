// Cron hook: nightly DB snapshot to the db-backups Storage bucket.
// Called by pg_cron with the Supabase anon key in the `apikey` header.
import { createFileRoute } from "@tanstack/react-router";
import { runSnapshot } from "@/lib/audit.functions";

export const Route = createFileRoute("/api/public/hooks/backup-snapshot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        const apikey = request.headers.get("apikey");
        if (!expected || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const result = await runSnapshot(null);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[backup-snapshot] failed:", message);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
