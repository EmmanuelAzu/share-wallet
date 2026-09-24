"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, postJson, type ApprovalRequest } from "@/lib/types";

type PendingRequest = ApprovalRequest & {
  requesterName: string;
  merchant: string;
  amount: number;
  canVote: boolean;
};

export function ApprovalList({ requests, currency }: { requests: PendingRequest[]; currency: string }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function vote(requestId: string, decision: "approved" | "rejected") {
    setBusyId(requestId);
    setError("");
    try {
      await postJson(`/api/v1/payments/approvals/${requestId}/vote`, { decision });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending approvals</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {requests.length === 0 && <p className="text-sm text-muted-foreground">Nothing waiting on the group.</p>}
        {requests.map((r) => (
          <div key={r.id} className="rounded-lg border border-border p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-medium">{r.merchant}</p>
              <p className="tabular-nums">{formatMoney(r.amount, currency)}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {r.requesterName} · {r.current_approvals}/{r.required_approvals} approvals
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(100, (r.current_approvals / r.required_approvals) * 100)}%` }}
              />
            </div>
            {r.canVote && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" disabled={busyId === r.id} onClick={() => vote(r.id, "approved")}>
                  <Check /> Approve
                </Button>
                <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => vote(r.id, "rejected")}>
                  <X /> Reject
                </Button>
              </div>
            )}
          </div>
        ))}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
