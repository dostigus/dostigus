/**
 * The Bot is live while a reply is in flight, while the header mark is
 * speaking or cheering that landing, and during the short failed-send pose.
 * Idle, sleep, greet, and listen stay quiet.
 */
export function botIsLive(flags: {
  pending: boolean
  replying: boolean
  cheering: boolean
  failed: boolean
}): boolean {
  return flags.pending || flags.replying || flags.cheering || flags.failed
}
