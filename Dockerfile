# One container: the game server, which also serves the built client on the same port.
# The full node image, not slim: it has git, which one dependency of the test tooling
# (uWebSockets.js, fetched from GitHub) needs to install.
FROM node:22 AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY tsconfig.base.json ./
COPY data/properties.json data/demo.json data/demo_inflections.json data/operators.json data/
COPY shared shared
COPY server server
COPY client client
RUN npm run build -w client

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /app /app
EXPOSE 8080
CMD ["npx", "tsx", "server/src/main.ts"]
