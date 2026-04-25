"""
Virtual Balloon Pop Multiplayer Game
Flask Backend - serves the game and handles any server-side logic
"""

from flask import Flask, render_template, jsonify
import os

app = Flask(__name__)
app.secret_key = os.urandom(24)


@app.route('/')
def index():
    """Main game page - mode selection screen"""
    return render_template('index.html')


@app.route('/game')
def game():
    """Game page"""
    return render_template('game.html')


@app.route('/api/leaderboard', methods=['GET'])
def leaderboard():
    """Return mock leaderboard (can be extended with DB)"""
    scores = [
        {"name": "Player1", "score": 4500, "level": 8},
        {"name": "Player2", "score": 3800, "level": 7},
        {"name": "Player3", "score": 3200, "level": 6},
    ]
    return jsonify(scores)


if __name__ == '__main__':
    print("Virtual Balloon Pop Game Starting...")
    print("Open http://localhost:5000 in your browser")
    app.run(debug=True, host='0.0.0.0', port=5000)
