FROM oven/bun:1

WORKDIR /app

COPY shared /shared
COPY services/order-service/package.json ./
RUN bun install

COPY services/order-service .

EXPOSE 3003

CMD ["bun", "run", "start"]
