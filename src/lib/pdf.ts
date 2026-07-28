import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BRAND = {
  name: "TwinCare Bangladesh",
  tagline: "Diabetes reversal & metabolic health program",
  address: "Dhaka, Bangladesh",
  website: "twincare-bd.com",
};

function fmtBDT(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return "BDT " + v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function header(doc: jsPDF, title: string, subtitle?: string) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(20, 83, 45);
  doc.rect(0, 0, pw, 22, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(BRAND.name, 14, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(BRAND.tagline, 14, 16);
  doc.setFontSize(9);
  doc.text(BRAND.website, pw - 14, 10, { align: "right" });
  doc.text(BRAND.address, pw - 14, 16, { align: "right" });

  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 14, 34);
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(subtitle, 14, 40);
    doc.setTextColor(20);
  }
}

function footer(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Generated ${new Date().toLocaleString()}`, 14, ph - 8);
    doc.text(`Page ${i} of ${pages}`, pw - 14, ph - 8, { align: "right" });
  }
}

function save(doc: jsPDF, name: string) {
  footer(doc);
  doc.save(name);
}

function patientBlock(doc: jsPDF, patient: any, y: number) {
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(patient?.full_name || patient?.full_name_en || "Patient", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  const line2 = [
    patient?.patient_code,
    patient?.gender,
    patient?.date_of_birth ? `DOB ${patient.date_of_birth}` : null,
    patient?.phone,
  ]
    .filter(Boolean)
    .join(" · ");
  if (line2) doc.text(line2, 14, y + 5);
  doc.setTextColor(20);
  return y + 12;
}

// ================= Prescription =================
export function generatePrescriptionPDF(rx: any) {
  const doc = new jsPDF();
  header(doc, "Prescription", `Issued ${fmtDate(rx.issued_at)}`);
  let y = patientBlock(doc, rx.patient, 50);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Doctor:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(rx.doctor?.full_name || "—", 32, y);
  y += 6;

  if (rx.diagnosis) {
    doc.setFont("helvetica", "bold");
    doc.text("Diagnosis:", 14, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(rx.diagnosis, 165);
    doc.text(lines, 38, y);
    y += 6 * lines.length;
  }
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [["#", "Medicine", "Dose", "Frequency", "Duration", "Instructions"]],
    body: (rx.items || []).map((it: any, i: number) => [
      i + 1,
      it.medicine_name,
      it.dose || "—",
      it.frequency || "—",
      it.duration || "—",
      it.instructions || "",
    ]),
    theme: "striped",
    headStyles: { fillColor: [20, 83, 45] },
    styles: { fontSize: 9 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;
  if (rx.advice) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Advice", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(rx.advice, 180);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 4;
  }
  if (rx.follow_up_at) {
    doc.setFont("helvetica", "bold");
    doc.text(`Follow-up: ${fmtDate(rx.follow_up_at)}`, 14, y);
    y += 8;
  }

  const ph = doc.internal.pageSize.getHeight();
  doc.setDrawColor(120);
  doc.line(140, ph - 30, 196, ph - 30);
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text("Doctor's signature", 168, ph - 25, { align: "center" });

  save(doc, `prescription-${rx.patient?.patient_code || rx.id}.pdf`);
}

// ================= Diet Chart =================
export function generateDietChartPDF(plan: any) {
  const doc = new jsPDF();
  header(doc, "Diet Chart", plan.title);
  let y = patientBlock(doc, plan.patient, 50);

  doc.setFontSize(9);
  const meta = [
    plan.nutritionist?.full_name ? `Nutritionist: ${plan.nutritionist.full_name}` : null,
    `Period: ${fmtDate(plan.start_date)}${plan.end_date ? " – " + fmtDate(plan.end_date) : " – ongoing"}`,
    plan.daily_calories ? `Daily target: ${plan.daily_calories} kcal` : null,
  ]
    .filter(Boolean)
    .join("   |   ");
  doc.text(meta, 14, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [["Meal", "Time", "Items"]],
    body: (plan.meals || []).map((m: any) => [m.meal, m.time || "—", m.items]),
    theme: "grid",
    headStyles: { fillColor: [20, 83, 45] },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 22 }, 2: { cellWidth: "auto" as any } },
  });

  y = (doc as any).lastAutoTable.finalY + 8;
  if (plan.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Notes", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(plan.notes, 180);
    doc.text(lines, 14, y);
  }

  save(doc, `diet-plan-${plan.patient?.patient_code || plan.id}.pdf`);
}

// ================= Money Receipt / Invoice =================
export function generateReceiptPDF(payment: any) {
  const doc = new jsPDF();
  header(doc, "Money Receipt", `Receipt No. ${payment.receipt_no || payment.id.slice(0, 8)}`);
  let y = patientBlock(doc, payment.enrollment?.patient, 50);

  doc.setFontSize(10);
  const lines = [
    ["Date received", fmtDate(payment.paid_on)],
    ["Program / Plan", payment.enrollment?.plan?.name || "—"],
    ["Payment method", String(payment.method || "").replace("_", " ")],
    ["Reference", payment.reference || "—"],
  ];
  lines.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.text(String(k), 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(v), 60, y);
    y += 6;
  });

  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Description", "Amount"]],
    body: [
      [
        `Payment for ${payment.enrollment?.plan?.name || "program"}`,
        fmtBDT(payment.amount_bdt),
      ],
    ],
    foot: [["Total received", fmtBDT(payment.amount_bdt)]],
    theme: "striped",
    headStyles: { fillColor: [20, 83, 45] },
    footStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: "bold" },
    styles: { fontSize: 10 },
    columnStyles: { 1: { halign: "right", cellWidth: 50 } },
  });

  y = (doc as any).lastAutoTable.finalY + 10;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(
    "Received the amount above with thanks. This is a system-generated receipt.",
    14,
    y,
  );
  doc.setTextColor(20);

  const ph = doc.internal.pageSize.getHeight();
  doc.setDrawColor(120);
  doc.line(140, ph - 30, 196, ph - 30);
  doc.setFontSize(9);
  doc.text("Authorised signatory", 168, ph - 25, { align: "center" });

  save(doc, `receipt-${payment.receipt_no || payment.id}.pdf`);
}

// ================= Monthly Commission Statement =================
export function generateCommissionStatementPDF(opts: {
  period: string; // e.g. "2026-07"
  referrer_name: string;
  referrer_kind: string;
  rows: Array<any> & Array<{
    accrued_at: string;
    patient?: { patient_code?: string; full_name_en?: string; full_name?: string } | null;
    basis: string;
    amount_bdt: number;
    status: string;
  }>;
}) {
  const doc = new jsPDF();
  header(doc, "Commission Statement", `Period ${opts.period}`);
  doc.setFontSize(10);
  let y = 50;
  doc.setFont("helvetica", "bold");
  doc.text("Referrer:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${opts.referrer_name} (${opts.referrer_kind})`, 40, y);
  y += 8;

  const total = opts.rows.reduce((a, r) => a + Number(r.amount_bdt || 0), 0);
  const paid = opts.rows.filter((r) => r.status === "paid").reduce((a, r) => a + Number(r.amount_bdt || 0), 0);
  const approved = opts.rows.filter((r) => r.status === "approved").reduce((a, r) => a + Number(r.amount_bdt || 0), 0);
  const accrued = opts.rows.filter((r) => r.status === "accrued").reduce((a, r) => a + Number(r.amount_bdt || 0), 0);

  autoTable(doc, {
    startY: y,
    head: [["Total", "Paid", "Approved", "Accrued"]],
    body: [[fmtBDT(total), fmtBDT(paid), fmtBDT(approved), fmtBDT(accrued)]],
    theme: "grid",
    headStyles: { fillColor: [20, 83, 45] },
    styles: { fontSize: 10, halign: "right" },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  autoTable(doc, {
    startY: y,
    head: [["Date", "Patient", "Basis", "Status", "Amount"]],
    body: opts.rows.map((r) => [
      fmtDate(r.accrued_at),
      r.patient
        ? `${r.patient.patient_code || ""} ${r.patient.full_name_en || r.patient.full_name || ""}`.trim()
        : "—",
      r.basis,
      r.status,
      fmtBDT(r.amount_bdt),
    ]),
    foot: [["", "", "", "Total", fmtBDT(total)]],
    theme: "striped",
    headStyles: { fillColor: [20, 83, 45] },
    footStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: "bold" },
    styles: { fontSize: 9 },
    columnStyles: { 4: { halign: "right" } },
  });

  save(doc, `commission-statement-${opts.referrer_name.replace(/\s+/g, "-")}-${opts.period}.pdf`);
}

