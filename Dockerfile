FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV BETTER_AUTH_SECRET=build-only-placeholder-secret-32-characters
ENV BETTER_AUTH_URL=http://localhost:3000
RUN npm run build

FROM build AS runtime
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
EXPOSE 3000
RUN chown -R node:node /app/.next
USER node
CMD ["npm", "run", "start"]
