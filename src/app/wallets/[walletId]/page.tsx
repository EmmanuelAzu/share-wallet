import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, type ApprovalRequest, type Member, type Transaction, type Wallet } from "@/lib/types";
import { SpendForm } from "@/components/wallet/spend-form";
import { ApprovalList } from "@/components/wallet/approval-list";
import { AdminPanel } from "@/components/wallet/admin-panel";
import { WalletRealtime } from "@/components/wallet/wallet-realtime";
import { SpendAnalytics } from "@/components/wallet/spend-analytics";

export default async function WalletPage({ params }: { params: Promise<{ walletId: string }> }) {
  const { walletId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/wallets/${walletId}`);

  const { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("id", walletId)
    .maybeSingle<Wallet>();
  if (!wallet) notFound();

  const [members, transactions, requests, votes, burn, perMember, categories] = await Promise.all([
    supabase
      .from("wallet_members")
      .select("user_id, role, profiles(full_name, avatar_url)")
      .eq("wallet_id", walletId)
      .returns<Member[]>(),
    supabase
      .from("transactions")
      .select("*")
      .eq("wallet_id", walletId)
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<Transaction[]>(),
    supabase
      .from("approval_requests")
      .select("*, transactions(merchant_name, amount)")
      .eq("wallet_id", walletId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .returns<(ApprovalRequest & { transactions: { merchant_name: string; amount: number } | null })[]>(),
    supabase.from("approval_votes").select("request_id").eq("voter_id", user.id),
    supabase
      .from("wallet_monthly_burn")
      .select("month, total_spent")
      .eq("wallet_id", walletId)
      .order("month"),
    supabase
      .from("wallet_member_spend")
      .select("full_name, total_spent")
      .eq("wallet_id", walletId)
      .order("total_spent", { ascending: false }),
    supabase.from("wallet_category_spend").select("category, total_spent").eq("wallet_id", walletId),
  ]);

  const memberList = members.data ?? [];
  const txList = transactions.data ?? [];
  const isAdmin = memberList.some((m) => m.user_id === user.id && m.role === "admin");
  const nameOf = (id: string | null) =>
    memberList.find((m) => m.user_id === id)?.profiles?.full_name ?? "Former member";
  const votedOn = new Set((votes.data ?? []).map((v) => v.request_id as string));

  const pending = (requests.data ?? []).map(({ transactions: tx, ...r }) => ({
    ...r,
    requesterName: nameOf(r.requester_id),
    merchant: tx?.merchant_name ?? "",
    amount: tx?.amount ?? 0,
    canVote: r.requester_id !== user.id && !votedOn.has(r.id),
  }));

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10">
      <WalletRealtime walletId={walletId} />
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{wallet.name}</p>
          <p className="text-4xl font-bold">{formatMoney(wallet.balance, wallet.currency)}</p>
        </div>
        <Badge variant={isAdmin ? "default" : "secondary"}>{isAdmin ? "Admin" : "Member"}</Badge>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <SpendForm walletId={walletId} isAdmin={isAdmin} />
        <ApprovalList requests={pending} currency={wallet.currency} />
        {isAdmin ? (
          <AdminPanel walletId={walletId} members={memberList} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Members</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {memberList.map((m) => (
                  <li key={m.user_id}>
                    {m.profiles?.full_name} {m.role === "admin" && <Badge variant="outline">admin</Badge>}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <SpendAnalytics
        currency={wallet.currency}
        burn={(burn.data ?? []).map((b) => ({ month: b.month as string, total: Number(b.total_spent) }))}
        members={(perMember.data ?? []).map((m) => ({
          name: (m.full_name as string | null) ?? "Former member",
          total: Number(m.total_spent),
        }))}
        categories={(categories.data ?? []).map((c) => ({
          category: c.category as string,
          total: Number(c.total_spent),
        }))}
      />

      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {txList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Merchant</th>
                  <th className="font-medium">Category</th>
                  <th className="font-medium">By</th>
                  <th className="font-medium">Status</th>
                  <th className="text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {txList.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="py-2">{t.merchant_name}</td>
                    <td>{t.category}</td>
                    <td>{nameOf(t.initiated_by)}</td>
                    <td>
                      <Badge variant={t.status === "completed" ? "outline" : "secondary"}>{t.status}</Badge>
                    </td>
                    <td className="text-right tabular-nums">{formatMoney(t.amount, wallet.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
