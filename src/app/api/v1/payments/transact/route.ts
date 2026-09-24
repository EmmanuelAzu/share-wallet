import { NextResponse } from "next/server";
import { z } from "zod";
import { authedRequest, rpcError } from "@/lib/api";

const TransactBody = z.object({
  walletId: z.uuid(),
  amount: z.number().positive().multipleOf(0.01),
  merchantName: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(60),
});

export async function POST(req: Request) {
  const ctx = await authedRequest(req, TransactBody);
  if ("error" in ctx) return ctx.error;
  const { supabase, user, body } = ctx;

  const { data: member } = await supabase
    .from("wallet_members")
    .select("role")
    .eq("wallet_id", body.walletId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "Access denied" }, { status: 403 });

  const args = {
    p_wallet_id: body.walletId,
    p_amount: body.amount,
    p_merchant: body.merchantName,
    p_category: body.category,
  };

  if (member.role === "admin") {
    // Immediate execution
    const { data, error } = await supabase.rpc("execute_wallet_deduction", args);
    if (error) return rpcError(error);
    return NextResponse.json({ success: true, status: "completed", transaction: data });
  }

  // Member purchase: pending transaction + approval request, created atomically
  const { data: request, error } = await supabase.rpc("request_member_purchase", args);
  if (error) return rpcError(error);
  return NextResponse.json(
    { success: true, status: "pending_approval", requestId: request.id, request },
    { status: 202 },
  );
}
