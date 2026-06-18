// RabbitMQ helpers shared by every service: connect (with retry, since services
// start in parallel with the broker), publish a domain event, and subscribe to
// events. Publishing is fire-and-forget to a shared durable "topic" exchange,
// tagged with a routing key; each consumer owns its own durable queue bound to
// the keys it cares about, so every service gets its own copy (publish/subscribe).
// Messages are persistent and survive a broker restart. subscribeToEvents
// validates each incoming message against the caller's Zod schema in one place
// before the handler runs, and drops (nacks without requeue) anything that fails
// to parse or throws, so a malformed message never reaches the handler or DB.
import amqp from "amqplib";
import { z } from "zod";
import { EXCHANGE } from "./events";

export type RabbitConnection = {
  connection: amqp.ChannelModel;
  channel: amqp.Channel;
};

export async function connectRabbit(
  url: string,
  maxRetries = 15,
): Promise<RabbitConnection> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const connection = await amqp.connect(url);
      const channel = await connection.createChannel();
      await channel.assertExchange(EXCHANGE, "topic", { durable: true });
      return { connection, channel };
    } catch (err) {
      console.error(`RabbitMQ connect attempt ${attempt}/${maxRetries} failed`);
      if (attempt === maxRetries) throw err;
      await Bun.sleep(2000);
    }
  }

  throw new Error("Could not connect to RabbitMQ");
}

export function publishEvent(
  channel: amqp.Channel,
  routingKey: string,
  event: object,
) {
  channel.publish(
    EXCHANGE,
    routingKey,
    Buffer.from(JSON.stringify(event)),
    { persistent: true },
  );
}

export async function subscribeToEvents<S extends z.ZodType>(
  channel: amqp.Channel,
  queueName: string,
  routingKeys: string[],
  schema: S,
  handler: (event: z.infer<S>) => Promise<void>,
) {
  const queue = await channel.assertQueue(queueName, { durable: true });

  for (const key of routingKeys) {
    await channel.bindQueue(queue.queue, EXCHANGE, key);
  }

  await channel.consume(queue.queue, async (msg) => {
    if (!msg) return;

    try {
      const raw = JSON.parse(msg.content.toString());
      const event = schema.parse(raw);
      await handler(event);
      channel.ack(msg);
    } catch (err) {
      console.error("Failed to process event", err);
      channel.nack(msg, false, false);
    }
  });
}
