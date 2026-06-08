export type RegisterRequest = {
  username: string;
  email: string;
  phone: string;
  birthdate: string;
  password: string;
};

// Vad en inloggad kund får ha tillgång till
export type Customer = {
  id: number;
  username: string;
  email: string;
  phone: string;
  birthdate: string;
  created_at: Date;
  updated_at: Date | null;
};

export type LoginRequest = {
  username: string;
  password: string;
};

export type AuthResponse = {
  token: string;
  user: Customer;
};
