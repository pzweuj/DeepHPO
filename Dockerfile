FROM node:18-alpine AS deps
WORKDIR /app
RUN apk add --no-cache git
RUN git clone --depth 1 https://github.com/pzweuj/DeepHPO.git .
RUN npm ci

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app /app
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=7860

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 7860
CMD ["node", "server.js"]
