export type Role = "admin" | "member";

export interface Wallet {
  id: string;
  name: string;
  admin_id: string;
  balance: number;
  currency: string;
  approval_threshold: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  wallet_id: string;
  initiated_by: string | null;
  amount: number;
  merchant_name: string;
  category: string;
  status: "pending" | "approved" | "rejected" | "completed";
  created_at: string;
}

export interface ApprovalRequest {
  id: string;
  transaction_id: string;
  wallet_id: string;
  requester_id: string;
  required_approvals: number;
  current_approvals: number;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface Member {
  user_id: string;
  role: Role;
  profiles: { full_name: string; avatar_url: string | null } | null;
}

export const CATEGORIES = ["Food & Pizza", "SaaS", "Cloud Bills", "Travel", "Hardware", "Other"];

export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

/** POSTs JSON to one of our API routes and throws with the server's message on failure. */
export async function postJson<T = unknown>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}
