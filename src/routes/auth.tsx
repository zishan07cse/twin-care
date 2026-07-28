import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  getBootstrapStatus,
  submitAccessRequest,
  REQUESTABLE_ROLE_VALUES,
} from "@/lib/access.functions";
import { ROLE_LABELS, type AppRole } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { session, loading } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const checkBootstrap = useServerFn(getBootstrapStatus);
  const [needsBootstrap, setNeedsBootstrap] = useState<boolean | null>(null);

  useEffect(() => {
    checkBootstrap()
      .then((r) => setNeedsBootstrap(r.needsBootstrap))
      .catch(() => setNeedsBootstrap(false));
  }, [checkBootstrap]);

  if (!loading && session) return <Navigate to="/app" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="mx-auto h-11 w-11 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
            T
          </div>
          <div className="mt-3 font-semibold">{t("app.name")}</div>
          <div className="text-xs text-muted-foreground">by Experto</div>
        </div>

        <Card className="shadow-elev">
          {needsBootstrap === null ? (
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {t("common.loading")}
            </CardContent>
          ) : needsBootstrap ? (
            <>
              <CardHeader>
                <CardTitle>Create Super Admin</CardTitle>
                <CardDescription>
                  This is the first account on the platform. It will be granted Super Admin
                  privileges.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BootstrapForm onSuccess={() => navigate({ to: "/app", replace: true })} />
              </CardContent>
            </>
          ) : (
            <Tabs defaultValue="signin">
              <CardHeader>
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger value="signin">Sign in</TabsTrigger>
                  <TabsTrigger value="request">Request access</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent>
                <TabsContent value="signin">
                  <SignInForm onSuccess={() => navigate({ to: "/app", replace: true })} />
                </TabsContent>
                <TabsContent value="request">
                  <RequestAccessForm />
                </TabsContent>
              </CardContent>
            </Tabs>
          )}
        </Card>
      </div>
    </div>
  );
}

function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(t("auth.error"), { description: error.message });
      return;
    }
    onSuccess();
  }

  async function forgotPassword() {
    if (!email) {
      toast.error("Enter your email first", {
        description: "Type your email above, then click Forgot password.",
      });
      return;
    }
    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/set-password`,
    });
    setResetting(false);
    if (error) {
      toast.error("Could not send reset email", { description: error.message });
      return;
    }
    toast.success("Reset email sent", {
      description: "Check your inbox for a link to set a new password.",
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <CardTitle>{t("auth.welcome")}</CardTitle>
      <div className="space-y-2">
        <Label htmlFor="email">{t("auth.email")}</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <button
            type="button"
            onClick={forgotPassword}
            disabled={resetting}
            className="text-xs text-primary hover:underline disabled:opacity-50"
          >
            {resetting ? "Sending..." : "Forgot password?"}
          </button>
        </div>
        <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? t("common.loading") : t("auth.signIn")}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        No account? Switch to <span className="font-medium">Request access</span> above. A super admin
        will review and email you an invitation.
      </p>
    </form>
  );
}


function BootstrapForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useI18n();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, phone },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(t("auth.error"), { description: error.message });
      return;
    }
    toast.success("Super admin created", { description: "You are signed in." });
    onSuccess();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">{t("auth.fullName")}</Label>
        <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">{t("auth.phone")}</Label>
        <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">{t("auth.email")}</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("auth.password")}</Label>
        <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? t("common.loading") : "Create super admin"}
      </Button>
    </form>
  );
}

function RequestAccessForm() {
  const submit = useServerFn(submitAccessRequest);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<AppRole | "">("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) {
      toast.error("Please select a role");
      return;
    }
    setBusy(true);
    try {
      await submit({
        data: {
          email,
          full_name: fullName,
          phone,
          requested_role: role as (typeof REQUESTABLE_ROLE_VALUES)[number],
          message,
        },
      });
      setSent(true);
      toast.success("Request submitted", {
        description: "A super admin will review shortly. You'll get an email invite once approved.",
      });
    } catch (err) {
      toast.error("Could not submit request", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="py-6 text-center space-y-2">
        <div className="text-lg font-medium">Request received</div>
        <p className="text-sm text-muted-foreground">
          A super admin will review your request. Once approved, we'll email you a secure link to set
          your password and access the platform.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <CardTitle>Request access</CardTitle>
      <CardDescription>
        Fill in your details and the role you need. A super admin will review and email you an invite
        link.
      </CardDescription>
      <div className="space-y-2">
        <Label htmlFor="req-name">Full name</Label>
        <Input id="req-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="req-email">Email</Label>
        <Input id="req-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="req-phone">Phone</Label>
        <Input id="req-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="req-role">Requested role</Label>
        <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
          <SelectTrigger id="req-role">
            <SelectValue placeholder="Select a role" />
          </SelectTrigger>
          <SelectContent>
            {REQUESTABLE_ROLE_VALUES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r].en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="req-msg">Message (optional)</Label>
        <Textarea
          id="req-msg"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Anything the admin should know..."
          maxLength={1000}
        />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Submitting..." : "Submit request"}
      </Button>
    </form>
  );
}
