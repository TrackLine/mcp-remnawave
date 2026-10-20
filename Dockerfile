FROM node:22.22.3-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json tsup.config.ts ./
COPY src/ ./src/
RUN npm run build

FROM node:22.22.3-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist/
EXPOSE 3100
CMD ["node", "dist/index.js"]
