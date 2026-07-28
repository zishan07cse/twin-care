import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { unreadNotificationCount } from "@/lib/ops.functions";

export function NotificationBell() {
  const fn = useServerFn(unreadNotificationCount);
  const { data: count } = useQuery({
    queryKey: ["notif-unread"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });
  return (
    <Button asChild variant="ghost" size="sm" className="relative">
      <Link to="/app/notifications">
        <Bell className="h-4 w-4" />
        {(count ?? 0) > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center px-1">
            {count}
          </span>
        )}
      </Link>
    </Button>
  );
}
