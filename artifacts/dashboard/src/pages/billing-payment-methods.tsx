import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreditCard, Star, Trash2 } from "lucide-react";
import {
  apiListPaymentMethods, apiDeletePaymentMethod, apiSetDefaultPaymentMethod,
  type PaymentMethod,
} from "@/lib/billing-client";

const BRAND_ICONS: Record<string, string> = {
  visa:        "💳 Visa",
  mastercard:  "💳 Mastercard",
  amex:        "💳 Amex",
  discover:    "💳 Discover",
  jcb:         "💳 JCB",
  unionpay:    "💳 UnionPay",
};

function PaymentMethodCard({ pm, onDelete, onSetDefault }: {
  pm: PaymentMethod;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  return (
    <div className={`rounded-lg border p-4 flex items-center justify-between gap-4 ${pm.isDefault ? "border-blue-500 bg-blue-500/5" : "border-border"}`}>
      <div className="flex items-center gap-3">
        <CreditCard size={18} className={pm.isDefault ? "text-blue-400" : "text-muted-foreground"} />
        <div>
          <p className="text-sm font-medium">
            {pm.brand ? (BRAND_ICONS[pm.brand] ?? `💳 ${pm.brand}`) : "Card"} •••• {pm.last4 ?? "????"}
          </p>
          <p className="text-xs text-muted-foreground">
            Expires {pm.expMonth?.toString().padStart(2, "0") ?? "??"}/{pm.expYear ?? "??"}
            {pm.isDefault && <span className="ml-2 text-blue-400 font-medium">Default</span>}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        {!pm.isDefault && (
          <button
            onClick={onSetDefault}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors"
            title="Set as default"
          >
            <Star size={11} /> Default
          </button>
        )}
        <button
          onClick={onDelete}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
          title="Remove card"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

export default function BillingPaymentMethodsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["billing", "payment-methods"],
    queryFn: apiListPaymentMethods,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDeletePaymentMethod(id),
    onSuccess: () => { toast.success("Card removed."); qc.invalidateQueries({ queryKey: ["billing", "payment-methods"] }); },
    onError: () => toast.error("Failed to remove card."),
  });

  const defaultMut = useMutation({
    mutationFn: (id: string) => apiSetDefaultPaymentMethod(id),
    onSuccess: () => { toast.success("Default card updated."); qc.invalidateQueries({ queryKey: ["billing", "payment-methods"] }); },
    onError: () => toast.error("Failed to update default card."),
  });

  const methods = data?.paymentMethods ?? [];

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2"><CreditCard size={20} /> Payment Methods</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your saved payment methods. Add new cards through the Stripe billing portal.
        </p>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading payment methods…</div>
      ) : methods.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center space-y-3">
          <CreditCard size={24} className="mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No payment methods saved.</p>
          <p className="text-xs text-muted-foreground">
            Add a card through the Stripe billing portal on the Billing page.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {methods.map(pm => (
            <PaymentMethodCard
              key={pm.id}
              pm={pm}
              onDelete={() => {
                if (pm.isDefault && methods.length > 1) { toast.error("Cannot delete the default payment method."); return; }
                deleteMut.mutate(pm.id);
              }}
              onSetDefault={() => defaultMut.mutate(pm.id)}
            />
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Add a new card</p>
        <p>To add a new payment method, click "Manage in Stripe" on the Billing page to open the Stripe customer portal. All card data is securely handled by Stripe — no card numbers are stored on our servers.</p>
      </div>
    </div>
  );
}