// ================= Outcomes Summary =================
export function generateOutcomesSummaryPDF(opts: {
  patient: any;
  outcome?: any | null;
  vitals?: any[];
  reductions?: any[];
  labs?: any[];
}) {
  const doc = new jsPDF();
  header(doc, "Outcomes Summary", `Generated ${fmtDate(new Date())}`);
  let y = patientBlock(doc, opts.patient, 50);

  const o = opts.outcome || {};
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Program outcomes", 14, y);
  y += 5;

  autoTable(doc, {
    startY: y,
    head: [["Metric", "Baseline", "Current", "Change"]],
    body: [
      ["HbA1c (%)", o.baseline_hba1c ?? "—", o.current_hba1c ?? "—", o.hba1c_delta ?? "—"],
      [
        "Weight (kg)",
        o.baseline_weight_kg ?? "—",
        o.current_weight_kg ?? "—",
        o.weight_delta_kg ?? "—",
      ],
      [
        "Medication count",
        o.baseline_med_count ?? "—",
        o.current_med_count ?? "—",
        o.baseline_med_count != null && o.current_med_count != null
          ? o.baseline_med_count - o.current_med_count
          : "—",
      ],
      ["Insulin stopped", o.insulin_stopped ? "Yes" : "No", "", ""],
      ["In remission", o.in_remission ? "Yes" : "No", "", ""],
    ],
    theme: "grid",
    headStyles: { fillColor: [20, 83, 45] },
    styles: { fontSize: 10 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  if (opts.vitals && opts.vitals.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Recent vitals", 14, y);
    y += 3;
    autoTable(doc, {
      startY: y + 2,
      head: [["Date", "Weight", "BP", "FBS", "PPBS", "HbA1c", "Waist"]],
      body: opts.vitals.slice(0, 10).map((v: any) => [
        v.recorded_on,
        v.weight_kg ?? "—",
        v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : "—",
        v.fasting_glucose ?? "—",
        v.post_meal_glucose ?? "—",
        v.hba1c != null ? `${v.hba1c}%` : "—",
        v.waist_cm ?? "—",
      ]),
      theme: "striped",
      headStyles: { fillColor: [20, 83, 45] },
      styles: { fontSize: 9 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (opts.reductions && opts.reductions.length) {
    if (y > 240) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Medication reductions", 14, y);
    autoTable(doc, {
      startY: y + 3,
      head: [["Date", "Medicine", "Baseline", "Current", "% Reduction"]],
      body: opts.reductions.map((r: any) => [
        r.recorded_on,
        r.medicine_name,
        r.baseline_dose || "—",
        r.current_dose || "—",
        r.reduction_percent != null ? `${r.reduction_percent}%` : "—",
      ]),
      theme: "striped",
      headStyles: { fillColor: [20, 83, 45] },
      styles: { fontSize: 9 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (opts.labs && opts.labs.length) {
    if (y > 240) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Recent labs", 14, y);
    autoTable(doc, {
      startY: y + 3,
      head: [["Date", "Test", "Value", "Lab"]],
      body: opts.labs.slice(0, 15).map((r: any) => [
        r.performed_on,
        r.test_name,
        `${r.value_numeric ?? r.value_text ?? "—"}${r.unit ? " " + r.unit : ""}`,
        r.lab_name || "",
      ]),
      theme: "striped",
      headStyles: { fillColor: [20, 83, 45] },
      styles: { fontSize: 9 },
    });
  }

  save(doc, `outcomes-${opts.patient?.patient_code || "patient"}.pdf`);
}
