import type { FastifyReply, FastifyRequest } from "fastify";
import type { TokenPayload } from "../types/auth";

// Dekorering gör det möjligt för oss att lägga in funktioner och objekt
// i Fastify's request, reply eller FastifyInstance.

// Då kan man komma åt det man lagt in direkt via requesten/reply/FastifyInstance
// istället för att importera det.

// Middleware for Admins
async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  //
  const decoded = await request.jwtVerify<TokenPayload>();

  // Nedan är exempel på saker man kan kontrollera i en middleware.

  // Om vi inte returnerar i en middleware så kommer vi tillåta requesten att gå vidare till nästa
  // station.

  // Om vi vill stoppa requesten från att gå vidare bör vi isåfall returnera.

  // Exempel på blacklist:

  // const isBlacklisted = BLACKLIST.includes(decoded.username);

  // if (isBlacklisted)
  //   return reply
  //     .status(403)
  //     .send("You have been blocked from using this service.");

  // Exempel på rollbaserad autentisering:

  // if (decoded.role !== "admin") return reply.status(403).send("Forbidden");

  // Kommer att stoppa requesten från att gå vidare till nästa station, och returnerar istället
  // i det här fallet 400.
  // return reply.status(400).send({ hello: "world" });
}

export default authenticate;
