import "server-only";

import { randomBytes } from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type AccessRequestStatus = "pending" | "approved" | "rejected";

export type AccessRequestAdminRow = {
  id: string;
  business_name: string;
  owner_name: string | null;
  email: string;
  phone: string | null;
  website_url: string | null;
  instagram_url: string | null;
  business_type: string | null;
  note: string | null;
  status: AccessRequestStatus;
  reviewed_at: string | null;
  reviewed_by_user_id: string | null;
  invite_code_id: string | null;
  created_at: string;
  updated_at: string;
  invite_code: string | null;
  invite_expires_at: string | null;
  invite_is_active: boolean | null;
  invite_uses_count: number | null;
  invite_max_uses: number | null;
};

export type ManualInviteCodeRow = {
  id: string;
  code: string;
  assigned_email: string | null;
  assigned_business_name: string | null;
  max_uses: number;
  uses_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
};

type InviteCodeRow = {
  id: string;
  code: string;
  source: string;
  access_request_id: string | null;
  assigned_email: string | null;
  assigned_business_name: string | null;
  max_uses: number;
  uses_count: number;
  is_active: boolean;
  expires_at: string | null;
  used_by_user_id: string | null;
  used_at: string | null;
  created_by_user_id: string | null;
  created_at: string;
};

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_PREFIX = "SC";

const normalizeOptionalText = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const normalizeInviteCode = (value: string | null | undefined) =>
  value?.trim().toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9-]/g, "") ?? "";

export const normalizeStoredEmail = (value: string | null | undefined) =>
  value?.trim().toLowerCase() ?? "";

export const normalizeOptionalUrl = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    return parsed.toString();
  } catch {
    return trimmed;
  }
};

const isUniqueViolation = (error: any) =>
  error?.code === "23505" || /duplicate|unique/i.test(error?.message ?? "");

const randomInviteSegment = (length = 6) => {
  const bytes = randomBytes(length);
  let result = "";

  for (let index = 0; index < length; index += 1) {
    result += INVITE_ALPHABET[bytes[index] % INVITE_ALPHABET.length];
  }

  return result;
};

export const mapInviteCodeErrorToMessage = (code: string | null | undefined) => {
  switch ((code ?? "").trim()) {
    case "invite_not_found":
      return "Invalid invite code.";
    case "invite_inactive":
      return "This invite code is no longer active.";
    case "invite_expired":
      return "This invite code has expired.";
    case "invite_exhausted":
      return "This invite code has already been used.";
    case "invite_email_mismatch":
      return "This invite code is assigned to a different email address.";
    default:
      return "Registration is unavailable right now.";
  }
};

export async function createInviteCode(params: {
  source: "manual" | "access_request";
  accessRequestId?: string | null;
  assignedEmail?: string | null;
  assignedBusinessName?: string | null;
  maxUses?: number;
  expiresAt?: string | null;
  createdByUserId?: string | null;
}) {
  const admin = getSupabaseAdminClient() as any;
  const normalizedEmail = normalizeStoredEmail(params.assignedEmail);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `${INVITE_PREFIX}-${randomInviteSegment(6)}`;
    const { data, error } = await admin
      .from("invite_codes")
      .insert({
        code,
        source: params.source,
        access_request_id: params.accessRequestId ?? null,
        assigned_email: normalizedEmail || null,
        assigned_business_name: normalizeOptionalText(params.assignedBusinessName),
        max_uses: params.maxUses ?? 1,
        expires_at: params.expiresAt ?? null,
        created_by_user_id: params.createdByUserId ?? null
      })
      .select("*")
      .single();

    if (!error && data?.id) {
      return data as InviteCodeRow;
    }

    if (!isUniqueViolation(error)) {
      throw error ?? new Error("Failed to create invite code");
    }
  }

  throw new Error("Failed to generate a unique invite code");
}

export async function listAccessRequests(status?: AccessRequestStatus | "all") {
  const admin = getSupabaseAdminClient() as any;
  let query = admin.from("access_requests").select("*").order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const rows = (data ?? []) as Array<Record<string, any>>;
  const inviteIds = Array.from(
    new Set(rows.map((row) => row.invite_code_id).filter((value): value is string => typeof value === "string" && value.length > 0))
  );

  const inviteMap = new Map<string, InviteCodeRow>();
  if (inviteIds.length > 0) {
    const { data: invites, error: inviteError } = await admin.from("invite_codes").select("*").in("id", inviteIds);
    if (inviteError) {
      throw inviteError;
    }
    (invites ?? []).forEach((invite: InviteCodeRow) => {
      inviteMap.set(invite.id, invite);
    });
  }

  return rows.map((row) => {
    const invite = row.invite_code_id ? inviteMap.get(row.invite_code_id) : null;
    return {
      ...(row as Omit<AccessRequestAdminRow, "invite_code" | "invite_expires_at" | "invite_is_active" | "invite_uses_count" | "invite_max_uses">),
      invite_code: invite?.code ?? null,
      invite_expires_at: invite?.expires_at ?? null,
      invite_is_active: invite?.is_active ?? null,
      invite_uses_count: invite?.uses_count ?? null,
      invite_max_uses: invite?.max_uses ?? null
    } satisfies AccessRequestAdminRow;
  });
}

