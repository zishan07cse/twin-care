import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Wrench } from "lucide-react";

export function ComingSoon({ titleKey }: { titleKey: string }) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t(titleKey)}</h1>
      <Card>
        <CardContent className="py-16 flex flex-col items-center text-center text-muted-foreground">
          <Wrench className="h-8 w-8 mb-3 text-primary" />
          <div className="font-medium text-foreground">Coming in the next phase</div>
          <div className="text-sm mt-1 max-w-md">
            This module lands in Phase 1 or Phase 2 of the build plan. The foundation
            (auth, roles, RLS, design system, i18n, shell) is in place — approve the
            next phase to start shipping it.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
