"""
Pixel Quest — a small original side-scrolling platformer (Flask + HTML5 Canvas)
with an AI-powered in-game hint feature backed by DigitalOcean Serverless Inference.

Why not "Mario"? Nintendo's Mario character, sprites, and level art are
copyrighted/trademarked, so this game uses original mechanics and art (a
generic plumber-style platformer) instead of reproducing Nintendo's IP.
Jumping, coins, pipes, and flag-goals are generic platformer-genre tropes,
not Nintendo-specific, so the *feel* is familiar without copying anything.

Run locally:
    pip install -r requirements.txt
    cp .env.example .env   # fill in MODEL_ACCESS_KEY
    python app.py
Then open http://localhost:8080
"""

import os
import logging
from flask import Flask, jsonify, request, send_from_directory
from openai import OpenAI

#MODEL_ACCESS_KEY = os.environ.get("MODEL_ACCESS_KEY")
MODEL_ACCESS_KEY =doo_v1_d9e11f9b068502c9a483e47b567774407aa8164393c04e97b5d1b12ad7e2e512
MODEL_ID = os.environ.get("MODEL_ID", "llama3.3-70b-instruct")
PORT = int(os.environ.get("PORT", 8080))

app = Flask(__name__, static_folder="static", static_url_path="/static")
logging.basicConfig(level=logging.INFO)

client = None
if MODEL_ACCESS_KEY:
    client = OpenAI(base_url="https://inference.do-ai.run/v1", api_key=MODEL_ACCESS_KEY)
else:
    app.logger.warning("MODEL_ACCESS_KEY not set — /api/hint will return a canned hint instead of calling DO Serverless Inference.")


@app.route("/")
def index():
    return send_from_directory("templates", "index.html")


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/hint", methods=["POST"])
def hint():
    """Generate a short, in-character hint from the game's 'Old Plumber' NPC,
    based on the player's current run (level, score, lives, deaths)."""
    data = request.get_json(silent=True) or {}
    level = data.get("level", 1)
    score = data.get("score", 0)
    lives = data.get("lives", 3)
    deaths_at_spot = data.get("deathsAtSpot", 0)

    if client is None:
        return jsonify({"hint": "Jump on the enemies, grab the coins, and watch out for gaps!", "source": "fallback"})

    prompt = (
        f"You are a cheerful old plumber NPC in a retro platformer video game, giving the player "
        f"a ONE-sentence hint. Player state: level {level}, score {score}, lives {lives}, "
        f"died at this spot {deaths_at_spot} times. If deaths_at_spot is 0, give a general "
        f"encouraging tip. If deaths_at_spot is 2 or more, give a more specific, helpful tip about "
        f"platform timing or enemy patterns. Keep it under 20 words, playful, no markdown."
    )
    try:
        completion = client.chat.completions.create(
            model=MODEL_ID,
            messages=[
                {"role": "system", "content": "You write extremely short, playful in-game NPC dialogue."},
                {"role": "user", "content": prompt},
            ],
            max_completion_tokens=60,
            temperature=0.9,
        )
        text = completion.choices[0].message.content.strip()
        return jsonify({"hint": text, "source": "do-serverless-inference", "model": completion.model})
    except Exception as e:
        app.logger.error(f"Inference call failed: {e}")
        return jsonify({"hint": "Even old plumbers get stuck sometimes — try a running jump!", "source": "error-fallback"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=True)
