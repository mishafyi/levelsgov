FROM node:22-alpine
WORKDIR /app
# git is REQUIRED: the ai-journalist dependency is a github: git dep — `npm ci`
# clones it and fails with ENOENT/128 on a git-less alpine image.
RUN apk add --no-cache git
COPY workers/journalist/package.json workers/journalist/package-lock.json ./
RUN npm ci
COPY workers/journalist/ ./
EXPOSE 8090
# --env-file-if-exists loads a local .env when present (dev) and no-ops in the
# container, where Coolify injects env directly. `npm start` uses the same flag.
CMD ["npm", "start"]
