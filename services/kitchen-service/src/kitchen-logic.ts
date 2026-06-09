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
