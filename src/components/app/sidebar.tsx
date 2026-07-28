import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Building2,
  Stethoscope,
  Apple,
  CalendarDays,
  Wallet,
  Package,
  BarChart3,
  Settings,
  UserPlus,
  ShieldCheck,
  Receipt,
  ClipboardList,
  CheckSquare,
  Bell,
  Coins,
  Activity,
  ScrollText,
  Truck,
  Boxes,
  MapPin,
  Pill,
  ChevronDown,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth, type AppRole } from "@/lib/auth";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  roles?: AppRole[]; // if omitted, visible to any signed-in user
};

type NavSection = {
  key: string;
  labelKey: string;
  items: NavItem[];
};

const sections: NavSection[] = [
  {
    key: "overview",
    labelKey: "nav.section.overview",
    items: [
      { to: "/app", labelKey: "nav.dashboard", icon: LayoutDashboard },
      {
        to: "/app/tasks",
        labelKey: "nav.tasks",
        icon: CheckSquare,
        roles: ["super_admin", "admin", "care_coordinator", "doctor", "nutritionist"],
      },
      { to: "/app/notifications", labelKey: "nav.notifications", icon: Bell },
    ],
  },
  {
    key: "portal",
    labelKey: "nav.section.portal",
    items: [
      { to: "/app/portal", labelKey: "nav.dealerPortal", icon: Truck, roles: ["dealer"] },
    ],
  },
  {
    key: "crm",
    labelKey: "nav.section.crm",
    items: [
      {
        to: "/app/leads",
        labelKey: "nav.leads",
        icon: UserPlus,
        roles: ["super_admin", "admin", "care_coordinator"],
      },
      { to: "/app/patients", labelKey: "nav.patients", icon: Users },
      { to: "/app/appointments", labelKey: "nav.appointments", icon: CalendarDays },
      {
        to: "/app/lifecycle",
        labelKey: "nav.lifecycle",
        icon: CalendarDays,
        roles: ["super_admin", "admin", "care_coordinator"],
      },
    ],
  },
  {
    key: "clinical",
    labelKey: "nav.section.clinical",
    items: [
      {
        to: "/app/clinical",
        labelKey: "nav.clinical",
        icon: ClipboardList,
        roles: ["super_admin", "admin", "care_coordinator", "doctor", "nutritionist"],
      },
      {
        to: "/app/labs",
        labelKey: "nav.labs",
        icon: Stethoscope,
        roles: ["super_admin", "admin", "care_coordinator", "doctor", "nutritionist"],
      },
    ],
  },
  {
    key: "billing",
    labelKey: "nav.section.billing",
    items: [
      {
        to: "/app/plans",
        labelKey: "nav.plans",
        icon: Receipt,
        roles: ["super_admin", "admin", "care_coordinator", "finance"],
      },
      {
        to: "/app/payments",
        labelKey: "nav.payments",
        icon: Wallet,
        roles: ["super_admin", "admin", "care_coordinator", "finance"],
      },
      {
        to: "/app/commissions",
        labelKey: "nav.commissions",
        icon: Coins,
        roles: ["super_admin", "admin", "finance"],
      },
    ],
  },
  {
    key: "inventory",
    labelKey: "nav.section.inventory",
    items: [
      {
        to: "/app/inventory",
        labelKey: "nav.inventory",
        icon: Package,
        roles: ["super_admin", "admin", "care_coordinator", "inventory_manager"],
      },
      {
        to: "/app/sensors",
        labelKey: "nav.sensors",
        icon: Activity,
        roles: ["super_admin", "admin", "care_coordinator", "inventory_manager"],
      },
    ],
  },
  {
    key: "distribution",
    labelKey: "nav.section.distribution",
    items: [
      {
        to: "/app/dealers",
        labelKey: "nav.dealers",
        icon: Truck,
        roles: ["super_admin", "admin", "care_coordinator", "finance", "inventory_manager", "sales_officer"],
      },
      {
        to: "/app/distribution-catalog",
        labelKey: "nav.distributionCatalog",
        icon: Boxes,
        roles: ["super_admin", "admin", "care_coordinator", "finance", "inventory_manager", "sales_officer"],
      },
      {
        to: "/app/sales-orders",
        labelKey: "nav.salesOrders",
        icon: ClipboardList,
        roles: ["super_admin", "admin", "care_coordinator", "finance", "inventory_manager", "sales_officer"],
      },
      {
        to: "/app/deliveries",
        labelKey: "nav.deliveries",
        icon: Truck,
        roles: ["super_admin", "admin", "care_coordinator", "inventory_manager", "sales_officer"],
      },
      {
        to: "/app/trade-invoices",
        labelKey: "nav.tradeInvoices",
        icon: Receipt,
        roles: ["super_admin", "admin", "finance", "sales_officer"],
      },
      {
        to: "/app/dealer-payments",
        labelKey: "nav.dealerPayments",
        icon: Wallet,
        roles: ["super_admin", "admin", "finance", "sales_officer"],
      },
      {
        to: "/app/dealer-ledger",
        labelKey: "nav.dealerLedger",
        icon: ScrollText,
        roles: ["super_admin", "admin", "finance", "sales_officer"],
      },
      {
        to: "/app/distribution-dashboard",
        labelKey: "nav.distributionDashboard",
        icon: BarChart3,
        roles: ["super_admin", "admin", "finance", "sales_officer"],
      },
      {
        to: "/app/distribution-reports",
        labelKey: "nav.distributionReports",
        icon: BarChart3,
        roles: ["super_admin", "admin", "finance", "sales_officer"],
      },
    ],
  },
  {
    key: "network",
    labelKey: "nav.section.network",
    items: [
      {
        to: "/app/doctors",
        labelKey: "nav.doctors",
        icon: Stethoscope,
        roles: ["super_admin", "admin", "care_coordinator"],
      },
      {
        to: "/app/nutritionists",
        labelKey: "nav.nutritionists",
        icon: Apple,
        roles: ["super_admin", "admin", "care_coordinator"],
      },
      {
        to: "/app/hospitals",
        labelKey: "nav.hospitals",
        icon: Building2,
        roles: ["super_admin", "admin", "care_coordinator"],
      },
      {
        to: "/app/pharmacies",
        labelKey: "nav.pharmacies",
        icon: Pill,
        roles: ["super_admin", "admin", "care_coordinator", "sales_officer", "inventory_manager", "finance"],
      },
    ],
  },
  {
    key: "field",
    labelKey: "nav.section.field",
    items: [
      {
        to: "/app/visits",
        labelKey: "nav.visits",
        icon: MapPin,
        roles: ["super_admin", "admin", "care_coordinator", "sales_officer", "inventory_manager", "finance"],
      },
      {
        to: "/app/visit-audit",
        labelKey: "nav.visitAudit",
        icon: MapPin,
        roles: ["super_admin", "admin"],
      },
      {
        to: "/app/vehicles",
        labelKey: "nav.vehicles",
        icon: Truck,
      },
    ],
  },
  {
    key: "reports",
    labelKey: "nav.section.reports",
    items: [
      {
        to: "/app/reports",
        labelKey: "nav.reports",
        icon: BarChart3,
        roles: ["super_admin", "admin", "finance"],
      },
    ],
  },
  {
    key: "admin",
    labelKey: "nav.section.admin",
    items: [
      {
        to: "/app/access-requests",
        labelKey: "nav.accessRequests",
        icon: ShieldCheck,
        roles: ["super_admin", "admin"],
      },
      {
        to: "/app/audit",
        labelKey: "nav.audit",
        icon: ScrollText,
        roles: ["super_admin", "admin"],
      },
      { to: "/app/settings", labelKey: "nav.settings", icon: Settings, roles: ["super_admin", "admin"] },
    ],
  },
];

