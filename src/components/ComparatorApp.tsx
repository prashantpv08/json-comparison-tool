import React, { useMemo, useRef, useState } from "react";
import JsonTree from "./JsonTree";
import { compareMany, buildPerSourceDiffMaps, formatValue } from "../lib/jsonCompare";
type Source = { id: string; name: string; data: any };
type Row = { path: string; values: string[]; allSame: boolean };

export default function ComparatorApp() {
  const [sources, setSources] = useState<Source[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [diffMaps, setDiffMaps] = useState<
    Array<Record<string, "missing" | "changed">>
  >([]);
  const [view, setView] = useState<"tree" | "table">("tree");
  const [filter, setFilter] = useState("");
  const [collapseUnchanged, setCollapseUnchanged] = useState(false);
  const [globalTreeAction, setGlobalTreeAction] = useState<
    "expand" | "collapse" | undefined
  >(undefined);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  

  function addFromText() {
    const raw = textRef.current?.value.trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((obj) =>
          setSources((p) => [
            ...p,
            { id: cryptoId(), name: `pasted-${p.length + 1}`, data: obj },
          ])
        );
      } else {
        setSources((p) => [
          ...p,
          { id: cryptoId(), name: `pasted-${p.length + 1}`, data: parsed },
        ]);
      }
      if (textRef.current) textRef.current.value = "";
    } catch (e: any) {
      alert("Invalid JSON: " + e?.message);
    }
  }

  async function onFilesChosen(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) {
      try {
        const text = await f.text();
        setSources((p) => [
          ...p,
          { id: cryptoId(), name: f.name, data: JSON.parse(text) },
        ]);
      } catch (e: any) {
        alert(`Failed to parse ${f.name}: ${e?.message}`);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function compareNow() {
    if (sources.length < 2) {
      alert("Add at least two JSONs.");
      return;
    }
    const res = compareMany(
      sources.map((s) => ({ name: s.name, data: s.data }))
    );
    setRows(res.rows);
    setDiffMaps(buildPerSourceDiffMaps(res));
  }

  // navigation (prev/next diffs) removed per request — keep collapse behavior only

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return rows.filter((r) => {
      if (!q) return true;
      if (r.path.toLowerCase().includes(q)) return true;
      return r.values.some((v) => v.toLowerCase().includes(q));
    });
  }, [rows, filter]);

  const diffCount = useMemo(() => rows.filter((r) => !r.allSame).length, [rows]);
  
  const diffBreakdown = useMemo(() => {
    let missing = 0;
    let changed = 0;
    
    for (const row of rows) {
      if (row.allSame) continue;
      
      const hasMissing = row.values.some((v) => v === "∅");
      const nonMissingVals = row.values.filter((v) => v !== "∅");
      const hasChanged = new Set(nonMissingVals).size > 1;
      
      if (hasMissing && !hasChanged) {
        // Only missing (keys present in some sources but not others)
        missing++;
      } else if (hasChanged) {
        // Values differ across sources
        changed++;
      } else if (hasMissing) {
        // Both missing and changed
        missing++;
      }
    }
    
    return { missing, changed, total: diffCount };
  }, [rows, diffCount]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "auto auto 1fr",
        height: "100vh",
      }}
    >
      <div
        className="toolbar"
        style={{
          padding: "10px 16px",
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <b>JSON Comparator (Light)</b>
        <label className="btn">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".json,application/json"
            style={{ display: "none" }}
            onChange={(e) => onFilesChosen(e.target.files)}
          />
          📁 Add JSON files
        </label>
        <button className="btn" onClick={addFromText}>
          ➕ Add from text
        </button>
        <button className="btn" onClick={compareNow}>
          ⚖️ Compare
        </button>
        <button
          className="btn"
          onClick={() => setView("tree")}
          disabled={view === "tree"}
        >
          🌳 Tree
        </button>
        <button
          className="btn"
          onClick={() => setView("table")}
          disabled={view === "table"}
        >
          📋 Table
        </button>
        <label className="pill pill-yellow">Changed = yellow</label>
        <label className="pill pill-red">Missing = red</label>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                background: "#f1f5f9",
                padding: "4px 10px",
                borderRadius: 6,
                color: "#334155",
                fontWeight: 600,
                fontSize: 13,
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <span>{diffBreakdown.total} diffs</span>
              {diffBreakdown.total > 0 && (
                <>
                  <span style={{ color: "#94a3b8" }}>|</span>
                  <span style={{ color: "#b91c1c" }}>
                    {diffBreakdown.missing} missing
                  </span>
                  <span style={{ color: "#94a3b8" }}>|</span>
                  <span style={{ color: "#d97706" }}>
                    {diffBreakdown.changed} changed
                  </span>
                </>
              )}
            </div>
            <label
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <input
                type="checkbox"
                checked={collapseUnchanged}
                onChange={(e) => setCollapseUnchanged(e.target.checked)}
              />
              Collapse unchanged
            </label>
            <button
              className="btn"
              onClick={() => {
                // Expand everything (also clear collapseUnchanged)
                setCollapseUnchanged(false);
                setGlobalTreeAction("expand");
              }}
              title="Expand all"
            >
              Expand all
            </button>
            <button
              className="btn"
              onClick={() => {
                // Collapse unchanged behavior: set collapseUnchanged to true
                setCollapseUnchanged(true);
                // clear any one-time global action
                setGlobalTreeAction(undefined);
              }}
              title="Collapse unchanged"
            >
              Collapse unchanged
            </button>
          </div>
          <input
            className="input"
            placeholder="Filter (table mode)"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {/* 'Only differences' removed per request */}
        </div>
      </div>

      <div style={{ padding: "10px 16px", display: "grid", gap: 8 }}>
        <textarea
          ref={textRef}
          className="input mono"
          placeholder='Paste JSON here (or an array of objects) and click "Add from text".'
          style={{ width: "100%", height: 140 }}
        />
      </div>

      <div style={{ padding: "10px 16px" }}>
        {view === "tree" ? (
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: `repeat(${Math.max(
                1,
                sources.length
              )}, minmax(320px, 1fr))`,
            }}
          >
            {sources.map((s, i) => (
              <div key={s.id} className="card">
                <div
                  style={{
                    padding: 10,
                    borderBottom: "1px solid #e2e8f0",
                    color: "#334155",
                    fontWeight: 600,
                  }}
                >
                  {i + 1}. {s.name}
                </div>
                <div
                  style={{
                    padding: 10,
                    maxHeight: "calc(100vh - 260px)",
                    overflow: "auto",
                  }}
                >
                  <JsonTree
                    data={s.data}
                    label="$"
                    path="$"
                    diffs={diffMaps[i] || {}}
                    collapseUnchanged={collapseUnchanged}
                    globalAction={globalTreeAction}
                  />
                </div>
              </div>
            ))}
            {!sources.length && (
              <div style={{ color: "#64748b" }}>
                Add JSONs (files or text) and hit Compare to highlight inline
                differences.
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ padding: 10, overflow: "auto" }}>
            {filtered.length ? (
              <table
                style={{ borderCollapse: "collapse", width: "100%" }}
                className="mono"
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #e2e8f0",
                        padding: 8,
                      }}
                    >
                      Path
                    </th>
                    {sources.map((s) => (
                      <th
                        key={s.id}
                        style={{
                          textAlign: "left",
                          borderBottom: "1px solid #e2e8f0",
                          padding: 8,
                        }}
                      >
                        {s.name}
                      </th>
                    ))}
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #e2e8f0",
                        padding: 8,
                      }}
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.path}>
                      <td
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          padding: 6,
                        }}
                      >
                        <div style={{ lineHeight: 1.2 }}>{r.path}</div>
                        {(() => {
                          const missing = sources
                            .map((s, i) => ({ name: s.name, i }))
                            .filter((x) => diffMaps[x.i]?.[r.path] === "missing")
                            .map((x) => x.name);
                          if (missing.length) {
                            return (
                              <div
                                style={{
                                  marginTop: 6,
                                  fontSize: 12,
                                  color: "#b91c1c",
                                }}
                              >
                                Missing in: {missing.join(", ")}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </td>
                      {r.values.map((v, i) => (
                        <td
                          key={i}
                          style={{
                            borderBottom: "1px solid #f1f5f9",
                            padding: 6,
                            background:
                              diffMaps[i]?.[r.path] === "missing"
                                ? "#fecaca"  // Stronger red for missing
                                : diffMaps[i]?.[r.path] === "changed"
                                ? "#fef3c7"  // Yellow for changed
                                : "transparent",
                            color:
                              diffMaps[i]?.[r.path] === "missing"
                                ? "#991b1b"  // Dark red text for missing
                                : "#334155",
                            fontWeight:
                              diffMaps[i]?.[r.path] === "missing" ? 600 : 400,
                          }}
                        >
                          {formatValue(v)}
                        </td>
                      ))}
                      <td
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          padding: 6,
                        }}
                      >
                        {r.allSame ? "identical" : "different"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ color: "#64748b" }}>No comparison yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
function cryptoId() {
  return Math.random().toString(36).slice(2, 9);
}
