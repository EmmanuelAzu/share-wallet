import { NextResponse } from "next/server";
import { z } from "zod";
import { authedRequest, rpcError } from "@/lib/api";

const DepositBody = z.object({ amount: z.number().positive().multipleOf(0.01) });

export async function POST(req: Request, { params }: { params: Promise<{ walletId: string }> }) {
  const { walletId } = await params;
  const ctx = await authedRequest(req, DepositBody);
  if ("error" in ctx) return ctx.error;

  const { data, error } = await ctx.supabase.rpc("deposit_to_wallet", {
    p_wallet_id: walletId,
    p_amount: ctx.body.amount,
  });
  if (error) return rpcError(error);

  return NextResponse.json({ success: true, balance: data });
}
