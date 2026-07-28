import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data: a } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (a) return true;
  const { data: s } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  return !!s;
}

const vehicleSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  make: z.string().trim().max(80).optional().nullable(),
  model: z.string().trim().max(80).optional().nullable(),
  plate_number: z.string().trim().max(40).optional().nullable(),
  capacity: z.number().int().min(1).max(100).optional().nullable(),
  status: z.enum(["available", "in_use", "maintenance", "retired"]).default("available"),
  notes: z.string().trim().max(1000).optional().nullable(),
  is_active: z.boolean().default(true),
});
export type VehicleValues = z.infer<typeof vehicleSchema>;

export const listVehicles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("vehicles")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional(), values: vehicleSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
    if (data.id) {
      const { error } = await context.supabase.from("vehicles").update(data.values).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("vehicles")
        .insert({ ...data.values, created_by: context.userId });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
    const { error } = await context.supabase.from("vehicles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const tripSchema = z.object({
  vehicle_id: z.string().uuid(),
  from_location: z.string().trim().min(1).max(200),
  to_location: z.string().trim().min(1).max(200),
  purpose: z.string().trim().max(500).optional().nullable(),
  start_odometer: z.number().min(0).optional().nullable(),
  passengers: z.number().int().min(0).max(50).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const listTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ scope: z.enum(["mine", "all"]).default("mine") }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("vehicle_trips")
      .select("*, vehicle:vehicles(id,code,name,plate_number)")
      .order("start_at", { ascending: false });
    if (data.scope === "mine") q = q.eq("driver_user_id", context.userId);
    else if (!(await isAdmin(context.supabase, context.userId))) {
      q = q.eq("driver_user_id", context.userId);
    }
    const { data: rows, error } = await q.limit(500);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r: { driver_user_id: string }) => r.driver_user_id)));
    let profiles: { id: string; full_name: string | null }[] = [];
    if (ids.length) {
      const { data: p } = await context.supabase.from("profiles").select("id,full_name").in("id", ids);
      profiles = p ?? [];
    }
    const map = new Map(profiles.map((p) => [p.id, p.full_name]));
    return (rows ?? []).map((r: Record<string, unknown>) => ({ ...r, driver_name: map.get(r.driver_user_id as string) ?? null }));
  });

export const startTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tripSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("vehicle_trips")
      .insert({
        vehicle_id: data.vehicle_id,
        driver_user_id: context.userId,
        from_location: data.from_location,
        to_location: data.to_location,
        purpose: data.purpose || null,
        start_odometer: data.start_odometer ?? null,
        passengers: data.passengers ?? null,
        notes: data.notes || null,
        status: "ongoing",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const endTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        end_odometer: z.number().min(0).optional().nullable(),
        notes: z.string().max(1000).optional().nullable(),
        to_location: z.string().trim().max(200).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { status: "completed", end_at: new Date().toISOString() };
    if (data.end_odometer !== undefined && data.end_odometer !== null) patch.end_odometer = data.end_odometer;
    if (data.notes !== undefined && data.notes !== null) patch.notes = data.notes;
    if (data.to_location) patch.to_location = data.to_location;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any).from("vehicle_trips").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("vehicle_trips")
      .update({ status: "cancelled", end_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
