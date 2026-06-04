import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileText, Download, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiListInvoices, type Invoice } from "@/lib/billing-client";

const STATUS_COLORS: Record<string, string> = {
  paid:          "bg-emerald-500/20 text-emerald-400",
  open:          "bg-yellow-500/20 text-yellow-400",
  draft:         "bg-muted text-muted-foreground",
  uncollectible: "bg-red-500/20 text-red-400",
  void:          "bg-muted text-muted-foreground",
};

function usd(cents: number) { return `$${(cents / 100).toFixed(2)}`; }

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="py-3 px-4 text-xs text-muted-foreground font-mono">{invoice.stripeInvoiceId.slice(0, 18)}…</td>
      <td className="py-3 px-4 text-sm">{usd(invoice.amountDueCents)}</td>
      <td className="py-3 px-4 text-sm">{usd(invoice.amountPaidCents)}</td>
      <td className="py-3 px-4">
        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[invoice.status] ?? "bg-muted text-muted-foreground"}`}>
          {invoice.status}
        </span>
      </td>
      <td className="py-3 px-4 text-xs text-muted-foreground">
        {invoice.periodStart ? new Date(invoice.periodStart).toLocaleDateString() : "—"}
        {invoice.periodEnd ? ` – ${new Date(invoice.periodEnd).toLocaleDateString()}` : ""}
      </td>
      <td className="py-3 px-4 text-xs text-muted-foreground">
        {invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : "—"}
      </td>
      <td className="py-3 px-4">
        <div className="flex gap-2">
          {invoice.invoicePdfUrl && (
            <a href={invoice.invoicePdfUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
              <Download size={12} /> PDF
            </a>
          )}
          {invoice.hostedInvoiceUrl && (
            <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ExternalLink size={12} /> View
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function BillingInvoicesPage() {
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["billing", "invoices", page],
    queryFn: () => apiListInvoices(limit, page * limit, false),
  });

  const syncMut = useMutation({
    mutationFn: () => apiListInvoices(limit, 0, true),
    onSuccess: () => { toast.success("Invoices synced from Stripe."); refetch(); },
    onError: () => toast.error("Sync failed."),
  });

  const invoices = data?.invoices ?? [];

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><FileText size={20} /> Invoices</h1>
          <p className="text-sm text-muted-foreground mt-1">Your billing history and downloadable invoices.</p>
        </div>
        <button
          onClick={() => syncMut.mutate()}
          disabled={syncMut.isPending}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
        >
          <RefreshCw size={12} className={syncMut.isPending ? "animate-spin" : ""} />
          Sync from Stripe
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading invoices…</div>
      ) : invoices.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
          No invoices yet. Invoices appear here after your first payment.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground">Invoice ID</th>
                <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground">Amount Due</th>
                <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground">Paid</th>
                <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground">Period</th>
                <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground">Paid At</th>
                <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => <InvoiceRow key={inv.id} invoice={inv} />)}
            </tbody>
          </table>
        </div>
      )}

      {invoices.length === limit && (
        <div className="flex gap-2">
          {page > 0 && (
            <button onClick={() => setPage(p => p - 1)} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted">
              Previous
            </button>
          )}
          <button onClick={() => setPage(p => p + 1)} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
