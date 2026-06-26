FROM node:22-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci

FROM deps AS build

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force \
  && rm -f package.json package-lock.json \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/server.js"]
