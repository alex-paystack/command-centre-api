# --------- Base Stage ---------
FROM node:24.5.0-slim AS base

WORKDIR /app

RUN apt-get -y update && \
    apt-get install -y sudo && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd -r app && useradd -r -g app app && \
    usermod -aG sudo app && \
    echo "app ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

RUN npm install -g pnpm@10.14.0

ENV NODE_ENV=production

# --------- Dependencies Stage ---------
FROM base AS deps

ARG PERSONAL_ACCESS_TOKEN

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN echo "//npm.pkg.github.com/:_authToken=$PERSONAL_ACCESS_TOKEN" > .npmrc && \
    echo "@paystackhq:registry=https://npm.pkg.github.com/" >> .npmrc && \
    echo "always-auth=true" >> .npmrc

RUN pnpm install --frozen-lockfile --prod=false

# --------- Build Stage ---------
FROM deps AS build

COPY . .

RUN pnpm build

RUN pnpm prune --prod --ignore-scripts && rm -f .npmrc

# --------- Development Stage ---------
FROM deps AS development
ENV NODE_ENV=development


COPY . .

# NOTE: We purposely do not set a default CMD here – docker-compose can override it as needed
CMD ["pnpm", "start:dev"]

# --------- Production Stage (default) ---------
FROM base AS production

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./

# Version metadata (populated at build time via --build-arg)
ARG APP_VERSION=dev-local
ENV APP_VERSION=${APP_VERSION}
ENV OTEL_SERVICE_VERSION=${APP_VERSION}
LABEL org.opencontainers.image.version=${APP_VERSION}

# Service name metadata (populated at build time via --build-arg)
ARG APP_NAME=command-centre-api
ENV APP_NAME=${APP_NAME}
ENV OTEL_SERVICE_NAME=${APP_NAME}
LABEL org.opencontainers.image.title=${APP_NAME}


RUN chown -R app:app /app
USER app

CMD ["node", "dist/main.js"]
