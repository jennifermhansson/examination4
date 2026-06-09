import amqp from "amqplib";
import { EXCHANGE } from "./events";

export type RabbitConnection = {
  connection: amqp.Connection;
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

export async function subscribeToEvents(
  channel: amqp.Channel,
  queueName: string,
  routingKeys: string[],
  handler: (event: unknown) => Promise<void>,
) {
  const queue = await channel.assertQueue(queueName, { durable: true });

  for (const key of routingKeys) {
    await channel.bindQueue(queue.queue, EXCHANGE, key);
  }

  await channel.consume(queue.queue, async (msg) => {
    if (!msg) return;

    try {
      const event = JSON.parse(msg.content.toString());
      await handler(event);
      channel.ack(msg);
    } catch (err) {
      console.error("Failed to process event", err);
      channel.nack(msg, false, false);
    }
  });
}
