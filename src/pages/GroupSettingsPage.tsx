import { Check, ChevronLeft, Copy, Link2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Alert, Avatar, Button, Card, Field, SelectField, Spinner } from "@/components/ui";
import { useCategories, useCreateCategory } from "@/features/expenses/api";
import {
  inviteUrl,
  useCreateInvite,
  useDeleteGroup,
  useGroup,
  useGroupMembers,
  useInvites,
  useLeaveGroup,
  useRemoveMember,
  useRevokeInvite
} from "@/features/groups/api";
import { useAuth } from "@/lib/auth";

const EXPIRY_OPTIONS = [
  { label: "7 days", value: "7" },
  { label: "30 days", value: "30" },
  { label: "Never expires", value: "never" }
];

export function GroupSettingsPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const navigate = useNavigate();

  const group = useGroup(groupId);
  const members = useGroupMembers(groupId);
  const invites = useInvites(groupId);
  const createInvite = useCreateInvite(groupId!);
  const revokeInvite = useRevokeInvite(groupId!);
  const removeMember = useRemoveMember(groupId!);
  const leaveGroup = useLeaveGroup();
  const deleteGroup = useDeleteGroup();

  const categories = useCategories(groupId);
  const createCategory = useCreateCategory(groupId!);

  const [expiry, setExpiry] = useState("7");
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("🏷️");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOwner = members.data?.some((m) => m.user_id === userId && m.role === "owner") ?? false;

  async function handleCreateInvite() {
    if (!userId) {
      setError("Your session expired. Sign in again to create an invite link.");
      return;
    }
    setError(null);
    try {
      await createInvite.mutateAsync({
        userId,
        expiresInDays: expiry === "never" ? null : Number(expiry),
        maxUses: null
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create an invite link.");
    }
  }

  async function handleCopy(token: string) {
    await navigator.clipboard.writeText(inviteUrl(token));
    setCopiedToken(token);
    window.setTimeout(() => setCopiedToken(null), 2000);
  }

  async function handleLeave() {
    if (!userId || !groupId) return;
    await leaveGroup.mutateAsync({ groupId, userId });
    navigate("/groups", { replace: true });
  }

  async function handleDelete() {
    if (!groupId) return;
    await deleteGroup.mutateAsync(groupId);
    navigate("/groups", { replace: true });
  }

  if (group.isLoading) return <Spinner label="Loading settings" />;
  if (!group.data) return <Alert>This group doesn't exist, or you're not a member of it.</Alert>;

  return (
    <div className="flex flex-col gap-5">
      <Link
        to={`/groups/${groupId}`}
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ChevronLeft size={16} aria-hidden />
        {group.data.name}
      </Link>

      <h1 className="text-xl font-semibold text-slate-900">Group settings</h1>
      {error && <Alert>{error}</Alert>}

      <Card>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Invite people</h2>
        <p className="mb-3 text-sm text-slate-600">
          Anyone with the link can join this group. Revoke a link to stop it working.
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <SelectField label="Link expiry" value={expiry} onChange={(e) => setExpiry(e.target.value)}>
              {EXPIRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </div>
          <Button onClick={handleCreateInvite} disabled={createInvite.isPending}>
            <Link2 size={16} aria-hidden />
            {createInvite.isPending ? "Creating…" : "Create link"}
          </Button>
        </div>

        {invites.data && invites.data.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {invites.data.map((invite) => (
              <li key={invite.token} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2">
                <code className="min-w-0 flex-1 truncate text-xs text-slate-600">{inviteUrl(invite.token)}</code>
                <Button size="sm" variant="secondary" onClick={() => handleCopy(invite.token)}>
                  {copiedToken === invite.token ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                  {copiedToken === invite.token ? "Copied" : "Copy"}
                </Button>
                {isOwner && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Revoke link"
                    onClick={() => revokeInvite.mutate(invite.token)}
                  >
                    <Trash2 size={14} aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Members</h2>
        <ul className="flex flex-col gap-2">
          {members.data?.map((member) => (
            <li key={member.user_id} className="flex items-center gap-3">
              <Avatar name={member.profile.display_name} url={member.profile.avatar_url} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-slate-800">{member.profile.display_name}</span>
                <span className="block truncate text-xs text-slate-500">{member.profile.email}</span>
              </span>
              {member.role === "owner" ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Owner</span>
              ) : (
                isOwner && (
                  <Button size="sm" variant="ghost" onClick={() => removeMember.mutate(member.user_id)}>
                    Remove
                  </Button>
                )
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Categories</h2>
        <p className="mb-3 text-sm text-slate-600">
          Every group starts with a shared set. Anything you add here belongs to this group only.
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!newCategory.trim()) return;
            setError(null);
            try {
              await createCategory.mutateAsync({ name: newCategory, icon: newCategoryIcon });
              setNewCategory("");
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Could not add that category.");
            }
          }}
          className="flex items-end gap-2"
        >
          <input
            aria-label="Category icon"
            value={newCategoryIcon}
            onChange={(e) => setNewCategoryIcon(e.target.value)}
            maxLength={2}
            className="w-14 rounded-lg border border-slate-300 px-2 py-2.5 text-center text-lg focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <div className="flex-1">
            <Field
              label="New category"
              placeholder="Fuel, gifts, subscriptions…"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={createCategory.isPending}>
            Add
          </Button>
        </form>

        <ul className="mt-4 flex flex-wrap gap-2">
          {categories.data?.map((category) => (
            <li
              key={category.id}
              className={
                category.group_id
                  ? "rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm text-brand-800"
                  : "rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-600"
              }
            >
              {category.icon} {category.name}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="border-red-200">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-700">Danger zone</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleLeave}>
            Leave group
          </Button>
          {isOwner && (
            <Button variant="danger" onClick={handleDelete}>
              Delete group
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
