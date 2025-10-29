import React, { useMemo, useState, useEffect } from "react";
type Highlights = Record<string, "missing" | "changed">;
function isObj(x: any) {
  return x && typeof x === "object";
}
export default function JsonTree({
  data,
  label,
  path,
  diffs,
  collapseUnchanged,
  globalAction,
}: {
  data: any;
  label: string;
  path: string;
  diffs: Highlights;
  collapseUnchanged?: boolean;
  globalAction?: "expand" | "collapse" | undefined;
}) {
  function hasDiffInSubtree(map: Highlights | undefined, p: string) {
    if (!map) return false;
    return Object.keys(map).some(
      (k) => k === p || k.startsWith(p + ".") || k.startsWith(p + "[")
    );
  }

  const [open, setOpen] = useState<boolean>(() =>
    collapseUnchanged ? hasDiffInSubtree(diffs, path) : true
  );

  useEffect(() => {
    // When collapseUnchanged toggles, update open state for the node:
    // - if collapseUnchanged is true => open only if subtree has diffs
    // - if collapseUnchanged is false => open everything
    if (collapseUnchanged) {
      setOpen(hasDiffInSubtree(diffs, path));
    } else {
      setOpen(true);
    }
  }, [collapseUnchanged, diffs, path]);

  useEffect(() => {
    if (!globalAction) return;
    if (globalAction === "expand") setOpen(true);
    else if (globalAction === "collapse") setOpen(false);
  }, [globalAction]);

  const kind = diffs?.[path];
  const keyBg =
    kind === "missing" 
      ? "#fecaca"  // Stronger red for missing keys
      : kind === "changed" 
      ? "#fef3c7"  // Yellow for changed values
      : "transparent";
  const keyColor = kind === "missing" ? "#991b1b" : "#334155";  // Darker red text for missing
  const isArray = Array.isArray(data);
  const entries = useMemo(() => {
    if (!isObj(data) || isArray) return [];
    return Object.entries(data) as [string, any][];
  }, [data, isArray]);

  if (!isObj(data)) {
    return (
      <div className="mono" data-path={path} style={{ margin: "2px 0" }}>
        <span
          style={{
            background: keyBg,
            borderRadius: 4,
            padding: "0 4px",
            color: keyColor,
            fontWeight: kind === "missing" ? 600 : 400,
          }}
        >
          {label}:
        </span>{" "}
        <span>{JSON.stringify(data)}</span>
      </div>
    );
  }

  if (isArray) {
    const arr = data as any[];
    return (
      <div className="mono" data-path={path} style={{ margin: "2px 0" }}>
        <button onClick={() => setOpen(!open)} style={toggle}>
          {open ? "▾" : "▸"}
        </button>
        <span
          style={{
            background: keyBg,
            borderRadius: 4,
            padding: "0 4px",
            color: keyColor,
            fontWeight: kind === "missing" ? 600 : 400,
          }}
        >
          {label}
        </span>{" "}
        <span style={{ color: "#64748b" }}>[{arr.length}]</span>
        {open && (
          <div
            style={{
              marginLeft: 18,
              borderLeft: "1px dashed #e2e8f0",
              paddingLeft: 8,
            }}
          >
            {arr.map((v, i) => (
              <JsonTree
                key={i}
                data={v}
                label={`[${i}]`}
                path={`${path}[${i}]`}
                diffs={diffs}
                collapseUnchanged={collapseUnchanged}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mono" data-path={path} style={{ margin: "2px 0" }}>
      <button onClick={() => setOpen(!open)} style={toggle}>
        {open ? "▾" : "▸"}
      </button>
      <span
        style={{
          background: keyBg,
          borderRadius: 4,
          padding: "0 4px",
          color: keyColor,
          fontWeight: kind === "missing" ? 600 : 400,
        }}
      >
        {label}
      </span>{" "}
      <span style={{ color: "#64748b" }}>{`{${entries.length}}`}</span>
      {open && (
        <div
          style={{
            marginLeft: 18,
            borderLeft: "1px dashed #e2e8f0",
            paddingLeft: 8,
          }}
        >
          {entries.map(([k, v]) => (
            <JsonTree
              key={k}
              data={v}
              label={k}
              path={`${path}.${k}`}
              diffs={diffs}
              collapseUnchanged={collapseUnchanged}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const toggle: React.CSSProperties = {
  all: "unset",
  cursor: "pointer",
  width: 16,
  display: "inline-block",
  textAlign: "center",
  color: "#334155",
};
