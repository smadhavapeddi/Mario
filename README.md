# Pixel Quest

A small original side-scrolling platformer (Flask + HTML5 Canvas) with an AI-powered
in-game hint feature backed by **DigitalOcean Serverless Inference**.

**Why not literally "Mario"?** Nintendo's Mario character, sprites, and level art are
copyrighted/trademarked, so this uses original mechanics and art (a generic
plumber-style platformer — running, jumping, coins, stomping enemies, a flag goal)
instead of reproducing Nintendo's IP.

## Why Flask + Canvas instead of Pygame?

DigitalOcean **Serverless Inference only runs LLM API calls** (chat/completions) — it
can't host a game process or serve a running application. So the game itself is deployed
as a normal web app on **App Platform** (a Flask backend serving an HTML5 Canvas game
in the browser), and it *calls* Serverless Inference over the network for one feature:
an in-game NPC ("the Old Plumber") who gives you a contextual hint on request. Pygame
needs a display/window and doesn't run in a container like this, which is why the game
is browser-based instead.

## Run locally

```bash
cd pixel-quest-game
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # fill in MODEL_ACCESS_KEY (optional — game works without it)
python app.py
```

Open http://localhost:8080. Arrow keys / WASD to move, Up/Space/W to jump. Click
**"Ask the Old Plumber for a hint"** to get an AI-generated tip — the hint gets more
specific the more times you've died at that spot.

Without a `MODEL_ACCESS_KEY` set, the hint button still works — it falls back to a
canned tip instead of calling the API.

## How the AI hint works

`POST /api/hint` in `app.py` sends the player's current level, score, lives, and death
count at their current position to a DO Serverless Inference model
(`llama3.3-70b-instruct` by default) via the OpenAI-compatible SDK, and returns a short
in-character hint. See `docs.digitalocean.com/products/inference/how-to/use-chat-completions-api/`.

## Deploying to App Platform

1. Push this folder to a GitHub repo, then update `.do/app.yaml`'s `github.repo` to
   point at it.
2. Create the app:
   ```bash
   doctl apps create --spec .do/app.yaml
   ```
   or via the control panel: **Apps → Create App → GitHub**, pick your repo/branch —
   App Platform auto-detects Python from `requirements.txt` and `Procfile`.
3. Set the `MODEL_ACCESS_KEY` secret under **App → Settings → App-Level Environment
   Variables** (kept out of git deliberately).
4. Verify:
   ```bash
   curl https://<your-app>.ondigitalocean.app/health
   ```
   then open the app URL in a browser to play.

Every push to `main` auto-redeploys (`deploy_on_push: true` in the spec).
