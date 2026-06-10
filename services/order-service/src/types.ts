export type TokenPayload = {
  id: string;
  email: string;
  role: "customer" | "kitchen";
};

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
