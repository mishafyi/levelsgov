FROM node:22-alpine
WORKDIR /app
COPY workers/journalist/package.json workers/journalist/package-lock.json ./
RUN npm ci
COPY workers/journalist/ ./
EXPOSE 8090
# --env-file-if-exists loads a local .env when present (dev) and no-ops in the
# container, where Coolify injects env directly. `npm start` uses the same flag.
CMD ["npm", "start"]
