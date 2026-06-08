export type TokenPayload = {
  username: string;
  email: string;
  role: "user" | "admin";
};
