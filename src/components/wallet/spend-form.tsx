"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CATEGORIES, postJson } from "@/lib/types";

export function SpendForm({ walletId, isAdmin }: { walletId: string; isAdmin: boolean }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await postJson<{ status: string }>("/api/v1/payments/transact", {
        walletId,
        amount: Math.round(Number(amount) * 100) / 100,
        merchantName,
        category,
      });
      setMessage({
        ok: true,
        text: res.status === "completed" ? "Payment completed." : "Sent to the group for approval.",
      });
      setAmount("");
      setMerchantName("");
      router.refresh();
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New purchase</CardTitle>
        <CardDescription>
          {isAdmin ? "As admin, your purchases complete immediately." : "Your purchase needs group approval."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Input
            required
            placeholder="Merchant"
            value={merchantName}
            onChange={(e) => setMerchantName(e.target.value)}
            aria-label="Merchant"
          />
          <Input
            required
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Amount"
          />
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Category"
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <Button type="submit" disabled={busy}>
            {isAdmin ? "Pay now" : "Request approval"}
          </Button>
          {message && (
            <p className={message.ok ? "text-sm text-success" : "text-sm text-destructive"}>{message.text}</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
