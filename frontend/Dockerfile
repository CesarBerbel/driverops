# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# --------------------------------------------------------------------------
# dev: Vite dev server with HMR; source is bind-mounted by docker-compose
# --------------------------------------------------------------------------
FROM base AS dev

RUN npm ci

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# --------------------------------------------------------------------------
# build: produces the static production bundle
# --------------------------------------------------------------------------
FROM base AS build

RUN npm ci

COPY . .
RUN npm run build

# --------------------------------------------------------------------------
# prod: static bundle served by nginx (not wired into docker-compose in v1,
# kept for parity/deployability -- see `make build`)
# --------------------------------------------------------------------------
FROM nginx:alpine AS prod

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
