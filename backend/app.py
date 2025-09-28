import os
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
load_dotenv()

# Get Gemini API key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("⚠️ No GEMINI_API_KEY found in .env file")

# Configure Gemini
genai.configure(api_key=GEMINI_API_KEY)

# Flask app setup
app = Flask(__name__)
CORS(app)

# --- Load CSV data ---
scholarships_path = os.path.join("..", "data", "scholarships.csv")
housing_path = os.path.join("..", "data", "housing.csv")

scholarships_df = pd.read_csv(scholarships_path)
housing_df = pd.read_csv(housing_path)

# --- Routes ---
@app.route("/scholarships", methods=["GET"])
def get_scholarships():
    return scholarships_df.to_json(orient="records")

@app.route("/housing", methods=["GET"])
def get_housing():
    return housing_df.to_json(orient="records")

@app.route("/ask", methods=["POST"])
def ask_gemini():
    import re, time
    data = request.get_json(silent=True) or {}
    q = (data.get("question") or data.get("query") or "").strip()
    if not q:
        return jsonify({"error": "Missing 'question' or 'query'"}), 400

    def try_model(name):
        m = genai.GenerativeModel(name)
        r = m.generate_content(q)
        return r.text, name

    # preferred → fallback
    order = ["gemini-2.5-pro", "gemini-2.5-flash"]

    last_err = None
    for name in order:
        try:
            answer, used = try_model(name)
            return jsonify({"answer": answer, "model_used": used})
        except Exception as e:
            msg = str(e)
            last_err = msg
            # If it tells us to retry, sleep once (best-effort parse)
            m = re.search(r"Please retry in\s+([0-9.]+)s", msg)
            if m:
                delay = float(m.group(1))
                time.sleep(min(delay, 35.0))  # cap the wait
                try:
                    answer, used = try_model(name)
                    return jsonify({"answer": answer, "model_used": used, "retried_after_seconds": delay})
                except Exception as e2:
                    last_err = str(e2)
            # otherwise, move on to the next model
            continue

    return jsonify({
        "error": "All models failed (likely rate limits on free tier).",
        "details": last_err,
        "tips": "Try again in ~30s, or enable billing, or keep using 2.5-flash during dev."
    }), 429
# --- Run server ---
if __name__ == "__main__":
    app.run(debug=True)
