import { Link } from "@tanstack/react-router";
import { FollowButton } from "@/components/FollowButton";

export type ListUser = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio?: string | null;
};

export function UserListItem({ user }: { user: ListUser }) {
  const name = user.full_name || user.username || "User";
  const handle = user.username ? `@${user.username}` : "";
  const initial = name.charAt(0).toUpperCase();
  const to = user.username ? `/u/${user.username}` : "#";
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Link
        to="/u/$username"
        params={{ username: user.username ?? "" }}
        className="size-12 rounded-full brand-gradient grid place-items-center text-white font-bold shrink-0 overflow-hidden"
        aria-label={`View ${name}`}
      >
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className="size-12 object-cover" />
        ) : (
          initial
        )}
      </Link>
      <Link
        to="/u/$username"
        params={{ username: user.username ?? "" }}
        className="flex-1 min-w-0"
      >
        <p className="font-semibold text-sm truncate">{name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {handle}
          {user.bio ? ` · ${user.bio}` : ""}
        </p>
      </Link>
      <FollowButton targetUserId={user.id} size="sm" />
    </div>
  );
}