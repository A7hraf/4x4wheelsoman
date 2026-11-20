# Business Hub API (built from the repository root: docker build -f server/Dockerfile .)
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY server/package.json server/package-lock.json server/
RUN cd server && npm ci --omit=dev --no-audit --no-fund
COPY server/src server/src
COPY worker/package.json worker/assistant-proxy.js worker/
USER node
EXPOSE 8080
CMD ["node", "server/src/index.js"]
