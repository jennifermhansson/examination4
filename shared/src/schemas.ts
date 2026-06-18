// Zod schemas for data that arrives over HTTP. Routes call .parse() on the
// request input at the top of the handler, so invalid input is rejected at the
// boundary (turned into a 400 by the shared error handler) before any business
// logic or DB call runs. uuidSchema replaces the old per-service UUID regex.
// createOrderSchema validates the request *shape* only; domain rules like
// "at least one item" / "quantity > 0" stay in order-logic, and the allowed
// status *transitions* stay in kitchen-logic.
import { z } from "zod";

export const uuidSchema = z.uuid();

export const createOrderSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number(),
    }),
  ),
});
export type CreateOrderRequest = z.infer<typeof createOrderSchema>;

export const kitchenStatusSchema = z.object({
  status: z.enum(["preparing", "ready", "completed"]),
});
export type KitchenStatusRequest = z.infer<typeof kitchenStatusSchema>;
