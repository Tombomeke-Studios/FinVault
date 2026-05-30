FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
COPY shared/ ./shared/
COPY services/wallet-transaction-service/ ./services/wallet-transaction-service/
RUN npm install
RUN npm run build --workspace=shared
# Run Prisma generate and build
WORKDIR /app/services/wallet-transaction-service
RUN npx prisma generate
WORKDIR /app
RUN npm run build --workspace=services/wallet-transaction-service

FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package*.json ./shared/
COPY --from=builder /app/services/wallet-transaction-service/dist ./services/wallet-transaction-service/dist
COPY --from=builder /app/services/wallet-transaction-service/package*.json ./services/wallet-transaction-service/
COPY --from=builder /app/services/wallet-transaction-service/prisma ./services/wallet-transaction-service/prisma
RUN npm install --omit=dev
WORKDIR /app/services/wallet-transaction-service
RUN npx prisma generate
ENV PORT=8002
EXPOSE 8002
CMD npx prisma db push && node dist/index.js
