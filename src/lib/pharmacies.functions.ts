import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertSalesOrStaff(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_sales_or_staff", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const pharmacySchema = z.object({
  name: z.string().trim().min(1).max(200),
  name_bn: z.string().trim().max(200).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  contact_person: z.string().trim().max(200).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  is_active: z.boolean().default(true),
});

export type PharmacyValues = z.infer<typeof pharmacySchema>;

export const listPharmacies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("pharmacies")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertPharmacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional(), values: pharmacySchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    const values = { ...data.values };
    if (data.id) {
      const { error } = await context.supabase.from("pharmacies").update(values).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("pharmacies")
        .insert({ ...values, created_by: context.userId });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deletePharmacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("pharmacies").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
