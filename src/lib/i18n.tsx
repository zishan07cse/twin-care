// i18n dictionary + hook — supports English and Bengali (বাংলা).
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Locale = "en" | "bn";

const STORAGE_KEY = "twincare.locale";

type Dict = Record<string, { en: string; bn: string }>;

// Centralized dictionary. Add new keys here and reference via t("key").
const dictionary: Dict = {
  "app.name": { en: "TwinCare BD", bn: "টুইনকেয়ার বিডি" },
  "app.tagline": {
    en: "Metabolic health program management",
    bn: "মেটাবলিক স্বাস্থ্য প্রোগ্রাম ব্যবস্থাপনা",
  },

  // Auth
  "auth.signIn": { en: "Sign in", bn: "সাইন ইন" },
  "auth.signUp": { en: "Create account", bn: "অ্যাকাউন্ট তৈরি করুন" },
  "auth.signOut": { en: "Sign out", bn: "সাইন আউট" },
  "auth.email": { en: "Email", bn: "ইমেইল" },
  "auth.password": { en: "Password", bn: "পাসওয়ার্ড" },
  "auth.fullName": { en: "Full name", bn: "পূর্ণ নাম" },
  "auth.phone": { en: "Phone", bn: "ফোন" },
  "auth.haveAccount": { en: "Already have an account?", bn: "ইতিমধ্যে একাউন্ট আছে?" },
  "auth.noAccount": { en: "New here?", bn: "নতুন?" },
  "auth.welcome": { en: "Welcome back", bn: "আবার স্বাগতম" },
  "auth.createAccount": { en: "Create your account", bn: "আপনার অ্যাকাউন্ট তৈরি করুন" },
  "auth.error": { en: "Authentication failed", bn: "প্রমাণীকরণ ব্যর্থ" },

  // Nav
  "nav.dashboard": { en: "Dashboard", bn: "ড্যাশবোর্ড" },
  "nav.leads": { en: "Leads", bn: "লিড" },
  "nav.patients": { en: "Patients", bn: "রোগী" },
  "nav.appointments": { en: "Appointments", bn: "অ্যাপয়েন্টমেন্ট" },
  "nav.clinical": { en: "Clinical", bn: "ক্লিনিক্যাল" },
  "nav.labs": { en: "Labs & Vitals", bn: "ল্যাব ও ভাইটালস" },
 "nav.payments": { en: "Payments", bn: "পেমেন্ট" },
 "nav.plans": { en: "Program plans", bn: "প্রোগ্রাম প্ল্যান" },
  "nav.inventory": { en: "Inventory", bn: "ইনভেন্টরি" },
  "nav.dealers": { en: "Dealers", bn: "ডিলার" },
  "nav.distributionCatalog": { en: "Trade catalog", bn: "ট্রেড ক্যাটালগ" },
  "nav.salesOrders": { en: "Sales orders", bn: "সেলস অর্ডার" },
  "nav.deliveries": { en: "Deliveries", bn: "ডেলিভারি" },
  "nav.tradeInvoices": { en: "Trade invoices", bn: "ট্রেড ইনভয়েস" },
  "nav.dealerPayments": { en: "Dealer payments", bn: "ডিলার পেমেন্ট" },
  "nav.dealerLedger": { en: "Dealer ledger", bn: "ডিলার লেজার" },
  "nav.distributionDashboard": { en: "Distribution dashboard", bn: "ডিস্ট্রিবিউশন ড্যাশবোর্ড" },
  "nav.distributionReports": { en: "Distribution reports", bn: "ডিস্ট্রিবিউশন রিপোর্ট" },
  "nav.dealerPortal": { en: "Dealer portal", bn: "ডিলার পোর্টাল" },
  "nav.doctors": { en: "Doctors", bn: "ডাক্তার" },
  "nav.nutritionists": { en: "Nutritionists", bn: "পুষ্টিবিদ" },
  "nav.hospitals": { en: "Hospitals", bn: "হাসপাতাল" },
  "nav.reports": { en: "Reports", bn: "রিপোর্ট" },
  "nav.settings": { en: "Settings", bn: "সেটিংস" },
  "nav.accessRequests": { en: "Access requests", bn: "অ্যাক্সেস রিকোয়েস্ট" },
  "nav.tasks": { en: "My Day", bn: "আমার দিন" },
  "nav.notifications": { en: "Notifications", bn: "বিজ্ঞপ্তি" },
  "nav.sensors": { en: "CGM sensors", bn: "সিজিএম সেন্সর" },
  "nav.audit": { en: "Audit & Backups", bn: "অডিট ও ব্যাকআপ" },
  "nav.commissions": { en: "Commissions", bn: "কমিশন" },
  "nav.lifecycle": { en: "Lifecycle", bn: "লাইফসাইকেল" },
  "nav.visits": { en: "Visits", bn: "ভিজিট" },
  "nav.visitAudit": { en: "Visit GPS audit", bn: "ভিজিট GPS অডিট" },
  "nav.vehicles": { en: "Vehicles", bn: "গাড়ি" },
  "nav.pharmacies": { en: "Pharmacies", bn: "ফার্মেসি" },

  // Nav sections
  "nav.section.overview": { en: "Overview", bn: "সারসংক্ষেপ" },
  "nav.section.crm": { en: "Patient CRM", bn: "রোগী সিআরএম" },
  "nav.section.clinical": { en: "Clinical", bn: "ক্লিনিক্যাল" },
  "nav.section.billing": { en: "Billing & Plans", bn: "বিলিং ও প্ল্যান" },
  "nav.section.inventory": { en: "Inventory & Devices", bn: "ইনভেন্টরি ও ডিভাইস" },
  "nav.section.distribution": { en: "Distribution", bn: "ডিস্ট্রিবিউশন" },
  "nav.section.network": { en: "Provider Network", bn: "প্রোভাইডার নেটওয়ার্ক" },
  "nav.section.field": { en: "Field & Visits", bn: "ফিল্ড ও ভিজিট" },
  "nav.section.reports": { en: "Reports", bn: "রিপোর্ট" },
  "nav.section.admin": { en: "Administration", bn: "প্রশাসন" },
  "nav.section.portal": { en: "Dealer", bn: "ডিলার" },

  // Dashboard placeholders
  "dash.title": { en: "Overview", bn: "সংক্ষিপ্ত বিবরণ" },
  "dash.activePatients": { en: "Active patients", bn: "সক্রিয় রোগী" },
  "dash.newEnrollments": { en: "New enrollments this month", bn: "এই মাসে নতুন নিবন্ধন" },
  "dash.collections": { en: "Collections this month", bn: "এই মাসের সংগ্রহ" },
  "dash.overdue": { en: "Overdue payments", bn: "বকেয়া পেমেন্ট" },
  "dash.foundationReady": {
    en: "Foundation is ready. Master data, patients, payments, devices, and consultations will land in the next phases.",
    bn: "ভিত্তি প্রস্তুত। মাস্টার ডেটা, রোগী, পেমেন্ট, ডিভাইস ও পরামর্শ পরবর্তী ধাপে যুক্ত হবে।",
  },

  // Common
  "common.loading": { en: "Loading…", bn: "লোড হচ্ছে…" },
  "common.language": { en: "Language", bn: "ভাষা" },
  "common.english": { en: "English", bn: "ইংরেজি" },
  "common.bengali": { en: "Bengali", bn: "বাংলা" },
};

interface I18nCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: keyof typeof dictionary | string) => string;
}

const I18nContext = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  // Read persisted locale after mount to avoid SSR hydration mismatch.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored === "en" || stored === "bn") setLocaleState(stored);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  };

  const t = (key: string) => {
    const entry = dictionary[key];
    if (!entry) return key;
    return entry[locale] ?? entry.en;
  };

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

// Date helpers — DD-MM-YYYY.
export function formatDateBD(input: string | Date | null | undefined): string {
  if (!input) return "";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// Currency — ৳ with optional Bengali digits.
const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
export function toBengaliDigits(input: string): string {
  return input.replace(/[0-9]/g, (d) => bnDigits[Number(d)]);
}
export function formatBDT(amount: number, locale: Locale = "en"): string {
  const s = new Intl.NumberFormat("en-BD", {
    maximumFractionDigits: 2,
  }).format(amount);
  const withSymbol = `৳ ${s}`;
  return locale === "bn" ? toBengaliDigits(withSymbol) : withSymbol;
}
