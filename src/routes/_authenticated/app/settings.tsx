import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, Plus, KeyRound, UserPlus } from "lucide-react";
import {
  getMyProfile,
  updateMyProfile,
  listUsersWithRoles,
  grantRole,
  revokeRole,
  setUserRole,
  adminResetUserPassword,
  adminCreateUser,
  ROLE_VALUES,
} from "@/lib/settings.functions";
import { useAuth, ROLE_LABELS, type AppRole } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useI18n();
  const { hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole(["super_admin", "admin"]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.settings")}</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile and, if permitted, user access.</p>
      </div>

      <ProfileCard />
      {isAdmin && <UsersCard />}
    </div>
  );
}

function ProfileCard() {
  const fetchFn = useServerFn(getMyProfile);
  const updateFn = useServerFn(updateMyProfile);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["me", "profile"], queryFn: () => fetchFn() });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [lang, setLang] = useState<"en" | "bn">("en");

  useEffect(() => {
    if (data) {
      setFullName(data.full_name ?? "");
      setPhone(data.phone ?? "");
      setLang((data.preferred_language as "en" | "bn") ?? "en");
    }
  }, [data]);

  const mut = useMutation({
    mutationFn: () =>
      updateFn({ data: { full_name: fullName, phone, preferred_language: lang } }),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["me", "profile"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">My profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-w-lg">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Preferred language</Label>
              <Select value={lang} onValueChange={(v) => setLang(v as "en" | "bn")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="bn">বাংলা</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
              {mut.isPending ? "Saving…" : "Save changes"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function UsersCard() {
  const { locale } = useI18n();
  const { user: me, hasRole } = useAuth();
  const isSuper = hasRole("super_admin");
  const listFn = useServerFn(listUsersWithRoles);
  const grantFn = useServerFn(grantRole);
  const revokeFn = useServerFn(revokeRole);
  const setRoleFn = useServerFn(setUserRole);
  const resetPwFn = useServerFn(adminResetUserPassword);
  const createUserFn = useServerFn(adminCreateUser);
  const qc = useQueryClient();
  const [resetTarget, setResetTarget] = useState<{ id: string; email: string; name: string } | null>(null);
  const [newPw, setNewPw] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState<{
    email: string;
    full_name: string;
    phone: string;
    temp_password: string;
    role: AppRole | "none";
    send_invite_email: boolean;
  }>({ email: "", full_name: "", phone: "", temp_password: "", role: "care_coordinator", send_invite_email: true });

  function genPassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let out = "";
    for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
    setNewUser((s) => ({ ...s, temp_password: out }));
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["settings", "users"],
    queryFn: () => listFn(),
  });

  const [selectedRole, setSelectedRole] = useState<Record<string, AppRole>>({});

  const grantMut = useMutation({
    mutationFn: (v: { user_id: string; role: AppRole }) => grantFn({ data: v }),
    onSuccess: () => {
      toast.success("Role granted");
      qc.invalidateQueries({ queryKey: ["settings", "users"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const revokeMut = useMutation({
    mutationFn: (v: { user_id: string; role: AppRole }) => revokeFn({ data: v }),
    onSuccess: () => {
      toast.success("Role removed");
      qc.invalidateQueries({ queryKey: ["settings", "users"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const setRoleMut = useMutation({
    mutationFn: (v: { user_id: string; role: AppRole }) => setRoleFn({ data: v }),
    onSuccess: () => {
      toast.success("Role changed");
      qc.invalidateQueries({ queryKey: ["settings", "users"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });


  const resetPwMut = useMutation({
    mutationFn: (v: { user_id: string; new_password?: string; send_reset_email?: boolean }) =>
      resetPwFn({ data: v }),
    onSuccess: (r: any) => {
      toast.success(r?.mode === "email" ? "Reset email sent" : "Password updated");
      setResetTarget(null);
      setNewPw("");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const createUserMut = useMutation({
    mutationFn: () =>
      createUserFn({
        data: {
          email: newUser.email,
          full_name: newUser.full_name,
          phone: newUser.phone,
          temp_password: newUser.temp_password,
          role: newUser.role === "none" ? undefined : newUser.role,
          send_invite_email: newUser.send_invite_email,
        },
      }),
    onSuccess: (r: any) => {
      toast.success(
        r?.invite_sent
          ? "User created — invite email sent"
          : "User created (invite email not sent)",
      );
      setCreateOpen(false);
      setNewUser({
        email: "",
        full_name: "",
        phone: "",
        temp_password: "",
        role: "care_coordinator",
        send_invite_email: true,
      });
      qc.invalidateQueries({ queryKey: ["settings", "users"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const assignableRoles = (ROLE_VALUES as readonly string[]).filter(
    (r) => isSuper || r !== "super_admin",
  ) as AppRole[];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">User access</CardTitle>
        {isSuper && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Create user
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="text-sm text-destructive">Failed to load users.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground text-left">
                <tr>
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Roles</th>
                  <th className="py-2 pr-3">Last sign-in</th>
                  <th className="py-2 pr-3">Add role</th>
                  {isSuper && <th className="py-2 pr-3">Change role</th>}
                  {isSuper && <th className="py-2">Password</th>}
                </tr>
              </thead>
              <tbody>
                {data!.map((u) => {
                  const isSelf = u.id === me?.id;
                  const avail = assignableRoles.filter((r) => !u.roles.includes(r));
                  const pick = selectedRole[u.id] ?? avail[0];
                  return (
                    <tr key={u.id} className="border-t align-top">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{u.profile?.full_name ?? u.email}</div>
                        <div className="text-xs text-muted-foreground">{u.email}{isSelf ? " · you" : ""}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-1.5">
                          {u.roles.length === 0 && (
                            <span className="text-xs text-muted-foreground">No roles</span>
                          )}
                          {u.roles.map((r) => (
                            <span
                              key={r}
                              className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs"
                            >
                              {ROLE_LABELS[r as AppRole]?.[locale] ?? r}
                              {(isSuper || r !== "super_admin") && !(isSelf && (r === "admin" || r === "super_admin")) && (
                                <button
                                  onClick={() => revokeMut.mutate({ user_id: u.id, role: r as AppRole })}
                                  className="text-muted-foreground hover:text-destructive"
                                  aria-label={`Remove ${r}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "—"}
                      </td>
                      <td className="py-2">
                        {avail.length === 0 ? (
                          <span className="text-xs text-muted-foreground">All granted</span>
                        ) : (
                          <div className="flex gap-2">
                            <Select
                              value={pick}
                              onValueChange={(v) =>
                                setSelectedRole((prev) => ({ ...prev, [u.id]: v as AppRole }))
                              }
                            >
                              <SelectTrigger className="h-8 w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {avail.map((r) => (
                                  <SelectItem key={r} value={r}>
                                    {ROLE_LABELS[r]?.[locale] ?? r}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                grantMut.mutate({ user_id: u.id, role: pick })
                              }
                              disabled={grantMut.isPending}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </td>
                      {isSuper && (
                        <td className="py-2 pr-3">
                          <Select
                            value=""
                            onValueChange={(v) => {
                              if (!v) return;
                              if (isSelf && v !== "super_admin") {
                                toast.error("You cannot change your own super_admin role");
                                return;
                              }
                              if (confirm(`Replace all roles with "${ROLE_LABELS[v as AppRole]?.[locale] ?? v}"?`)) {
                                setRoleMut.mutate({ user_id: u.id, role: v as AppRole });
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 w-40">
                              <SelectValue placeholder="Change to…" />
                            </SelectTrigger>
                            <SelectContent>
                              {assignableRoles.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {ROLE_LABELS[r]?.[locale] ?? r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      )}
                      {isSuper && (
                        <td className="py-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setResetTarget({
                                id: u.id,
                                email: u.email,
                                name: u.profile?.full_name ?? u.email,
                              })
                            }
                          >
                            <KeyRound className="h-3.5 w-3.5 mr-1" />
                            Reset
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!resetTarget} onOpenChange={(o) => { if (!o) { setResetTarget(null); setNewPw(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
          </DialogHeader>
          {resetTarget && (
            <div className="space-y-4">
              <div className="text-sm">
                <div className="font-medium">{resetTarget.name}</div>
                <div className="text-muted-foreground text-xs">{resetTarget.email}</div>
              </div>
              <div className="space-y-2">
                <Label>New password</Label>
                <Input
                  type="text"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="At least 8 characters"
                />
                <p className="text-xs text-muted-foreground">
                  Set a new password directly, or send the user a reset email instead.
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() =>
                resetTarget &&
                resetPwMut.mutate({ user_id: resetTarget.id, send_reset_email: true })
              }
              disabled={resetPwMut.isPending}
            >
              Send reset email
            </Button>
            <Button
              onClick={() =>
                resetTarget &&
                resetPwMut.mutate({ user_id: resetTarget.id, new_password: newPw })
              }
              disabled={resetPwMut.isPending || newPw.length < 8}
            >
              {resetPwMut.isPending ? "Saving…" : "Set password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="jane@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone (optional)</Label>
              <Input
                value={newUser.phone}
                onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Temporary password</Label>
              <div className="flex gap-2">
                <Input
                  value={newUser.temp_password}
                  onChange={(e) => setNewUser({ ...newUser, temp_password: e.target.value })}
                  placeholder="At least 8 characters"
                />
                <Button type="button" variant="outline" onClick={genPassword}>
                  Generate
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this with the user securely. They'll set their own password after signing in via the invite email.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Initial role</Label>
              <Select
                value={newUser.role}
                onValueChange={(v) => setNewUser({ ...newUser, role: v as AppRole | "none" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No role (add later)</SelectItem>
                  {assignableRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]?.[locale] ?? r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newUser.send_invite_email}
                onChange={(e) =>
                  setNewUser({ ...newUser, send_invite_email: e.target.checked })
                }
              />
              Send invite email with password reset link
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createUserMut.mutate()}
              disabled={
                createUserMut.isPending ||
                !newUser.email ||
                !newUser.full_name ||
                newUser.temp_password.length < 8
              }
            >
              {createUserMut.isPending ? "Creating…" : "Create user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

