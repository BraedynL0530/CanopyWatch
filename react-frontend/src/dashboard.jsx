import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const TABS = ["map", "images", "reasoning"];

const createCustomIcon = (color) =>
  L.divIcon({
    className: "custom-icon",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${color}" stroke="black" stroke-width="1"><circle cx="12" cy="12" r="8"/></svg>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

const defaultIcon = createCustomIcon("#888888");
const selectedIcon = createCustomIcon("#1d4ed8");
const alertIcon = createCustomIcon("#b91c1c");

function MapUpdater({ lat, lon }) {
  const map = useMap();
  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      map.setView([lat, lon], 14);
    }
  }, [lat, lon, map]);
  return null;
}

function normalizeReasoning(reasoning) {
  if (Array.isArray(reasoning)) return reasoning.filter(Boolean).map(String);
  if (reasoning == null || reasoning === "") return [];
  return [String(reasoning)];
}

function normalizeScan(scan, index) {
  const lat = Number(scan.lat);
  const lon = Number(scan.lon);
  const status = scan.status || "Unknown";
  return {
    id: scan.id,
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    damage_percentage: scan.damage_percentage == null ? null : Number(scan.damage_percentage),
    status,
    reason: scan.reason || "",
    reasoning: normalizeReasoning(scan.reasoning),
    ndvi: scan.ndvi_drop == null ? null : scan.ndvi_drop,
    images: {
      before: scan.before_url || null,
      after: scan.after_url || null,
      mask: scan.mask_url || null,
    },
    page: index + 1,
  };
}

