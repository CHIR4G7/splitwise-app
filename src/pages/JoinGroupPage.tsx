import { useNavigate, useParams } from "react-router-dom";
import { Alert, Button, Spinner } from "@/components/ui";
import { useInvitePreview, useJoinGroup } from "@/features/groups/api";
import { AuthLayout } from "@/pages/AuthLayout";

export function JoinGroupPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const preview = useInvitePreview(token);
  const joinGroup = useJoinGroup();

  async function handleJoin() {
    if (!token) return;
    const groupId = await joinGroup.mutateAsync(token);
    navigate(`/groups/${groupId}`, { replace: true });
  }

  if (preview.isLoading) return <Spinner label="Checking invite" />;

  if (preview.isError || !preview.data) {
    return (
      <AuthLayout title="Invite unavailable" subtitle="This link can't be used.">
        <div className="flex flex-col gap-4">
          <Alert>This invite has expired, been revoked, or reached its limit. Ask for a fresh link.</Alert>
          <Button variant="secondary" block onClick={() => navigate("/groups")}>
            Go to my groups
          </Button>
        </div>
      </AuthLayout>
    );
  }

  const invite = preview.data;

  return (
    <AuthLayout title="You're invited" subtitle="Join the group to start splitting expenses together.">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-card text-2xl">
            {invite.group_icon}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{invite.group_name}</p>
            <p className="text-sm text-slate-600">{invite.member_count} members</p>
          </div>
        </div>

        {joinGroup.isError && (
          <Alert>{joinGroup.error instanceof Error ? joinGroup.error.message : "Could not join this group."}</Alert>
        )}

        {invite.already_member ? (
          <Button block onClick={() => navigate(`/groups/${invite.group_id}`, { replace: true })}>
            You're already a member — open group
          </Button>
        ) : (
          <Button block onClick={handleJoin} disabled={joinGroup.isPending}>
            {joinGroup.isPending ? "Joining…" : `Join ${invite.group_name}`}
          </Button>
        )}
      </div>
    </AuthLayout>
  );
}
