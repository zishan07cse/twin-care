import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getInvoice } from "@/lib/distribution.functions";
import { formatBDT, formatDateBD, useI18n } from "@/lib/i18n";
import { amountInWordsEn, amountInWordsBn } from "@/lib/amount-in-words";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/trade-invoices/$id/print")({
  component: TradeInvoicePrintPage,
});

type LineItem = {
  id: string;
  quantity: number;
  unit_price_bdt: number;
  discount_pct: number | null;
  line_total_bdt: number;
  item: { name_en: string; name_bn: string | null; sku: string | null } | null;
};

type Invoice = {
  invoice_no: string;
  invoice_date: string;
  due_date: string | null;
  subtotal_bdt: number;
  discount_bdt: number;
  vat_bdt: number;
  ait_bdt: number;
  total_bdt: number;
  paid_amount_bdt: number;
  status: string;
  notes: string | null;
  dealer: {
    business_name: string;
    dealer_code: string;
    address: string | null;
    district: string | null;
    division: string | null;
    phone: string | null;
    bin: string | null;
    tin: string | null;
  } | null;
};

function TradeInvoicePrintPage() {
  const { id } = Route.useParams();
  const { locale } = useI18n();
  const getFn = useServerFn(getInvoice);
  const { data, isLoading } = useQuery({
    queryKey: ["invoice-print", id],
    queryFn: () => getFn({ data: { id } }),
  });

  useEffect(() => {
    if (data) document.title = `Invoice ${(data.invoice as Invoice).invoice_no}`;
  }, [data]);

  if (isLoading || !data) return <div className="p-6 text-sm">Loading…</div>;

  const inv = data.invoice as Invoice;
  const items = (data.items ?? []) as LineItem[];
  const outstanding = Number(inv.total_bdt) - Number(inv.paid_amount_bdt);
  const wordsEn = amountInWordsEn(Number(inv.total_bdt));
  const wordsBn = amountInWordsBn(Number(inv.total_bdt));

  return (
    <div className="bg-muted min-h-screen">
      <div className="mx-auto max-w-4xl p-6">
        <div className="flex justify-end mb-3 print:hidden">
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
          </Button>
        </div>

        <div className="bg-white text-black p-8 shadow print:shadow-none print:p-0">
          <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
            <div>
              <div className="text-2xl font-bold">Experto TwinCare BD</div>
              <div className="text-xs">Metabolic Health · Dhaka, Bangladesh</div>
              <div className="text-xs">BIN: 00000000 · TIN: 000000000</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold uppercase tracking-wide">Tax Invoice</div>
              <div className="text-sm">Mushak-6.3</div>
              <div className="text-xs mt-1">Original for Buyer</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
            <div>
              <div className="text-xs font-semibold uppercase text-gray-500 mb-1">Billed to</div>
              <div className="font-semibold">{inv.dealer?.business_name}</div>
              <div className="font-mono text-xs">{inv.dealer?.dealer_code}</div>
              <div>{inv.dealer?.address}</div>
              <div>
                {inv.dealer?.district}
                {inv.dealer?.division ? `, ${inv.dealer.division}` : ""}
              </div>
              {inv.dealer?.phone && <div>Phone: {inv.dealer.phone}</div>}
              {inv.dealer?.bin && <div>BIN: {inv.dealer.bin}</div>}
              {inv.dealer?.tin && <div>TIN: {inv.dealer.tin}</div>}
            </div>
            <div className="text-sm">
              <div className="grid grid-cols-2 gap-y-1">
                <div className="text-gray-500">Invoice #</div>
                <div className="font-mono font-semibold">{inv.invoice_no}</div>
                <div className="text-gray-500">Invoice date</div>
                <div>{formatDateBD(inv.invoice_date)}</div>
                <div className="text-gray-500">Due date</div>
                <div>{inv.due_date ? formatDateBD(inv.due_date) : "—"}</div>
                <div className="text-gray-500">Status</div>
                <div className="uppercase text-xs">{inv.status}</div>
              </div>
            </div>
          </div>

          <table className="w-full text-sm border-collapse mb-4">
            <thead>
              <tr className="bg-gray-100 border-y border-black">
                <th className="text-left p-2 w-8">#</th>
                <th className="text-left p-2">Description</th>
                <th className="text-right p-2 w-16">Qty</th>
                <th className="text-right p-2 w-24">Unit price</th>
                <th className="text-right p-2 w-16">Disc %</th>
                <th className="text-right p-2 w-28">Line total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id} className="border-b border-gray-300">
                  <td className="p-2">{i + 1}</td>
                  <td className="p-2">
                    <div>{it.item?.name_en}</div>
                    {it.item?.name_bn && <div className="text-xs text-gray-600">{it.item.name_bn}</div>}
                    {it.item?.sku && <div className="text-xs font-mono text-gray-500">SKU: {it.item.sku}</div>}
                  </td>
                  <td className="text-right p-2">{it.quantity}</td>
                  <td className="text-right p-2">{formatBDT(Number(it.unit_price_bdt), locale)}</td>
                  <td className="text-right p-2">{Number(it.discount_pct ?? 0)}</td>
                  <td className="text-right p-2">{formatBDT(Number(it.line_total_bdt), locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-80 text-sm">
              <div className="flex justify-between py-1">
                <span>Subtotal</span>
                <span>{formatBDT(Number(inv.subtotal_bdt), locale)}</span>
              </div>
              {Number(inv.discount_bdt) > 0 && (
                <div className="flex justify-between py-1">
                  <span>Discount</span>
                  <span>− {formatBDT(Number(inv.discount_bdt), locale)}</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span>VAT</span>
                <span>{formatBDT(Number(inv.vat_bdt), locale)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>AIT</span>
                <span>{formatBDT(Number(inv.ait_bdt), locale)}</span>
              </div>
              <div className="flex justify-between py-2 border-t border-black font-bold text-base">
                <span>Total</span>
                <span>{formatBDT(Number(inv.total_bdt), locale)}</span>
              </div>
              <div className="flex justify-between py-1 text-emerald-700">
                <span>Paid</span>
                <span>{formatBDT(Number(inv.paid_amount_bdt), locale)}</span>
              </div>
              <div className="flex justify-between py-1 border-t border-gray-400 font-semibold">
                <span>Outstanding</span>
                <span>{formatBDT(Math.max(outstanding, 0), locale)}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 text-sm border-t border-gray-300 pt-3">
            <div>
              <span className="font-semibold">Amount in words (English):</span> {wordsEn}
            </div>
            <div className="mt-1">
              <span className="font-semibold">টাকার কথায় (বাংলা):</span> {wordsBn}
            </div>
          </div>

          {inv.notes && (
            <div className="mt-4 text-xs text-gray-600 border-t border-gray-300 pt-3">
              <div className="font-semibold mb-1">Notes</div>
              <div className="whitespace-pre-wrap">{inv.notes}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6 mt-16 text-xs">
            <div className="text-center">
              <div className="border-t border-black pt-1">Prepared by</div>
            </div>
            <div className="text-center">
              <div className="border-t border-black pt-1">Authorised signatory</div>
            </div>
          </div>

          <div className="mt-8 text-[10px] text-gray-500 text-center">
            This is a computer-generated tax invoice per NBR Mushak-6.3. E&OE.
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .bg-muted { background: white !important; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>
    </div>
  );
}
