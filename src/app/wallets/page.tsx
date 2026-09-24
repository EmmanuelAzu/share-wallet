import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, type Wallet } from "@/lib/types";
import { CreateWalletForm } from "@/components/wallet/create-wallet-form";

export default async function WalletsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/wallets");

  // RLS limits this to wallets the user belongs to.
  const { data: wallets } = await supabase
    .from("wallets")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Wallet[]>();

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_320px]">
      <section>
        <h1 className="mb-6 text-2xl font-bold">My wallets</h1>
        {wallets?.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {wallets.map((w) => (
              <Link key={w.id} href={`/wallets/${w.id}`}>
                <Card className="transition-colors hover:border-primary">
                  <CardHeader>
                    <CardTitle>{w.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{formatMoney(w.balance, w.currency)}</p>
                    <p className="text-xs text-muted-foreground">
                      {w.admin_id === user.id ? "You are the admin" : "Member"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No wallets yet. Create one to get started.</p>
        )}
      </section>
      <aside>
        <CreateWalletForm />
      </aside>
    </main>
  );
}
