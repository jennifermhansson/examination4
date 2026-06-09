FROM oven/bun:1

WORKDIR /app

COPY shared /shared
COPY services/kitchen-service/package.json ./
RUN bun install

COPY services/kitchen-service .

EXPOSE 3004

CMD ["bun", "run", "start"]