export default function App() {
  const [alerts, setAlerts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [tab, setTab] = useState("imagery");
  const [scanRegion, setScanRegion] = useState("brazil");
  const [scanQueued, setScanQueued] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchRealData = async () => {
      try {
        setLoading(true);
        setFetchError("");
        const response = await fetch("/api/get-latest-scans");
        if (!response.ok) throw new Error(`API returned HTTP ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        if (!Array.isArray(data.scans)) throw new Error("scans missing");
        const formattedAlerts = data.scans.map(normalizeScan);
        if (cancelled) return;
        setAlerts(formattedAlerts);
        setSelectedId((current) =>
          formattedAlerts.some((scan) => scan.id === current) ? current : formattedAlerts[0]?.id ?? null
        );
      } catch (err) {
        if (cancelled) return;
        setFetchError(err instanceof Error ? err.message : "couldnt fetch data");
        setAlerts([]);
        setSelectedId(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchRealData();
    return () => { cancelled = true; };
  }, []);

  const selected = useMemo(
    () => alerts.find((alert) => alert.id === selectedId) || null,
    [alerts, selectedId]
  );

  const statusColor = (status) => {
    if (status === "Illegal Logging" || status === "Illegal") return "#b91c1c";
    if (status === "Needs Review") return "#a16207";
    return "#15803d";
  };

  const getIconForStatus = (alert) => {
    if (selected?.id === alert.id) return selectedIcon;
    if (alert.status === "Illegal Logging" || alert.status === "Illegal") return alertIcon;
    return defaultIcon;
  };

  const damageLabel =
    selected?.damage_percentage == null || Number.isNaN(selected.damage_percentage)
      ? "couldnt find it"
      : `${selected.damage_percentage.toFixed(2)}%`;

  const handleScan = () => {
    setScanQueued(true);
    window.setTimeout(() => setScanQueued(false), 3000);
  };

  if (loading) {
    return (
      <div style={{ padding: 24, fontFamily: "sans-serif", color: "#333" }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", fontFamily: "sans-serif", color: "#111", background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #ccc" }}>
        <strong style={{ fontSize: 18 }}>CanopyWatch</strong>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={scanRegion} onChange={(e) => setScanRegion(e.target.value)} style={{ padding: "4px 8px" }}>
            <option value="brazil">Brazil (Amazon)</option>
          </select>
          <button onClick={handleScan} style={{ padding: "6px 12px", border: "1px solid #333", background: "#fff", cursor: "pointer" }}>
            {scanQueued ? "Scan Queued" : "Scan"}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ width: 260, borderRight: "1px solid #ccc", overflowY: "auto" }}>
          <div style={{ padding: "8px 12px", fontSize: 12, color: "#666", borderBottom: "1px solid #eee" }}>
             Incidents
          </div>
          {alerts.length === 0 ? (
            <div style={{ padding: 12, fontSize: 13, color: "#888" }}>
              {fetchError ? "Couldnt load scans." : "no scans rn."}
            </div>
          ) : (
            alerts.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  border: "none",
                  borderBottom: "1px solid #eee",
                  background: e.id === selectedId ? "#f0f0f0" : "#fff",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 14 }}>{e.id}</div>
                <div style={{ fontSize: 12, color: statusColor(e.status) }}>{e.status}</div>
                <div style={{ fontSize: 11, color: "#999" }}>p.{e.page}</div>
              </button>
            ))
          )}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {selected ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #ccc" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{selected.id}</div>
                  <div style={{ fontSize: 13, color: "#555" }}>
                    lat {selected.lat?.toFixed(4)} · lon {selected.lon?.toFixed(4)}
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: 13 }}>
                  <div>legality: <span style={{ color: statusColor(selected.status), fontWeight: 600 }}>{selected.status}</span></div>
                  <div>damage: {damageLabel}</div>
                </div>
              </div>

              <div style={{ display: "flex", borderBottom: "1px solid #ccc" }}>
                {TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    style={{
                      padding: "8px 16px",
                      border: "none",
                      borderBottom: tab === t ? "2px solid #333" : "2px solid transparent",
                      background: "none",
                      cursor: "pointer",
                      fontWeight: tab === t ? 600 : 400,
                      textTransform: "capitalize",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>
                {tab === "imagery" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, height: "100%" }}>
                    {[
                      { key: "before", label: "Before", src: selected.images.before },
                      { key: "after", label: "After (overlay)", src: selected.images.after },
                    ].map(({ key, label, src }) => (
                      <div key={key} style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{label}</span>
                        <div style={{ position: "relative", flex: 1, border: "1px solid #ccc", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5" }}>
                          {src ? (
                            <img src={src} alt={label} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                          ) : (
                            <span style={{ fontSize: 12, color: "#999" }}>No image data</span>
                          )}
                          {key === "after" && selected.images.mask && (
                            <img src={selected.images.mask} alt="mask" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", opacity: 0.8 }} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {tab === "map" && (
                  <div style={{ height: "100%", border: "1px solid #ccc" }}>
                    {selected.lat != null && selected.lon != null ? (
                      <MapContainer center={[selected.lat, selected.lon]} zoom={14} style={{ height: "100%", width: "100%" }}>
                        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="&copy; Esri" />
                        <MapUpdater lat={selected.lat} lon={selected.lon} />
                        {alerts.filter((a) => a.lat != null && a.lon != null).map((alert) => (
                          <Marker key={alert.id} position={[alert.lat, alert.lon]} icon={getIconForStatus(alert)} eventHandlers={{ click: () => setSelectedId(alert.id) }}>
                            <Popup>{alert.id} — {alert.status}</Popup>
                          </Marker>
                        ))}
                      </MapContainer>
                    ) : (
                      <div style={{ padding: 16, fontSize: 13, color: "#999" }}>coors not found </div>
                    )}
                  </div>
                )}

                {tab === "reasoning" && (
                  <div>
                    {selected.reason && <p style={{ fontSize: 14, lineHeight: 1.6 }}>{selected.reason}</p>}
                    {selected.reasoning.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>agent log</div>
                        {selected.reasoning.map((log, idx) => (
                          <p key={idx} style={{ fontSize: 13, lineHeight: 1.5, borderLeft: "2px solid #ccc", paddingLeft: 10, marginBottom: 8 }}>
                            {log}
                          </p>
                        ))}
                      </div>
                    )}
                    {selected.ndvi != null && (
                      <p style={{ fontSize: 12, color: "#666", marginTop: 12 }}>NDVI drop: {selected.ndvi}</p>
                    )}
                    {!selected.reason && selected.reasoning.length === 0 && (
                      <p style={{ fontSize: 13, color: "#999" }}>No reasoning data available.</p>
                    )}
                  </div>
                )}
              </div>

              <div style={{ textAlign: "center", padding: 8, fontSize: 12, color: "#999" }}>
                — {selected.page} —
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#999" }}>
              {fetchError || "no scan data."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
// why is css still on server?