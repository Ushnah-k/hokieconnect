import React, { useMemo, useState } from "react";
import axios from "axios";

const API = "http://127.0.0.1:5000";

const SAMPLE_QUESTIONS = [
  "List all scholarships available",
  "Which scholarship has the earliest deadline?",
  "What is the minimum GPA needed for each scholarship?",
  "Which apartment is the cheapest with a gym?",
  "What apartment is closest to campus?",
  "If I have a 3.0 GPA and want cheap housing with a gym, what should I pick?"
];

export default function App() {
  // raw data
  const [scholarships, setScholarships] = useState([]);
  const [housing, setHousing] = useState([]);

  // filters
  const [minGpa, setMinGpa] = useState("");
  const [maxRent, setMaxRent] = useState("");
  const [maxDistance, setMaxDistance] = useState("");
  const [amenitiesIncl, setAmenitiesIncl] = useState("");

  // sorting
  const [schSort, setSchSort] = useState("deadline"); // deadline | min_gpa | name
  const [schDir, setSchDir] = useState("asc");        // asc | desc
  const [houseSort, setHouseSort] = useState("rent"); // rent | distance
  const [houseDir, setHouseDir] = useState("asc");    // asc | desc

  // ask box
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [modelUsed, setModelUsed] = useState("");

  // ui
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  /* ---------------- data fetch ---------------- */
  const fetchScholarships = async () => {
    setErr("");
    try {
      const res = await axios.get(`${API}/scholarships`);
      setScholarships(res.data);
    } catch (e) {
      setErr(readErr(e));
    }
  };

  const fetchHousing = async () => {
    setErr("");
    try {
      const res = await axios.get(`${API}/housing`);
      setHousing(res.data);
    } catch (e) {
      setErr(readErr(e));
    }
  };

  /* ---------------- helpers ---------------- */
  const toNum = (v, def = 0) => (v === undefined || v === null || v === "" ? def : Number(v));
  const toDate = (s) => (s ? new Date(s) : null);

  /* ---------------- filters ---------------- */
  const filteredScholarships = useMemo(() => {
    return scholarships.filter((s) => {
      const minField = Number(String(s.major_min_gpa ?? s.min_gpa ?? "0").split("|").pop());
      const gpaOk = !minGpa || minField >= Number(minGpa);
      return gpaOk;
    });
  }, [scholarships, minGpa]);

  const filteredHousing = useMemo(() => {
    return housing.filter((h) => {
      const rentOk = !maxRent || toNum(h.rent) <= Number(maxRent);
      const distOk = !maxDistance || toNum(h.distance_mi, 999) <= Number(maxDistance);
      const amenOk =
        !amenitiesIncl ||
        String(h.amenities || "").toLowerCase().includes(amenitiesIncl.toLowerCase());
      return rentOk && distOk && amenOk;
    });
  }, [housing, maxRent, maxDistance, amenitiesIncl]);

  /* ---------------- sorting ---------------- */
  const sortedScholarships = useMemo(() => {
    const arr = [...filteredScholarships];
    arr.sort((a, b) => {
      let av, bv;
      if (schSort === "deadline") {
        av = toDate(a.deadline)?.getTime() ?? Number.POSITIVE_INFINITY;
        bv = toDate(b.deadline)?.getTime() ?? Number.POSITIVE_INFINITY;
      } else if (schSort === "min_gpa") {
        const gA = Number(String(a.major_min_gpa ?? a.min_gpa ?? "0").split("|").pop());
        const gB = Number(String(b.major_min_gpa ?? b.min_gpa ?? "0").split("|").pop());
        av = gA; bv = gB;
      } else {
        // name
        av = String(a.name || "").toLowerCase();
        bv = String(b.name || "").toLowerCase();
      }
      if (av < bv) return schDir === "asc" ? -1 : 1;
      if (av > bv) return schDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filteredScholarships, schSort, schDir]);

  const sortedHousing = useMemo(() => {
    const arr = [...filteredHousing];
    arr.sort((a, b) => {
      let av, bv;
      if (houseSort === "rent") {
        av = toNum(a.rent, Number.POSITIVE_INFINITY);
        bv = toNum(b.rent, Number.POSITIVE_INFINITY);
      } else {
        // distance
        av = toNum(a.distance_mi, Number.POSITIVE_INFINITY);
        bv = toNum(b.distance_mi, Number.POSITIVE_INFINITY);
      }
      if (av < bv) return houseDir === "asc" ? -1 : 1;
      if (av > bv) return houseDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filteredHousing, houseSort, houseDir]);

  const clearFilters = () => {
    setMinGpa(""); setMaxRent(""); setMaxDistance(""); setAmenitiesIncl("");
  };

  /* ---------------- ask Gemini ---------------- */
  const askGemini = async () => {
    setErr(""); setAnswer(""); setModelUsed("");
    if (!question.trim()) { setErr("Please enter a question first."); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/ask`, { question });
      if (res.data.error) setErr(res.data.error);
      else {
        setAnswer(res.data.answer || "");
        setModelUsed(res.data.model_used || "");
      }
    } catch (e) {
      setErr(readErr(e));
    } finally {
      setLoading(false);
    }
  };

  const copyAnswer = async () => {
    try { await navigator.clipboard.writeText(answer || ""); } catch {}
  };

  return (
    <div className="container">
      <h1>🎓 HokieConnect</h1>
      <p className="muted">Scholarships + Housing + Gemini</p>

      {err && <div className="alert">{err}</div>}

      {/* ---------------- Filters ---------------- */}
      <section className="card">
        <h2>Filters</h2>
        <div className="filters">
          <label>
            Min GPA
            <input type="number" step="0.1" placeholder="e.g. 3.0"
              value={minGpa} onChange={(e) => setMinGpa(e.target.value)} />
          </label>

          <label>
            Max Rent ($)
            <input type="number" placeholder="e.g. 900"
              value={maxRent} onChange={(e) => setMaxRent(e.target.value)} />
          </label>

          <label>
            Max Distance (mi)
            <input type="number" step="0.1" placeholder="e.g. 1.0"
              value={maxDistance} onChange={(e) => setMaxDistance(e.target.value)} />
          </label>

          <label className="span2">
            Amenities include
            <input type="text" placeholder="e.g. gym, parking"
              value={amenitiesIncl} onChange={(e) => setAmenitiesIncl(e.target.value)} />
          </label>

          <div className="filter-buttons">
            <button onClick={fetchScholarships}>Load Scholarships</button>
            <button onClick={fetchHousing}>Load Housing</button>
            <button className="ghost" onClick={clearFilters}>Clear filters</button>
          </div>
        </div>

        {/* sorting controls */}
        <div className="filters" style={{ marginTop: 12 }}>
          <label>
            Scholarship sort
            <select value={schSort} onChange={(e) => setSchSort(e.target.value)}>
              <option value="deadline">Deadline</option>
              <option value="min_gpa">Min GPA</option>
              <option value="name">Name</option>
            </select>
          </label>
          <label>
            Direction
            <select value={schDir} onChange={(e) => setSchDir(e.target.value)}>
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </select>
          </label>

          <label>
            Housing sort
            <select value={houseSort} onChange={(e) => setHouseSort(e.target.value)}>
              <option value="rent">Rent</option>
              <option value="distance">Distance</option>
            </select>
          </label>
          <label>
            Direction
            <select value={houseDir} onChange={(e) => setHouseDir(e.target.value)}>
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </select>
          </label>
        </div>

        <p className="muted small" style={{ marginTop: 8 }}>
          Showing {sortedScholarships.length}/{scholarships.length || 0} scholarships ·
          {" "}{sortedHousing.length}/{housing.length || 0} housing results
        </p>
      </section>

      {/* ---------------- Data tables ---------------- */}
      <section className="card">
        <div className="row">
          <div>
            <h2>Scholarships</h2>
            {sortedScholarships.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Min GPA</th>
                    <th>Deadline</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedScholarships.map((s, i) => (
                    <tr key={i}>
                      <td>{s.name}</td>
                      <td>{s.major_min_gpa}</td>
                      <td>{s.deadline}</td>
                      <td>{s.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">No scholarships to show.</p>
            )}
          </div>

          <div>
            <h2>Housing</h2>
            {sortedHousing.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Apartment</th>
                    <th>Rent</th>
                    <th>Distance (mi)</th>
                    <th>Amenities</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedHousing.map((h, i) => (
                    <tr key={i}>
                      <td>{h.apartment}</td>
                      <td>${h.rent}</td>
                      <td>{h.distance_mi}</td>
                      <td>{h.amenities}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">No housing to show.</p>
            )}
          </div>
        </div>
      </section>

      {/* ---------------- Ask Gemini ---------------- */}
      <section className="card">
        <h2>Ask Gemini</h2>

        <div className="ask-row">
          <select className="samples" onChange={(e) => setQuestion(e.target.value)} value="">
            <option value="" disabled>🔽 Insert a sample question…</option>
            {SAMPLE_QUESTIONS.map((q, i) => (
              <option key={i} value={q}>{q}</option>
            ))}
          </select>

          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Type your own question here"
          />
          <button onClick={askGemini} disabled={loading}>
            {loading ? "Thinking..." : "Ask"}
          </button>
        </div>

        {modelUsed && <p className="muted">model: <code>{modelUsed}</code></p>}

        {answer ? (
          <>
            <pre className="answer">{answer}</pre>
            <button className="ghost" onClick={copyAnswer}>Copy answer</button>
          </>
        ) : (
          <p className="muted">Answer will appear here.</p>
        )}
      </section>

      <footer className="muted small">
        Tip: if you hit Gemini free-tier rate limits, wait ~30s and try again.
      </footer>
    </div>
  );
}

/* -------- helpers -------- */
function readErr(e) {
  if (e?.response?.data?.error) return e.response.data.error;
  if (e?.message) return e.message;
  return "Something went wrong.";
}
