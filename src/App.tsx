import React, { useMemo, useState } from "react";

type ConstraintType = "Dmax" | "Dmean" | "Vx";
interface Constraint {
  id: string;
  site: string;
  oar: string;
  type: ConstraintType;
  param?: number;
  limit: number;
  unit: string;
  note?: string;
}

const starterConstraints: Constraint[] = [
  { id: crypto.randomUUID(), site: "Head & Neck", oar: "Spinal cord", type: "Dmax", limit: 45, unit: "Gy", note: "Example only" },
  { id: crypto.randomUUID(), site: "Head & Neck", oar: "Brainstem", type: "Dmax", limit: 54, unit: "Gy", note: "Example only" },
  { id: crypto.randomUUID(), site: "Head & Neck", oar: "Parotid (mean)", type: "Dmean", limit: 26, unit: "Gy", note: "Example only" },
  { id: crypto.randomUUID(), site: "Thorax", oar: "Lung (combined)", type: "Vx", param: 20, limit: 35, unit: "%", note: "Example only (V20)" },
  { id: crypto.randomUUID(), site: "Thorax", oar: "Heart (mean)", type: "Dmean", limit: 26, unit: "Gy", note: "Example only" },
];

export type EvalStatus = "pass" | "caution" | "fail" | "missing";
export function evaluateConstraint(measured: number | undefined, c: Constraint, cautionPct = 0.05): { status: EvalStatus; delta?: number } {
  if (measured == null || Number.isNaN(measured)) return { status: "missing" };
  const limit = c.limit;
  const delta = limit - measured;
  if (measured <= limit) {
    const band = Math.abs(limit) * cautionPct;
    if (measured >= limit - band) return { status: "caution", delta };
    return { status: "pass", delta };
  }
  return { status: "fail", delta };
}

function metricLabel(c: Constraint) {
  return c.type === "Vx" ? `V${c.param}${c.unit}` : c.type;
}