export async function listRecentManualInviteCodes(limit = 10) {
  const admin = getSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from("invite_codes")
    .select("id, code, assigned_email, assigned_business_name, max_uses, uses_count, is_active, expires_at, created_at")
    .eq("source", "manual")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as ManualInviteCodeRow[];
}

export async function findInviteCodeForRegistration(code: string, email: string) {
  const admin = getSupabaseAdminClient() as any;
  const normalizedCode = normalizeInviteCode(code);
  const normalizedEmail = normalizeStoredEmail(email);

  const { data, error } = await admin.from("invite_codes").select("*").eq("code", normalizedCode).maybeSingle();
  if (error) {
    throw error;
  }

  const invite = (data as InviteCodeRow | null) ?? null;
  if (!invite) {
    return { ok: false as const, error: "Invalid invite code." };
  }

  if (!invite.is_active) {
    return { ok: false as const, error: "This invite code is no longer active." };
  }

  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
    return { ok: false as const, error: "This invite code has expired." };
  }

  if (invite.uses_count >= invite.max_uses) {
    return { ok: false as const, error: "This invite code has already been used." };
  }

  if (invite.assigned_email && normalizeStoredEmail(invite.assigned_email) !== normalizedEmail) {
    return { ok: false as const, error: "This invite code is assigned to a different email address." };
  }

  return {
    ok: true as const,
    invite
  };
}

export async function approveAccessRequest(requestId: string, adminUserId: string) {
  const admin = getSupabaseAdminClient() as any;
  const { data: existing, error } = await admin.from("access_requests").select("*").eq("id", requestId).maybeSingle();
  if (error) {
    throw error;
  }

  const request = existing as Record<string, any> | null;
  if (!request?.id) {
    throw new Error("Access request not found");
  }

  let invite: InviteCodeRow | null = null;

  if (request.invite_code_id) {
    const { data: existingInvite, error: inviteError } = await admin
      .from("invite_codes")
      .select("*")
      .eq("id", request.invite_code_id)
      .maybeSingle();

    if (inviteError) {
      throw inviteError;
    }

    invite = (existingInvite as InviteCodeRow | null) ?? null;
  }

  if (!invite) {
    invite = await createInviteCode({
      source: "access_request",
      accessRequestId: request.id,
      assignedEmail: request.email,
      assignedBusinessName: request.business_name,
      maxUses: 1,
      createdByUserId: adminUserId
    });
  }

  const { error: updateError } = await admin
    .from("access_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by_user_id: adminUserId,
      invite_code_id: invite.id
    })
    .eq("id", request.id);

  if (updateError) {
    throw updateError;
  }

  return { requestId: request.id as string, invite };
}

export async function rejectAccessRequest(requestId: string, adminUserId: string) {
  const admin = getSupabaseAdminClient() as any;
  const { data: existing, error } = await admin
    .from("access_requests")
    .select("id, invite_code_id")
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!existing?.id) {
    throw new Error("Access request not found");
  }

  if (existing.invite_code_id) {
    const { error: inviteError } = await admin
      .from("invite_codes")
      .update({ is_active: false })
      .eq("id", existing.invite_code_id);

    if (inviteError) {
      throw inviteError;
    }
  }

  const { error: updateError } = await admin
    .from("access_requests")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by_user_id: adminUserId
    })
    .eq("id", requestId);

  if (updateError) {
    throw updateError;
  }
}

export async function createManualInviteCode(params: {
  assignedEmail?: string | null;
  assignedBusinessName?: string | null;
  maxUses?: number;
  expiresAt?: string | null;
  createdByUserId: string;
}) {
  return createInviteCode({
    source: "manual",
    assignedEmail: params.assignedEmail,
    assignedBusinessName: params.assignedBusinessName,
    maxUses: params.maxUses ?? 1,
    expiresAt: params.expiresAt ?? null,
    createdByUserId: params.createdByUserId
  });
}
