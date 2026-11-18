FROM node:26-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Node.js runs the TypeScript files directly, so there is no build step.
COPY src ./src

# The database file is on a volume, so that it stays when the container changes.
RUN mkdir /data && chown node:node /data
VOLUME /data
ENV DATABASE_PATH=/data/festival-playlist-maker.sqlite
ENV PORT=3000
EXPOSE 3000

USER node
CMD ["node", "src/main.ts"]
