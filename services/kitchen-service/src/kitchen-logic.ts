// The allowed order-status flow. An order can only move forward one step at a
// time: pending → preparing → ready → completed.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ["preparing"],
  preparing: ["ready"],
  ready: ["completed"],
};

// Returns true only if moving from `current` to `next` is one of the allowed
// transitions above. Pure function, used to guard the PATCH endpoint.
export function isValidStatusTransition(
  current: string,
  next: string,
): boolean {
  return ALLOWED_TRANSITIONS[current]?.includes(next) ?? false;
}
