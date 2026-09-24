import { NextResponse } from "next/server";
import { z } from "zod";
import { authedRequest, rpcError } from "@/lib/api";

const AddMemberBody = z.object({ email: z.email() });

export async function POST(req: Request, { params }: { params: Promise<{ walletId: string }> }) {
  const { walletId } = await params;
  const ctx = await authedRequest(req, AddMemberBody);
  if ("error" in ctx) return ctx.error;

  const { data, error } = await ctx.supabase.rpc("add_wallet_member", {
    p_wallet_id: walletId,
    p_email: ctx.body.email,
  });
  if (error) return rpcError(error);

  return NextResponse.json({ success: true, userId: data }, { status: 201 });
}
