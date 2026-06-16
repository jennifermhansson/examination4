// One line item as it arrives from the client in the order form
// (just which product and how many). Prices are looked up server-side.
export type CreateOrderItem = {
  productId: string;
  quantity: number;
};

// Shape of a product as returned by the product-service.
export type ProductFromService = {
  id: string;
  name: string;
  description: string | null;
  price: number;
};
