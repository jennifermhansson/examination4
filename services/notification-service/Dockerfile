FROM oven/bun:1

WORKDIR /app

COPY shared /shared
COPY services/notification-service/package.json ./
RUN bun install

COPY services/notification-service .

EXPOSE 3005

CMD ["bun", "run", "start"]
