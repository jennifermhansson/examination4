FROM oven/bun:1

WORKDIR /app

COPY shared /shared
COPY services/product-service/package.json ./
RUN bun install

COPY services/product-service .

EXPOSE 3002

CMD ["bun", "run", "start"]
