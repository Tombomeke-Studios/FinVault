FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
COPY shared/ ./shared/
COPY services/account-service/ ./services/account-service/
RUN npm install
RUN npm run build --workspace=shared
# Run Prisma generate and build
WORKDIR /app/services/account-service
RUN npx prisma generate
WORKDIR /app
RUN npm run build --workspace=services/account-service

FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package*.json ./shared/
COPY --from=builder /app/services/account-service/dist ./services/account-service/dist
COPY --from=builder /app/services/account-service/package*.json ./services/account-service/
COPY --from=builder /app/services/account-service/prisma ./services/account-service/prisma
RUN npm install --omit=dev
WORKDIR /app/services/account-service
RUN npx prisma generate
ENV PORT=8001
EXPOSE 8001
CMD npx prisma db push && node dist/index.js
