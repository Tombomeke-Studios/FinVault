FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
COPY shared/ ./shared/
COPY services/invoice-service/ ./services/invoice-service/
RUN npm install
RUN npm run build --workspace=shared
# Run Prisma generate and build
WORKDIR /app/services/invoice-service
RUN npx prisma generate
WORKDIR /app
RUN npm run build --workspace=services/invoice-service

FROM node:18-alpine
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY package*.json ./
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package*.json ./shared/
COPY --from=builder /app/services/invoice-service/dist ./services/invoice-service/dist
COPY --from=builder /app/services/invoice-service/package*.json ./services/invoice-service/
COPY --from=builder /app/services/invoice-service/prisma ./services/invoice-service/prisma
RUN npm install --omit=dev
WORKDIR /app/services/invoice-service
RUN npx prisma generate
ENV PORT=8003
EXPOSE 8003
CMD npx prisma db push && node dist/index.js