export default function App() {
  const [constraints, setConstraints] = useState<Constraint[]>(starterConstraints);
  const [measurements, setMeasurements] = useState<Record<string, number | undefined>>({});
  const [siteFilter, setSiteFilter] = useState<string>("All");
  const [tightBand, setTightBand] = useState(false);
  const [newC, setNewC] = useState<Partial<Constraint>>({ site: "Other", type: "Dmax", unit: "Gy" });

  const cautionPct = tightBand ? 0.02 : 0.05;
  const sites = useMemo(() => ["All", ...Array.from(new Set(constraints.map(c => c.site)))], [constraints]);
  const filtered = useMemo(() => constraints.filter(c => siteFilter === "All" ? true : c.site === siteFilter), [constraints, siteFilter]);

  const summary = useMemo(() => {
    let pass = 0, caution = 0, fail = 0, missing = 0;
    for (const c of filtered) {
      const res = evaluateConstraint(measurements[c.id], c, cautionPct);
      if (res.status === "pass") pass++; else if (res.status === "caution") caution++; else if (res.status === "fail") fail++; else missing++;
    }
    return { pass, caution, fail, missing };
  }, [filtered, measurements, cautionPct]);

  function addConstraint() {
    if (!newC.site || !newC.oar || !newC.type || newC.limit == null || !newC.unit) return;
    const c: Constraint = {
      id: crypto.randomUUID(),
      site: newC.site!,
      oar: newC.oar!,
      type: newC.type as ConstraintType,
      param: newC.type === "Vx" ? Number(newC.param) : undefined,
      limit: Number(newC.limit),
      unit: newC.unit!,
      note: newC.note,
    };
    setConstraints(prev => [...prev, c]);
    setNewC({ site: newC.site, type: newC.type, unit: newC.unit });
  }

  function removeConstraint(id: string) {
    setConstraints(prev => prev.filter(c => c.id !== id));
    setMeasurements(prev => { const m = { ...prev }; delete m[id]; return m; });
  }

  function exportJSON() {
    const json = JSON.stringify(constraints, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "dose_constraints.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function copyMarkdown() {
    const lines: string[] = [];
    lines.push(`# Plan Review – Dose Constraint Summary`);
    lines.push("| Site | OAR | Metric | Limit | Measured | Status | Δ (limit–meas) |");
    lines.push("|---|---|---|---|---|---|---|");
    for (const c of filtered) {
      const v = measurements[c.id];
      const res = evaluateConstraint(v, c, cautionPct);
      const metric = metricLabel(c);
      const limit = `${c.limit} ${c.unit}`;
      const meas = v == null || Number.isNaN(v) ? "—" : `${v} ${c.unit}`;
      const delta = v == null || Number.isNaN(v) ? "—" : `${(c.limit - v).toFixed(2)} ${c.unit}`;
      lines.push(`| ${c.site} | ${c.oar} | ${metric} | ${limit} | ${meas} | ${res.status.toUpperCase()} | ${delta} |`);
    }
    lines.push("");
    lines.push("> **Note:** Educational template. Replace with validated institutional constraints before any clinical use.");
    navigator.clipboard.writeText(lines.join("\n"));
    alert("Markdown summary copied to clipboard.");
  }

  function loadDemo() {
    const map: Record<string, number> = {};
    filtered.slice(0, 6).forEach((c, i) => {
      if (i === 0) map[c.id] = c.limit - c.limit * 0.03;
      if (i === 1) map[c.id] = c.limit - c.limit * 0.2;
      if (i === 2) map[c.id] = c.limit + c.limit * 0.1;
      if (i === 3) map[c.id] = c.limit;
      if (i === 4) map[c.id] = Math.max(0, c.limit - 0.5);
    });
    setMeasurements(m => ({ ...m, ...map }));
  }

  const rowBg = (status: EvalStatus) => status === "fail" ? "#ffe5e5" : status === "caution" ? "#fff4e5" : "transparent";

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>RadOnc DoseCheck</h1>
      <p style={{ color: "#475569", marginTop: 4 }}>
        Self-contained preview. <b>Replace placeholder limits</b> with validated institutional values before any clinical use.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        <label>
          Site filter:{" "}
          <select value={siteFilter} onChange={e => setSiteFilter(e.target.value)} style={{ marginLeft: 8 }}>
            {sites.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={tightBand} onChange={e => setTightBand(e.target.checked)} /> Tight caution band (±2%)
        </label>
        <button onClick={loadDemo}>Demo values</button>
        <button onClick={() => setConstraints(starterConstraints)}>Reset</button>
        <button onClick={exportJSON}>Export JSON</button>
        <button onClick={copyMarkdown}>Copy Markdown</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10, fontSize: 14 }}>
        <span style={{ background: "#dcfce7", padding: "2px 8px", borderRadius: 8 }}>Pass: {summary.pass}</span>
        <span style={{ background: "#fde68a", padding: "2px 8px", borderRadius: 8 }}>Caution: {summary.caution}</span>
        <span style={{ background: "#fecaca", padding: "2px 8px", borderRadius: 8 }}>Fail: {summary.fail}</span>
        <span style={{ border: "1px solid #cbd5e1", padding: "2px 8px", borderRadius: 8 }}>Missing: {summary.missing}</span>
      </div>

      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#f8fafc" }}>
              <th style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}>Site</th>
              <th style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}>OAR</th>
              <th style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}>Metric</th>
              <th style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}>Limit</th>
              <th style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}>Measured</th>
              <th style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}>Status</th>
              <th style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}>Note</th>
              <th style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const val = measurements[c.id];
              const res = evaluateConstraint(val, c, cautionPct);
              return (
                <tr key={c.id} style={{ background: rowBg(res.status) }}>
                  <td style={{ padding: 8, borderTop: "1px solid #e2e8f0" }}>{c.site}</td>
                  <td style={{ padding: 8, borderTop: "1px solid #e2e8f0" }}>{c.oar}</td>
                  <td style={{ padding: 8, borderTop: "1px solid #e2e8f0" }}>{metricLabel(c)}</td>
                  <td style={{ padding: 8, borderTop: "1px solid #e2e8f0" }}>{c.limit} {c.unit}</td>
                  <td style={{ padding: 8, borderTop: "1px solid #e2e8f0" }}>
                    <input type="number" placeholder={c.unit} value={val ?? ""}
                      onChange={e => setMeasurements(m => ({ ...m, [c.id]: e.target.value === "" ? undefined : Number(e.target.value) }))}
                      style={{ width: 120 }} />
                  </td>
                  <td style={{ padding: 8, borderTop: "1px solid #e2e8f0" }}>{res.status.toUpperCase()}</td>
                  <td style={{ padding: 8, borderTop: "1px solid #e2e8f0", color: "#64748b" }}>{c.note || ""}</td>
                  <td style={{ padding: 8, borderTop: "1px solid #e2e8f0" }}>
                    <button onClick={() => removeConstraint(c.id)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16, border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
        <h3 style={{ margin: 0, marginBottom: 8 }}>Add constraint</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr 1fr 1fr", gap: 8 }}>
          <select value={newC.site as string} onChange={e => setNewC(s => ({ ...s, site: e.target.value }))}>
            {["Head & Neck","Thorax","CNS","Abd/Pelvis","Other"].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input placeholder="OAR" value={newC.oar || ""} onChange={e => setNewC(s => ({ ...s, oar: e.target.value }))} />
          <select value={newC.type as string} onChange={e => setNewC(s => ({ ...s, type: e.target.value as ConstraintType }))}>
            <option value="Dmax">Dmax</option>
            <option value="Dmean">Dmean</option>
            <option value="Vx">Vx</option>
          </select>
          {newC.type === "Vx" ? (
            <input type="number" placeholder="x (e.g., 20)" value={newC.param ?? ""} onChange={e => setNewC(s => ({ ...s, param: Number(e.target.value) }))} />
          ) : (
            <div/>
          )}
          <input type="number" placeholder="Limit" value={newC.limit ?? ""} onChange={e => setNewC(s => ({ ...s, limit: Number(e.target.value) }))} />
          <select value={newC.unit as string} onChange={e => setNewC(s => ({ ...s, unit: e.target.value }))}>
            <option value="Gy">Gy</option>
            <option value="%">%</option>
            <option value="cc">cc</option>
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 8, marginTop: 8 }}>
          <input placeholder="Note (protocol/institution)" value={newC.note || ""} onChange={e => setNewC(s => ({ ...s, note: e.target.value }))} />
          <button onClick={addConstraint}>Add</button>
        </div>
      </div>

      <p style={{ marginTop: 16, fontSize: 12, color: "#64748b" }}>
        Disclaimer: Educational template. Constraint values vary by institution, protocol, and fractionation. Replace with validated limits before use in any clinical context.
      </p>
    </div>
  );
}
