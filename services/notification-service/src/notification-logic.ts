// Map an order status to the Swedish message shown to the customer. Returns
// null for unknown statuses so the caller can skip creating a notification.
// Pure function, so it's easy to unit test.
export function messageForStatus(status: string): string | null {
  switch (status) {
    case "pending":
      return "Din order har mottagits och väntar på att tillagas.";
    case "preparing":
      return "Din order tillagas nu i köket!";
    case "ready":
      return "Din order är klar! Hämta den vid disken.";
    case "completed":
      return "Tack för din order! Vi ses snart igen.";
    default:
      return null;
  }
}
