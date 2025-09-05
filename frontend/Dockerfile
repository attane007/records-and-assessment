# Frontend Dockerfile for Next.js production
FROM node:24-alpine AS deps
WORKDIR /app
# Copy package files first for caching
COPY package.json package-lock.json* ./

# Install deps (includes dev deps for build)
RUN npm install --legacy-peer-deps

# Copy rest of app
COPY . .

# Build
RUN npm run build

# Production image
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app .
EXPOSE 3000
# Next.js default start command: `next start` which respects PORT env
ENV PORT=3000
CMD ["npm", "run", "start"]
