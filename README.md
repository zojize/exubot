# Exubot

アップルパイ！🥧

## Local development

Use Node.js 24.15 or newer in the 24.x series and install ffmpeg for the dice command.

```sh
git submodule update --init --recursive
corepack enable
pnpm install --frozen-lockfile
pnpm test
```

Set `DISCORD_TOKEN` and `DISCORD_CLIENT_ID` in `.env` to connect the bot to Discord, then run `pnpm dev`. For production, run `pnpm build`, set the same variables in the service environment, and run `pnpm start` from the project directory.

The gacha commands use the game data submodule and download pool metadata from Weedy. The dice command uses Chrome, ffmpeg, and the online dice renderer. Place the animation files in `data/gacha_begin.gif` and `data/gacha_open.gif`. The task and screenshot commands need a connected MAA worker and a writable `data/` directory.

The Docker image includes the game tables, Chromium, and ffmpeg. Mount a writable `/app/data` for persistent tasks and screenshots. If mounting the entire directory, include the game data submodule and both GIFs in the mount. To use dice in Docker, run with `--init` and configure the [Chromium sandbox capability](https://pptr.dev/guides/docker).

## Acknowledgement

- Made from the [Vitesse for Nuxt 3](https://github.com/antfu/vitesse-nuxt) template
- Discord bot powered by [Nuxt Discord](https://github.com/zojize/nuxt-discord)
- Credit to [prts-widgets](https://github.com/MooncellWiki/prts-widgets) for the Gacha Simulator
- Credit to [ArknightsGameResource](https://github.com/yuanyan3060/ArknightsGameResource) for the Arknights game assets
