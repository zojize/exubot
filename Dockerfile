FROM node:24-alpine AS build-stage

WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY app ./app
COPY public ./public
COPY server ./server
COPY shared ./shared
COPY discord ./discord
COPY deps/prts-widgets/src ./deps/prts-widgets/src
COPY nuxt.config.ts uno.config.ts tsconfig.json eslint.config.js ./
RUN --mount=type=cache,id=exubot-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store && pnpm build

FROM node:24-alpine AS production-stage

WORKDIR /app
RUN apk add --no-cache chromium ffmpeg \
    && mkdir -p data && chown node:node data
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
COPY --from=build-stage /app/.output ./.output
COPY data/ArknightsGameResource/gamedata/excel/character_table.json data/ArknightsGameResource/gamedata/excel/gacha_table.json ./data/ArknightsGameResource/gamedata/excel/

USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
