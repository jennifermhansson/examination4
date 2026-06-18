// The allowed order-status flow as a pure, unit-testable guard. An order may
// only move forward one step at a time (pending -> preparing -> ready ->
// completed); isValidStatusTransition returns true only for those steps and is
// used to guard the kitchen PATCH endpoint.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ["preparing"],
  preparing: ["ready"],
  ready: ["completed"],
};

export function isValidStatusTransition(
  current: string,
  next: string,
): boolean {
  return ALLOWED_TRANSITIONS[current]?.includes(next) ?? false;
}
