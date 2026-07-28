
-- 1. notification_settings (singleton)
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  wati_base_url text,
  wati_api_token text,
  wati_enabled boolean NOT NULL DEFAULT false,
  email_from_name text NOT NULL DEFAULT 'Twin Care',
  email_from_address text NOT NULL DEFAULT 'onboarding@resend.dev',
  email_enabled boolean NOT NULL DEFAULT true,
  in_app_enabled boolean NOT NULL DEFAULT true,
  default_quiet_start_hour smallint NOT NULL DEFAULT 21,
  default_quiet_end_hour smallint NOT NULL DEFAULT 8,
  retry_max_attempts smallint NOT NULL DEFAULT 3,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE ON public.notification_settings TO authenticated;
GRANT ALL ON public.notification_settings TO service_role;

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read notification_settings" ON public.notification_settings;
CREATE POLICY "admins read notification_settings" ON public.notification_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admins update notification_settings" ON public.notification_settings;
CREATE POLICY "admins update notification_settings" ON public.notification_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admins insert notification_settings" ON public.notification_settings;
CREATE POLICY "admins insert notification_settings" ON public.notification_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

INSERT INTO public.notification_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_notification_settings_updated ON public.notification_settings;
CREATE TRIGGER trg_notification_settings_updated
BEFORE UPDATE ON public.notification_settings
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. Seed default templates (EN + BN) for every event x channel where missing
DO $$
DECLARE
  ev text;
  ch text;
  lang text;
  key text;
  subj text;
  body text;
  events text[] := ARRAY['sensor_change','doctor_consult','nutritionist_consult','lab_test','payment_due','program_renewal','device_return','medicine_review'];
  channels text[] := ARRAY['in_app','whatsapp','email'];
  langs text[] := ARRAY['en','bn'];
BEGIN
  FOREACH ev IN ARRAY events LOOP
    FOREACH ch IN ARRAY channels LOOP
      FOREACH lang IN ARRAY langs LOOP
        key := ev || '_' || ch || '_' || lang;
        subj := CASE ev
          WHEN 'sensor_change' THEN CASE lang WHEN 'en' THEN 'CGM sensor change reminder' ELSE 'CGM সেন্সর পরিবর্তন রিমাইন্ডার' END
          WHEN 'doctor_consult' THEN CASE lang WHEN 'en' THEN 'Doctor consultation reminder' ELSE 'ডাক্তার পরামর্শ রিমাইন্ডার' END
          WHEN 'nutritionist_consult' THEN CASE lang WHEN 'en' THEN 'Nutritionist appointment reminder' ELSE 'পুষ্টিবিদ অ্যাপয়েন্টমেন্ট রিমাইন্ডার' END
          WHEN 'lab_test' THEN CASE lang WHEN 'en' THEN 'Lab test reminder' ELSE 'ল্যাব পরীক্ষা রিমাইন্ডার' END
          WHEN 'payment_due' THEN CASE lang WHEN 'en' THEN 'Payment due reminder' ELSE 'পেমেন্ট বকেয়া রিমাইন্ডার' END
          WHEN 'program_renewal' THEN CASE lang WHEN 'en' THEN 'Program renewal reminder' ELSE 'প্রোগ্রাম নবায়ন রিমাইন্ডার' END
          WHEN 'device_return' THEN CASE lang WHEN 'en' THEN 'Device return reminder' ELSE 'ডিভাইস ফেরত রিমাইন্ডার' END
          WHEN 'medicine_review' THEN CASE lang WHEN 'en' THEN 'Medication review reminder' ELSE 'ওষুধ পর্যালোচনা রিমাইন্ডার' END
        END;
        body := CASE ev
          WHEN 'sensor_change' THEN CASE lang WHEN 'en' THEN 'Hello {{patient_name}}, your CGM sensor is due for replacement on {{date}}. Please visit the clinic.' ELSE 'সুপ্রিয় {{patient_name}}, আপনার CGM সেন্সর {{date}} তারিখে পরিবর্তন করতে হবে। অনুগ্রহ করে ক্লিনিকে আসুন।' END
          WHEN 'doctor_consult' THEN CASE lang WHEN 'en' THEN 'Hi {{patient_name}}, your consultation with {{provider}} is scheduled for {{date}} at {{time}}.' ELSE 'সুপ্রিয় {{patient_name}}, {{provider}}-এর সাথে আপনার পরামর্শ {{date}} তারিখে {{time}}-এ নির্ধারিত।' END
          WHEN 'nutritionist_consult' THEN CASE lang WHEN 'en' THEN 'Hi {{patient_name}}, your nutritionist appointment is on {{date}} at {{time}}.' ELSE 'সুপ্রিয় {{patient_name}}, আপনার পুষ্টিবিদ অ্যাপয়েন্টমেন্ট {{date}} তারিখে {{time}}-এ।' END
          WHEN 'lab_test' THEN CASE lang WHEN 'en' THEN 'Hi {{patient_name}}, please complete your lab test ({{test_name}}) by {{date}}.' ELSE 'সুপ্রিয় {{patient_name}}, {{date}}-এর মধ্যে আপনার ল্যাব পরীক্ষা ({{test_name}}) সম্পন্ন করুন।' END
          WHEN 'payment_due' THEN CASE lang WHEN 'en' THEN 'Dear {{patient_name}}, an installment of BDT {{amount}} is due on {{date}}.' ELSE 'সুপ্রিয় {{patient_name}}, {{date}} তারিখে ৳{{amount}} বকেয়া রয়েছে।' END
          WHEN 'program_renewal' THEN CASE lang WHEN 'en' THEN 'Hi {{patient_name}}, your Twin Care program ends on {{date}}. Contact us to renew.' ELSE 'সুপ্রিয় {{patient_name}}, আপনার Twin Care প্রোগ্রাম {{date}} তারিখে শেষ হবে। নবায়নের জন্য যোগাযোগ করুন।' END
          WHEN 'device_return' THEN CASE lang WHEN 'en' THEN 'Hi {{patient_name}}, please return the following device(s): {{items}}.' ELSE 'সুপ্রিয় {{patient_name}}, অনুগ্রহ করে নিম্নলিখিত ডিভাইস ফেরত দিন: {{items}}।' END
          WHEN 'medicine_review' THEN CASE lang WHEN 'en' THEN 'Hi {{patient_name}}, a medication review is scheduled for {{date}}.' ELSE 'সুপ্রিয় {{patient_name}}, ওষুধ পর্যালোচনা {{date}} তারিখে নির্ধারিত।' END
        END;

        INSERT INTO public.notification_templates (template_key, event_type, channel, language, subject, body, wati_template_name)
        VALUES (key, ev::notif_event_type, ch::notif_channel, lang, subj, body, NULL)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- Ensure template_key is unique for lookup
CREATE UNIQUE INDEX IF NOT EXISTS notification_templates_key_uk ON public.notification_templates(template_key);

-- 3. Backfill notification_preferences for existing patients
INSERT INTO public.notification_preferences (patient_id, preferred_language)
SELECT p.id, COALESCE(pr.preferred_language, 'en')
FROM public.patients p
LEFT JOIN public.profiles pr ON pr.id = p.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_preferences np WHERE np.patient_id = p.id
);
