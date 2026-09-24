import { NextResponse } from "next/server";
import { z } from "zod";
import { authedRequest, rpcError } from "@/lib/api";

const CreateWalletBody = z.object({
  name: z.string().trim().min(1).max(80),
  currency: z.string().length(3).toUpperCase().default("USD"),
  approvalThreshold: z.number().int().min(1).max(20).default(2),
});

export async function POST(req: Request) {
  const ctx = await authedRequest(req, CreateWalletBody);
  if ("error" in ctx) return ctx.error;

  const { data, error } = await ctx.supabase.rpc("create_wallet", {
    p_name: ctx.body.name,
    p_currency: ctx.body.currency,
    p_approval_threshold: ctx.body.approvalThreshold,
  });
  if (error) return rpcError(error);

  return NextResponse.json({ success: true, walletId: data }, { status: 201 });
}
