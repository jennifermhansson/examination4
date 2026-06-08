export type CustomerRow = {
  id: number;
  firstName: string;
  email: string;
  phone: string;
  birthdate: string;
  password: string;
  created_at: Date;
  updated_at: Date | null;
};

export type PostRow = {
  id: number; // automatiskt
  user_id: number; // hämtar vi genom username med SQL
  created_at: Date; // sätter vi i koden (new Date().toISOString())
};


