import { NextResponse } from "next/server";
import { z } from "zod";
import { authedRequest, rpcError } from "@/lib/api";

const VoteBody = z.object({ decision: z.enum(["approved", "rejected"]) });

export async function POST(req: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  if (!z.uuid().safeParse(requestId).success) {
    return NextResponse.json({ error: "Approval request not found" }, { status: 404 });
  }

  const ctx = await authedRequest(req, VoteBody);
  if ("error" in ctx) return ctx.error;

  const { data, error } = await ctx.supabase.rpc("cast_approval_vote", {
    p_request_id: requestId,
    p_decision: ctx.body.decision,
  });
  if (error) return rpcError(error);

  return NextResponse.json({ success: true, request: data });
}
