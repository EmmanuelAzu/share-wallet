import { NextResponse } from "next/server";
import type { z } from "zod";
import { createClient } from "@/utils/supabase/server";

// Maps exceptions raised inside the Postgres RPCs to HTTP responses.
const RPC_ERRORS: Record<string, { status: number; message: string }> = {
  not_authenticated: { status: 401, message: "Unauthorized" },
  not_a_member: { status: 403, message: "Access denied" },
  only_admin_can_invite: { status: 403, message: "Only the wallet admin can invite members" },
  only_admin_can_deposit: { status: 403, message: "Only the wallet admin can deposit" },
  only_admin_can_spend_directly: { status: 403, message: "Only the wallet admin can spend directly" },
  cannot_vote_on_own_request: { status: 403, message: "You cannot vote on your own request" },
  request_not_found: { status: 404, message: "Approval request not found" },
  user_not_found: { status: 404, message: "No user with that email" },
  request_already_resolved: { status: 409, message: "This request has already been resolved" },
  insufficient_funds: { status: 409, message: "Insufficient wallet balance" },
  invalid_amount: { status: 422, message: "Amount must be positive" },
  invalid_decision: { status: 422, message: "Decision must be 'approved' or 'rejected'" },
};

export function rpcError(error: { message: string; code?: string }) {
  if (error.code === "23505") {
    return NextResponse.json({ error: "You have already voted on this request" }, { status: 409 });
  }
  const known = RPC_ERRORS[error.message];
  if (known) return NextResponse.json({ error: known.message }, { status: known.status });
  console.error(error);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}

/** Parses the JSON body and resolves the signed-in user, or returns an error response. */
export async function authedRequest<T extends z.ZodType>(req: Request, schema: T) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return {
      error: NextResponse.json(
        { error: "Invalid request body", issues: parsed.error.issues },
        { status: 422 },
      ),
    } as const;
  }

  return { supabase, user, body: parsed.data as z.infer<T> } as const;
}
