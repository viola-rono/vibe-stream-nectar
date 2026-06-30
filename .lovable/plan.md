Building this in 3 phases across multiple turns. This turn = Phase 1.

## Phase 1 (this turn) — Profile + Social Graph

**New routes**
- `/u/$username` — public profile view matching screenshot: gradient header with @username, avatar, full name, bio, location, joined date, stat tiles (Posts / Followers / Following), Edit Profile + Settings buttons (own profile) OR Follow / Message (other users), 3-tab strip (Posts / Reels / Saved), 3-column posts grid (clickable).
- `/u/$username/followers` and `/u/$username/following` — searchable user lists with Follow/Unfollow buttons.
- `/p/$postId` — full post detail page (placeholder for Phase 2 comments).
- `/settings` — moved from hub; full settings shell (account, privacy, notifications, appearance, sign out).
- Update `/explore` — grid of all registered users with Follow buttons + search.
- Update `/hub` and bottom nav — "Profile" tab links to `/u/<myUsername>`.

**Components**
- `UserListItem` (avatar, name, @username, bio snippet, Follow button).
- `PostGridTile` (square thumbnail, multi-image badge).
- `FollowButton` (optimistic toggle via `follows` table).

**Data**
- Profile fetched by username (not just id).
- Stats from `profiles.post_count/follower_count/following_count` (existing trigger-maintained columns).
- Posts grid fetched by `user_id` with media.
- All registered users for Explore — paginated list.

**No DB changes** — existing schema (profiles, posts, follows) is sufficient.

## Phase 2 (next turn) — Post Interactions
- Post detail with photo lightbox (click image to zoom).
- Threaded comments with likes (`comments` table — add `parent_id` migration).
- @mention autocomplete (searches profiles by username as you type).
- Hashtag linking → `/tag/$tag` route.
- Comment like table (new mini-table or reuse `likes` with `target_type`).

## Phase 3 — Composer Power-ups
- Feeling/Activity picker (curated list with emojis).
- Location autocomplete via OpenStreetMap Nominatim (free, no key).
- Tag People — search followers/following.
- Add Song — iTunes Search API (free, 30s previews).
- Hashtags input chips.
- Facebook-style colored post themes for short text posts (≤130 chars, no media) — gradient backgrounds stored in `background_color` column (already exists).

## Out of scope
- Stories ring + Highlights, Reels feed, Shop, Analytics tabs, Premium upsell card, link-in-bio rows — the screenshot has them but they're Phase 4+. Phase 1 ships the structure; those become "Coming soon" tiles.

Starting Phase 1 implementation immediately after approval.