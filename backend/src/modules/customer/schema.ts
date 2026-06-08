export const loginSchema = {
  body: {
    type: "object",
    required: ["username", "password"],
    properties: {
      username: {
        type: "string",
        minLength: 3,
        maxLength: 30,
      },
      password: {
        type: "string",
        minLength: 8,
      },
    },
    additionalProperties: false,
  },
};

export const registerSchema = {
  body: {
    type: "object",
    required: ["username", "email", "phone", "birthdate", "password"],
    properties: {
      username: {
        type: "string",
        minLength: 3,
        maxLength: 30,
      },
      email: {
        type: "string",
        format: "email",
      },
      phone: {
        type: "string",
        pattern: "^\\+?[1-9]\\d{7,14}$",
      },
      birthdate: {
        type: "string",
        format: "date",
      },
      password: {
        type: "string",
        minLength: 8,
      },
    },
    additionalProperties: false,
  },
};
