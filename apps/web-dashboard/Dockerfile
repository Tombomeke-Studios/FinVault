FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
COPY apps/web-dashboard/ ./apps/web-dashboard/
RUN npm install
WORKDIR /app/apps/web-dashboard
RUN npm run build

FROM nginx:stable-alpine
COPY --from=builder /app/apps/web-dashboard/dist /usr/share/nginx/html
COPY apps/web-dashboard/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
