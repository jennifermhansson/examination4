export type RegisterRequest = {
  username: string;
  email: string;
  phone: string;
  birthdate: string;
  password: string;
};

// Vad en inloggad användare får ha tillgång till
export type Customer = {
  id: number;
  username: string;
  email: string;
  phone: string;
  birthdate: string;
  created_at: Date;
  updated_at: Date | null;
};

// DatabaseUser, som är den kompletta användaren som bara finns i databasen eller som admins kan se.

// AuthenticatedUser så som användaren själv ska få när den är inloggad

// PublicUser, vad andra användare kan se om användaren

export type LoginRequest = {
  username: string;
  password: string;
};

export type AuthResponse = {
  token: string;
  user: Customer;
};
