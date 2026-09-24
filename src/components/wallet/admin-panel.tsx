"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { postJson, type Member } from "@/lib/types";

export function AdminPanel({ walletId, members }: { walletId: string; members: Member[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [deposit, setDeposit] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(action: () => Promise<unknown>, success: string) {
    setMessage(null);
    try {
      await action();
      setMessage({ ok: true, text: success });
      router.refresh();
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage wallet</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => postJson(`/api/v1/wallets/${walletId}/deposit`, { amount: Math.round(Number(deposit) * 100) / 100 }),
              "Deposit added.",
            ).then(() => setDeposit(""));
          }}
        >
          <Input
            type="number"
            min="0.01"
            step="0.01"
            required
            placeholder="Deposit amount"
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
            aria-label="Deposit amount"
          />
          <Button type="submit" variant="secondary">
            Deposit
          </Button>
        </form>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => postJson(`/api/v1/wallets/${walletId}/members`, { email }), "Member added.").then(() =>
              setEmail(""),
            );
          }}
        >
          <Input
            type="email"
            required
            placeholder="member@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Member email"
          />
          <Button type="submit" variant="outline">
            Invite
          </Button>
        </form>
        {message && (
          <p className={message.ok ? "text-sm text-success" : "text-sm text-destructive"}>{message.text}</p>
        )}
        <ul className="space-y-1 text-sm">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-2">
              {m.profiles?.full_name}
              {m.role === "admin" && <Badge variant="outline">admin</Badge>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
