// Internal order-service types. CreateOrderItem is one line item as it arrives
// from the client (product + quantity only; prices are resolved server-side).
// ProductFromService is the shape of a product as held in the local cache.
export type CreateOrderItem = {
  productId: string;
  quantity: number;
};

export type ProductFromService = {
  id: string;
  name: string;
  description: string | null;
  price: number;
};
