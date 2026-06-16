import amqp from "amqplib";
import { EXCHANGE } from "./events";

export type RabbitConnection = {
  connection: amqp.ChannelModel;
  channel: amqp.Channel;
};

// Opens a connection + channel to RabbitMQ and makes sure the shared topic
// exchange exists. Services start in parallel with the broker, so we retry a
// number of times (with a short delay) to wait for RabbitMQ to become ready.
// The exchange is declared "durable" so it survives a broker restart.
export async function connectRabbit(
  url: string,
  maxRetries = 15,
): Promise<RabbitConnection> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const connection = await amqp.connect(url);
      const channel = await connection.createChannel();
      // assertExchange is idempotent: it creates the exchange if missing,
      // otherwise just verifies it. "topic" lets consumers subscribe by routing key.
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

// PUBLISHER pattern: fire-and-forget broadcast of a domain event.
// The event is JSON-serialized and sent to the shared exchange tagged with a
// routing key. The exchange then delivers a copy to every queue bound to that
// key. "persistent: true" asks RabbitMQ to keep the message on disk so it is
// not lost if the broker restarts before a consumer reads it.
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

// CONSUMER pattern: each service owns a durable queue and binds it to the
// routing keys it is interested in. Because every service uses its own queue
// name, the exchange fan-outs a copy of each matching event to every service
// (publish/subscribe), rather than competing for a single shared queue.
export async function subscribeToEvents(
  channel: amqp.Channel,
  queueName: string,
  routingKeys: string[],
  handler: (event: unknown) => Promise<void>,
) {
  // Declare the queue (durable so it survives broker restarts) and bind it to
  // each routing key so matching events are routed here.
  const queue = await channel.assertQueue(queueName, { durable: true });

  for (const key of routingKeys) {
    await channel.bindQueue(queue.queue, EXCHANGE, key);
  }

  // Start consuming. For each message we parse the JSON payload and hand it to
  // the service-specific handler.
  await channel.consume(queue.queue, async (msg) => {
    if (!msg) return;

    try {
      const event = JSON.parse(msg.content.toString());
      await handler(event);
      // ack: tell RabbitMQ the message was processed so it can be removed.
      channel.ack(msg);
    } catch (err) {
      console.error("Failed to process event", err);
      // nack with requeue=false: processing failed, so drop the message
      // (don't requeue) to avoid an infinite redelivery loop.
      channel.nack(msg, false, false);
    }
  });
}
