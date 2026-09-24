"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { postJson } from "@/lib/types";

export function CreateWalletForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [threshold, setThreshold] = useState(2);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { walletId } = await postJson<{ walletId: string }>("/api/v1/wallets", {
        name,
        approvalThreshold: threshold,
      });
      router.push(`/wallets/${walletId}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New wallet</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Input
            required
            placeholder="Hackathon team fund"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Wallet name"
          />
          <label className="flex items-center justify-between gap-3 text-sm">
            Approvals needed for member purchases
            <Input
              type="number"
              min={1}
              max={20}
              className="w-20"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </label>
          <Button type="submit" disabled={busy}>
            Create wallet
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
