# One container: the game server, which also serves the built client on the same port.

# Build the client. The full node image, not slim: it has git, which one dependency of the test
# tooling (uWebSockets.js, fetched from GitHub) needs to install.
FROM node:22 AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY tsconfig.base.json ./
COPY data/properties.json data/demo.json data/demo_inflections.json data/operators.json data/kits.json data/
COPY shared shared
COPY server server
COPY client client
RUN npm run build -w client
# Keep only what the server needs at run time: no test tools, no client build tools.
RUN rm -rf node_modules && npm ci --omit=dev -w server \
  && rm -rf node_modules/uWebSockets.js  # 125 MB; an optional transport the game does not use

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/data data
COPY --from=build /app/shared shared
COPY --from=build /app/server/package.json server/
COPY --from=build /app/server/src server/src
COPY --from=build /app/client/dist client/dist
EXPOSE 8080
CMD ["node_modules/.bin/tsx", "server/src/main.ts"]
