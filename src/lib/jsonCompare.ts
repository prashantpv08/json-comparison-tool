export type Flat = Record<string, string>;
export type Row = { path: string; values: string[]; allSame: boolean };
export type CompareResult = {
  sources: string[];
  rows: Row[];
  paths: string[];
  flats: Flat[];
};

/**
 * Formats a flattened value for display in the UI
 */
export function formatValue(val: string): string {
  // Handle metadata formats
  if (val.startsWith("[Array:")) {
    const match = val.match(/\[Array:(\d+)\]/);
    if (match) return `Array[${match[1]}]`;
  }
  if (val.startsWith("{Object:")) {
    const match = val.match(/\{Object:(\d+):/);
    if (match) return `Object{${match[1]} keys}`;
  }
  return val;
}

export function flattenJSON(
  input: any,
  prefix: string = "$",
  out: Flat = {}
): Flat {
  if (input === null) {
    out[prefix] = "null";
    return out;
  }
  if (input === undefined) {
    out[prefix] = "undefined";
    return out;
  }
  const t = typeof input;
  if (t !== "object") {
    // Preserve type information for primitives
    if (t === "string") {
      out[prefix] = JSON.stringify(input);
    } else if (t === "number") {
      out[prefix] = String(input);
    } else if (t === "boolean") {
      out[prefix] = String(input);
    } else {
      out[prefix] = JSON.stringify(input);
    }
    return out;
  }
  if (Array.isArray(input)) {
    // Store array metadata to detect length differences
    out[prefix] = `[Array:${input.length}]`;
    if (input.length === 0) {
      return out;
    }
    for (let i = 0; i < input.length; i++) {
      flattenJSON(input[i], `${prefix}[${i}]`, out);
    }
    return out;
  }
  const keys = Object.keys(input).sort(); // Sort for consistent comparison
  // Store object metadata to detect structural differences
  out[prefix] = `{Object:${keys.length}:${keys.join(",")}}`;
  if (keys.length === 0) {
    return out;
  }
  for (const k of keys) {
    flattenJSON(input[k], `${prefix}.${k}`, out);
  }
  return out;
}

export function compareMany(
  sources: { name: string; data: any }[]
): CompareResult {
  const flats = sources.map((s) => flattenJSON(s.data));
  const all = new Set<string>();
  for (const m of flats) for (const k of Object.keys(m)) all.add(k);
  const paths = Array.from(all).sort();
  const rows = paths.map((p) => {
    const vals = flats.map((m) => (p in m ? m[p] : "∅"));
    const nonMissing = vals.filter((v) => v !== "∅");
    const allSame =
      nonMissing.length > 0 &&
      nonMissing.every((v) => v === nonMissing[0]) &&
      nonMissing.length === vals.length;
    return { path: p, values: vals, allSame };
  });
  return { sources: sources.map((s) => s.name), rows, paths, flats };
}

export function buildPerSourceDiffMaps(res: CompareResult) {
  const per: Array<Record<string, "missing" | "changed">> = res.sources.map(
    () => ({})
  );
  
  for (const row of res.rows) {
    if (row.allSame) continue; // Skip rows where all values are identical
    
    const vals = row.values;
    const nonMissingVals = vals.filter((v) => v !== "∅");
    
    // Check if there are different non-missing values
    const uniqueNonMissing = new Set(nonMissingVals);
    const hasChanged = uniqueNonMissing.size > 1;
    
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      if (v === "∅") {
        // Mark as MISSING (red) if this source doesn't have the path
        per[i][row.path] = "missing";
      } else if (hasChanged) {
        // Mark as CHANGED (yellow) only if multiple different values exist
        // (not just because another source is missing it)
        per[i][row.path] = "changed";
      }
      // If only missing (no changed values), sources with values get no marking
    }
  }
  
  // Mark parent paths when children have differences
  markParentPaths(per);
  
  return per;
}

function markParentPaths(per: Array<Record<string, "missing" | "changed">>) {
  for (const map of per) {
    const allPaths = Object.keys(map);
    const parentsToMark = new Map<string, "missing" | "changed">();
    
    for (const path of allPaths) {
      const childType = map[path];
      
      // Extract all parent paths
      const parts: string[] = [];
      let current = path;
      
      while (current !== "$") {
        // Handle array indices: $.array[0].field -> $.array[0] -> $.array
        const arrayMatch = current.match(/^(.+)\[\d+\]$/);
        if (arrayMatch) {
          current = arrayMatch[1];
          parts.push(current);
          continue;
        }
        
        // Handle object properties: $.a.b.c -> $.a.b -> $.a
        const dotMatch = current.match(/^(.+)\.[^.]+$/);
        if (dotMatch) {
          current = dotMatch[1];
          parts.push(current);
          continue;
        }
        
        break;
      }
      
      for (const parent of parts) {
        // If parent isn't marked yet, or if we have a "changed" to upgrade it
        if (!parentsToMark.has(parent) || childType === "changed") {
          parentsToMark.set(parent, childType);
        }
      }
    }
    
    // Mark parent paths if not already marked
    for (const [parent, type] of parentsToMark) {
      if (!(parent in map)) {
        map[parent] = type;
      }
    }
  }
}