export function SidebarContent({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { t } = useI18n();
  const { hasAnyRole, roles } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isItemVisible = (it: NavItem) => {
    if (!it.roles) return true;
    if (roles.length === 0) return false;
    return hasAnyRole(it.roles);
  };

  const visibleSections = sections
    .map((s) => ({ ...s, items: s.items.filter(isItemVisible) }))
    .filter((s) => s.items.length > 0);

  const sectionOfActive = visibleSections.find((s) =>
    s.items.some((it) => (it.to === "/app" ? pathname === "/app" : pathname.startsWith(it.to))),
  )?.key;

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  return (
    <div className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold">
            T
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">{t("app.name")}</div>
            <div className="text-xs text-sidebar-foreground/70 leading-tight">Experto</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {visibleSections.map((section) => {
          const isOpen = collapsed[section.key] === undefined
            ? section.key === sectionOfActive || section.key === "overview"
            : !collapsed[section.key];
          return (
            <div key={section.key} className="mb-1">
              <button
                type="button"
                onClick={() => toggle(section.key)}
                className="w-full flex items-center justify-between px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
              >
                <span>{t(section.labelKey)}</span>
                <ChevronDown
                  className={cn("h-3 w-3 transition-transform", !isOpen && "-rotate-90")}
                />
              </button>
              {isOpen && (
                <div>
                  {section.items.map((it) => {
                    const active =
                      it.to === "/app" ? pathname === "/app" : pathname.startsWith(it.to);
                    const Icon = it.icon;
                    return (
                      <Link
                        key={it.to}
                        to={it.to}
                        onClick={() => onNavigate?.()}
                        className={cn(
                          "flex items-center gap-3 px-5 py-2 text-sm rounded-none transition-colors",
                          "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          active &&
                            "bg-sidebar-accent text-sidebar-accent-foreground border-l-4 border-sidebar-primary pl-4 font-medium",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{t(it.labelKey)}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="px-5 py-3 text-[11px] text-sidebar-foreground/50 border-t border-sidebar-border">
        v0.1 · foundation
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-60 shrink-0 flex-col">
      <SidebarContent />
    </aside>
  );
}

