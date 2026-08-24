import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Group, GroupMember, Invite, InvitePreview } from "@/types/models";

const TOKEN_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generateInviteToken(length = 22) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => TOKEN_ALPHABET[b % TOKEN_ALPHABET.length]).join("");
}

export function inviteUrl(token: string) {
  return `${window.location.origin}/join/${token}`;
}

export function useGroups() {
  return useQuery({
    queryKey: ["groups"],
    queryFn: async (): Promise<Group[]> => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, name, icon, default_currency, created_by, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Group[];
    }
  });
}

export function useGroup(groupId: string | undefined) {
  return useQuery({
    queryKey: ["group", groupId],
    enabled: Boolean(groupId),
    queryFn: async (): Promise<Group> => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, name, icon, default_currency, created_by, created_at")
        .eq("id", groupId!)
        .single();
      if (error) throw error;
      return data as Group;
    }
  });
}

export function useGroupMembers(groupId: string | undefined) {
  return useQuery({
    queryKey: ["group-members", groupId],
    enabled: Boolean(groupId),
    queryFn: async (): Promise<GroupMember[]> => {
      const { data, error } = await supabase
        .from("group_members")
        .select("group_id, user_id, role, joined_at, profile:profiles(id, email, display_name, avatar_url, default_currency)")
        .eq("group_id", groupId!)
        .order("joined_at", { ascending: true });
      if (error) throw error;
      return data as unknown as GroupMember[];
    }
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; icon: string; currency: string }) => {
      // Goes through the RPC so the group and its owner membership are written together;
      // created_by comes from the session inside the function, not from here.
      const { data, error } = await supabase.rpc("create_group", {
        p_name: input.name,
        p_icon: input.icon,
        p_currency: input.currency
      });
      if (error) throw error;
      return data as Group;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups"] })
  });
}

export function useUpdateGroup(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Pick<Group, "name" | "icon" | "default_currency">>) => {
      const { error } = await supabase.from("groups").update(patch).eq("id", groupId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", groupId] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    }
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.from("groups").delete().eq("id", groupId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups"] })
  });
}

export function useLeaveGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { groupId: string; userId: string }) => {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", input.groupId)
        .eq("user_id", input.userId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups"] })
  });
}

export function useRemoveMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["group-members", groupId] })
  });
}

export function useInvites(groupId: string | undefined) {
  return useQuery({
    queryKey: ["invites", groupId],
    enabled: Boolean(groupId),
    queryFn: async (): Promise<Invite[]> => {
      const { data, error } = await supabase
        .from("invites")
        .select("token, group_id, created_by, expires_at, max_uses, uses, revoked_at, created_at")
        .eq("group_id", groupId!)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Invite[];
    }
  });
}

export function useCreateInvite(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; expiresInDays: number | null; maxUses: number | null }) => {
      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
        : null;
      const { data, error } = await supabase
        .from("invites")
        .insert({
          token: generateInviteToken(),
          group_id: groupId,
          created_by: input.userId,
          expires_at: expiresAt,
          max_uses: input.maxUses
        })
        .select("token, group_id, created_by, expires_at, max_uses, uses, revoked_at, created_at")
        .single();
      if (error) throw error;
      return data as Invite;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invites", groupId] })
  });
}

export function useRevokeInvite(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const { error } = await supabase
        .from("invites")
        .update({ revoked_at: new Date().toISOString() })
        .eq("token", token);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invites", groupId] })
  });
}

export function useInvitePreview(token: string | undefined) {
  return useQuery({
    queryKey: ["invite-preview", token],
    enabled: Boolean(token),
    retry: false,
    queryFn: async (): Promise<InvitePreview | null> => {
      const { data, error } = await supabase.rpc("preview_invite", { p_token: token });
      if (error) throw error;
      const rows = data as InvitePreview[];
      return rows?.[0] ?? null;
    }
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string): Promise<string> => {
      const { data, error } = await supabase.rpc("join_group_with_invite", { p_token: token });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups"] })
  });
}
