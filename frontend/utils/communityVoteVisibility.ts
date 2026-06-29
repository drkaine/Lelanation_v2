/** Minimum total votes (up + down) before auto-privatization is evaluated. */
export const COMMUNITY_VOTE_AUTO_PRIVATE_MIN_TOTAL = 10

/** Minimum upvote share (percent) required to stay public. */
export const COMMUNITY_VOTE_AUTO_PRIVATE_MIN_UPVOTE_PERCENT = 30

export function shouldAutoPrivatizeFromCommunityVotes(upvotes: number, downvotes: number): boolean {
  const totalVotes = upvotes + downvotes
  if (totalVotes < COMMUNITY_VOTE_AUTO_PRIVATE_MIN_TOTAL) return false
  const upvotePercentage = (upvotes / totalVotes) * 100
  return upvotePercentage < COMMUNITY_VOTE_AUTO_PRIVATE_MIN_UPVOTE_PERCENT
}
