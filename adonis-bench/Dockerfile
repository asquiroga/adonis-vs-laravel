FROM node:24.11.1-bookworm-slim AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN NODE_ENV=production PORT=8080 HOST=0.0.0.0 LOG_LEVEL=silent \
    APP_KEY=build-only-benchmark-key-at-least-32-characters \
    APP_URL=http://localhost:8080 \
    DB_HOST=postgres DB_PORT=5432 DB_USER=benchmark DB_PASSWORD=benchmark DB_DATABASE=medihome_benchmark DB_POOL_MAX=1 \
    BENCH_READ_TOKEN=bench-read-token BENCH_WRITE_TOKEN=bench-write-token npm run build

FROM node:24.11.1-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /src/build/package.json /src/build/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /src/build ./
COPY cluster.mjs ./cluster.mjs
USER node
EXPOSE 8080
CMD ["node", "cluster.mjs"]
