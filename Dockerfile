# Multi-stage Dockerfile cho MEB Multi-Branch Platform
# Base image Node.js 22 LTS Alpine siêu nhẹ
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root và client package configs
COPY package*.json ./
COPY client/package*.json ./client/

# Cài đặt dependencies
RUN npm ci
RUN cd client && npm ci

# Copy toàn bộ mã nguồn
COPY . .

# Build Client Web Interface
RUN npm run build

# Runtime Stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Copy node_modules và build artifacts từ builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server ./server
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/schema.sql ./
COPY --from=builder /app/seed.sql ./

EXPOSE 4000

CMD ["npm", "start"]
