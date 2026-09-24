"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

/** Re-renders the wallet page whenever its ledger or approvals change. */
export function WalletRealtime({ walletId }: { walletId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => router.refresh();
    const channel = supabase
      .channel(`wallet:${walletId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_requests", filter: `wallet_id=eq.${walletId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `wallet_id=eq.${walletId}` }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wallets", filter: `id=eq.${walletId}` }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [walletId, router]);

  return null;
}
