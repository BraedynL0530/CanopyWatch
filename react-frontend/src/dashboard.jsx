import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./dashboard.css";

const TABS = ["map", "imagery", "reasoning"];
const PAGE_TURN_MS = 1230;
const ENTRY_SWAP_MS = 470;

const createCustomIcon = (color) =>
  L.divIcon({
    className: "custom-icon",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  });

const defaultIcon = createCustomIcon("#728276");
const selectedIcon = createCustomIcon("#5c4530");
const alertIcon = createCustomIcon("#8b3a2f");

function MapUpdater({ lat, lon }) {
  const map = useMap();

  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      map.flyTo([lat, lon], 14, { duration: 1.2 });
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
  const illegal = status === "Illegal Logging" || status === "Illegal";

  return {
    id: scan.id,
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    date: scan.timestamp ?? null,
    damage_percentage:
      scan.damage_percentage == null ? null : Number(scan.damage_percentage),
    status,
    verdict: illegal ? "Illegal" : status,
    verdictColor: illegal ? "#8b3a2f" : status === "Needs Review" ? "#8a6a2f" : "#3f5a3a",
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

function PaperTexture() {
  return (
    <svg className="paper-grain absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.18  0 0 0 0 0.1  0 0 0 0.35 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
      <rect width="100%" height="100%" filter="url(#grain)" opacity="0.38" transform="scale(1.003)" />
    </svg>
  );
}

function WatercolorTrees({ side = "left" }) {
  const flip = side === "right" ? "scale-x-[-1]" : "";
  const fid = `wc-${side}`;

  return (
    <svg viewBox="0 0 220 600" className={`absolute top-0 ${side}-0 h-full w-64 pointer-events-none ${flip}`} style={{ opacity: 0.72 }} aria-hidden="true">
      <defs>
        <filter id={fid} x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.015 0.025" numOctaves="3" seed="6" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="22" xChannelSelector="R" yChannelSelector="G" />
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
        <filter id={`${fid}-soft`} x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.03" numOctaves="2" seed="3" result="n2" />
          <feDisplacementMap in="SourceGraphic" in2="n2" scale="30" xChannelSelector="R" yChannelSelector="G" />
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <g filter={`url(#${fid}-soft)`} style={{ mixBlendMode: "multiply" }}>
        <ellipse cx="70" cy="260" rx="95" ry="240" fill="#5c7a4a" opacity="0.28" />
        <ellipse cx="40" cy="140" rx="70" ry="140" fill="#7a9660" opacity="0.22" />
        <ellipse cx="90" cy="440" rx="85" ry="160" fill="#3f5a3a" opacity="0.25" />
      </g>
      <g filter={`url(#${fid})`} style={{ mixBlendMode: "multiply" }}>
        <path d="M44 600 C42 500,46 440,48 400 L40 400 C38 460,40 520,36 600 Z" fill="#4a3826" opacity="0.4" />
        <path d="M118 600 C116 480,120 420,122 370 L112 370 C110 440,112 520,106 600 Z" fill="#3a2c1c" opacity="0.35" />
        <ellipse cx="46" cy="380" rx="66" ry="95" fill="#3f5a3a" opacity="0.55" />
        <ellipse cx="20" cy="300" rx="52" ry="80" fill="#557a45" opacity="0.5" />
        <ellipse cx="80" cy="250" rx="68" ry="90" fill="#6b8a52" opacity="0.45" />
        <ellipse cx="50" cy="180" rx="48" ry="70" fill="#2f4a2c" opacity="0.45" />
        <ellipse cx="110" cy="340" rx="58" ry="105" fill="#7a9660" opacity="0.4" />
        <ellipse cx="95" cy="460" rx="72" ry="80" fill="#4a6741" opacity="0.45" />
        <ellipse cx="18" cy="470" rx="45" ry="60" fill="#3a5233" opacity="0.4" />
        <ellipse cx="130" cy="220" rx="40" ry="55" fill="#5c7a4a" opacity="0.35" />
        <ellipse cx="155" cy="150" rx="62" ry="86" fill="#49683c" opacity="0.28" />
        <ellipse cx="150" cy="290" rx="74" ry="105" fill="#5f7c48" opacity="0.30" />
        <ellipse cx="165" cy="430" rx="68" ry="118" fill="#3f5a3a" opacity="0.28" />
        <ellipse cx="82" cy="105" rx="52" ry="68" fill="#7a9660" opacity="0.24" />
        <ellipse cx="95" cy="535" rx="78" ry="86" fill="#557447" opacity="0.25" />
        <path d="M152 600 C150 500,158 410,151 320" fill="none" stroke="#3a2c1c" strokeWidth="8" opacity="0.20" />
      </g>
      <g filter={`url(#${fid})`} style={{ mixBlendMode: "screen" }}>
        <ellipse cx="66" cy="220" rx="34" ry="48" fill="#c9dba8" opacity="0.18" />
        <ellipse cx="100" cy="380" rx="28" ry="40" fill="#c9dba8" opacity="0.14" />
      </g>
    </svg>
  );
}

function WatercolorSprig() {
  return (
    <svg className="absolute right-0 bottom-0 w-72 h-[72%] pointer-events-none opacity-[0.32]" viewBox="0 0 260 520" preserveAspectRatio="none" aria-hidden="true">
      <g style={{ mixBlendMode: "multiply" }}>
        <path d="M226 520 C222 430,218 350,224 260 C228 185,215 95,184 20" fill="none" stroke="#4a3826" strokeWidth="7" opacity="0.24" />
        <ellipse cx="184" cy="82" rx="52" ry="78" fill="#557447" opacity="0.30" />
        <ellipse cx="211" cy="150" rx="48" ry="72" fill="#6b8a52" opacity="0.30" />
        <ellipse cx="175" cy="235" rx="65" ry="86" fill="#3f5a3a" opacity="0.26" />
        <ellipse cx="211" cy="330" rx="54" ry="78" fill="#5c7a4a" opacity="0.28" />
        <ellipse cx="166" cy="420" rx="74" ry="88" fill="#7a9660" opacity="0.24" />
        <ellipse cx="92" cy="360" rx="42" ry="65" fill="#4a6741" opacity="0.20" />
        <ellipse cx="116" cy="125" rx="34" ry="54" fill="#7a9660" opacity="0.18" />
      </g>
    </svg>
  );
}

function ReasoningFoliage() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 700 600" preserveAspectRatio="none" style={{ opacity: 0.28 }} aria-hidden="true">
      <g style={{ mixBlendMode: "multiply" }}>
        <path d="M0 470 C150 350,250 300,370 250 C500 195,590 150,700 75" fill="none" stroke="#4a6741" strokeWidth="8" opacity="0.18" />
        <ellipse cx="92" cy="344" rx="42" ry="70" fill="#3f5a3a" opacity="0.32" transform="rotate(-32 92 344)" />
        <ellipse cx="145" cy="300" rx="34" ry="58" fill="#557447" opacity="0.30" transform="rotate(-48 145 300)" />
        <ellipse cx="204" cy="267" rx="30" ry="54" fill="#6b8a52" opacity="0.28" transform="rotate(-60 204 267)" />
        <ellipse cx="270" cy="232" rx="27" ry="49" fill="#4a6741" opacity="0.27" transform="rotate(-67 270 232)" />
        <ellipse cx="342" cy="173" rx="25" ry="48" fill="#7a9660" opacity="0.25" transform="rotate(-55 342 173)" />
        <ellipse cx="610" cy="350" rx="40" ry="68" fill="#4a6741" opacity="0.28" transform="rotate(30 610 350)" />
        <ellipse cx="556" cy="306" rx="33" ry="58" fill="#557447" opacity="0.27" transform="rotate(44 556 306)" />
        <ellipse cx="505" cy="277" rx="29" ry="52" fill="#6b8a52" opacity="0.25" transform="rotate(58 505 277)" />
        <ellipse cx="447" cy="229" rx="26" ry="47" fill="#3f5a3a" opacity="0.24" transform="rotate(66 447 229)" />
        <path d="M350 430 C345 370,348 325,370 285" fill="none" stroke="#3a5233" strokeWidth="6" opacity="0.20" />
        <ellipse cx="340" cy="330" rx="28" ry="58" fill="#557447" opacity="0.22" transform="rotate(-28 340 330)" />
        <ellipse cx="365" cy="326" rx="27" ry="62" fill="#6b8a52" opacity="0.20" transform="rotate(8 365 326)" />
        <ellipse cx="389" cy="335" rx="27" ry="58" fill="#3f5a3a" opacity="0.19" transform="rotate(31 389 335)" />
      </g>
    </svg>
  );
}

function BinderTab({ label, active, onClick, index }) {
  const widths = [82, 93, 104];

  return (
    <button
      onClick={onClick}
      className="text-left px-3 py-2.5 transition-all duration-200"
      style={{
        fontFamily: "'Kalam', cursive",
        fontSize: "12px",
        letterSpacing: "0.04em",
        color: active ? "#f3e7ca" : "#4f3d2b",
        background: active ? "#674c32" : "#c7b184",
        border: "1px solid #806847",
        borderLeft: "1px solid #6f593c",
        borderTopRightRadius: "4px",
        borderBottomRightRadius: "4px",
        width: `${widths[index]}px`,
        boxShadow: active ? "2px 2px 6px rgba(55,38,22,0.30)" : "1px 2px 4px rgba(55,38,22,0.16)",
        transform: active ? "translateX(-3px)" : "translateX(0)",
        zIndex: active ? 20 : 10 - index,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

export default function App() {
  const [alerts, setAlerts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [tab, setTab] = useState("imagery");
  const [turningPage, setTurningPage] = useState(false);
  const [scanRegion, setScanRegion] = useState("brazil");
  const [notification, setNotification] = useState("");

  useEffect(() => {
    let cancelled = false;

    const fetchRealData = async () => {
      try {
        setLoading(true);
        setFetchError("");

        const response = await fetch("/api/get-latest-scans");
        if (!response.ok) {
          throw new Error(`API returned HTTP ${response.status}`);
        }

        const data = await response.json();
        if (data.error) throw new Error(data.error);
        if (!Array.isArray(data.scans)) throw new Error("API response is missing a scans array");

        const formattedAlerts = data.scans.map(normalizeScan);
        if (cancelled) return;

        setAlerts(formattedAlerts);
        setSelectedId((current) =>
          formattedAlerts.some((scan) => scan.id === current)
            ? current
            : formattedAlerts[0]?.id ?? null
        );
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch scan data:", err);
        setFetchError(err instanceof Error ? err.message : "Failed to fetch scan data");
        setAlerts([]);
        setSelectedId(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRealData();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => alerts.find((alert) => alert.id === selectedId) || null,
    [alerts, selectedId]
  );

  const changeEntry = (id) => {
    if (id === selectedId || turningPage) return;

    setTurningPage(true);
    window.setTimeout(() => setSelectedId(id), ENTRY_SWAP_MS);
    window.setTimeout(() => setTurningPage(false), PAGE_TURN_MS);
  };

  const changeTab = (nextTab) => {
    if (nextTab === tab) return;
    setTab(nextTab);
  };

  const handleInitiateScan = () => {
    setNotification(`Scan for ${scanRegion.toUpperCase()} is already queued. Results will appear here when available.`);
    window.setTimeout(() => setNotification(""), 3500);
  };

  const getStatusColor = (status) => {
    if (status === "Illegal Logging" || status === "Illegal") return "#8b3a2f";
    if (status === "Needs Review") return "#8a6a2f";
    return "#3f5a3a";
  };

  const getIconForStatus = (alert) => {
    if (selected?.id === alert.id) return selectedIcon;
    if (alert.status === "Illegal Logging" || alert.status === "Illegal") return alertIcon;
    return defaultIcon;
  };

  const damageLabel = selected?.damage_percentage == null || Number.isNaN(selected.damage_percentage)
    ? "—"
    : `${selected.damage_percentage.toFixed(2)}%`;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#171209] text-[#7a6248] font-mono text-xl animate-pulse tracking-widest">
        OPENING FIELD NOTES...
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden bg-[#171209]">
      {notification && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-[#e7dab8] border border-[#806847] text-[#3a2e1f] px-5 py-3 rounded-sm font-mono text-xs z-[9999] shadow-lg">
          {notification}
        </div>
      )}

      <div className="notebook-shell relative rounded-none flex" style={{
        background: "linear-gradient(135deg, #ece0c4 0%, #e3d5ae 50%, #ddd0a5 100%)",
        boxShadow: "0 30px 70px rgba(0,0,0,0.6), 0 0 0 1px #7a6248",
      }}>
        <PaperTexture />

        <div className="relative w-72 shrink-0 flex flex-col" style={{ background: "#e7dab8", borderRight: "1px solid #b3a074" }}>
          <WatercolorTrees side="left" />

          <div className="relative px-5 pt-6 pb-4" style={{ borderBottom: "1px solid #b3a074" }}>
            <h1 style={{ fontFamily: "'Caveat', cursive", fontSize: "34px", color: "#3a2e1f", lineHeight: 1 }}>
              CanopyWatch
            </h1>
          </div>

          <div className="relative px-4 pt-4 pb-2">
            <p style={{ fontFamily: "'Kalam', cursive", fontSize: "12px", letterSpacing: "0.08em", color: "#7a6248" }} className="uppercase">
              Contents
            </p>
          </div>

          <div className="relative flex-1 overflow-y-auto px-3 pb-4 space-y-1 scrollbar-hide">
            {alerts.length === 0 ? (
              <div className="p-4 text-center" style={{ fontFamily: "'Patrick Hand', cursive", color: "#7a6248", fontSize: "13px" }}>
                {fetchError ? "Could not load scans." : "No scans yet."}
              </div>
            ) : (
              alerts.map((e) => (
                <button
                  key={e.id}
                  onClick={() => changeEntry(e.id)}
                  disabled={turningPage}
                  className="w-full text-left px-3 py-3 rounded-sm transition-colors relative disabled:cursor-wait"
                  style={{
                    background: e.id === selectedId ? "rgba(122,98,72,0.15)" : "transparent",
                    borderLeft: e.id === selectedId ? "3px solid #5c4530" : "3px solid transparent",
                  }}
                >
                  <div className="flex items-baseline gap-2">
                    <span style={{ fontFamily: "'Caveat', cursive", fontSize: "26px", color: "#3a2e1f", fontWeight: 700, lineHeight: 1 }}>
                      {e.id}
                    </span>
                    <span style={{ fontFamily: "'Patrick Hand', cursive", fontSize: "13px", color: getStatusColor(e.status), fontWeight: 700 }}>
                      {e.verdict}
                    </span>
                  </div>
                  <div className="mt-0.5" style={{ fontFamily: "'Patrick Hand', cursive", fontSize: "11px", color: "#6b5a3f", fontWeight: 700 }}>
                    p.{e.page}
                  </div>
                </button>
              ))
            )}

            <div className="flex-1 flex items-end justify-center pt-8 pb-4 opacity-40">
              <span style={{ fontFamily: "'Caveat', cursive", fontSize: "16px", color: "#7a6248" }}>
                — end of entries —
              </span>
            </div>
          </div>
        </div>

        <div className="relative flex-1 flex flex-col overflow-visible min-w-0">
          {turningPage && <div className="journal-page-turn" aria-hidden="true" />}
          <WatercolorTrees side="right" />
          {tab === "reasoning" && (
            <>
              <WatercolorSprig />
              <ReasoningFoliage />
            </>
          )}

          <div className="relative flex items-start justify-between px-8 pt-6 pb-3" style={{ borderBottom: "1px solid #b3a074" }}>
            <div>
              <h2 style={{ fontFamily: "'Caveat', cursive", fontSize: "26px", color: "#3a2e1f" }}>
                {selected?.id || "No target"}
              </h2>
              {selected && (
                <p className="ink-underline" style={{ fontFamily: "'Patrick Hand', cursive", fontSize: "14px", color: "#5a4a35" }}>
                  lat {selected.lat?.toFixed(4)} &nbsp;·&nbsp; lon {selected.lon?.toFixed(4)}
                </p>
              )}
            </div>

            {selected && (
              <div className="text-right" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                <div style={{ fontSize: "13px", color: "#7a6248" }}>legality</div>
                <div style={{ fontSize: "20px", color: selected.verdictColor, fontFamily: "'Caveat', cursive" }}>
                  {selected.verdict}
                </div>
                <div style={{ fontSize: "13px", color: "#7a6248", marginTop: "6px" }}>
                  damage <span style={{ color: "#8b3a2f" }}>{damageLabel}</span>
                </div>
              </div>
            )}
          </div>

          <div className="absolute flex flex-col items-end gap-2 z-20 pointer-events-auto" style={{ right: "-1px", top: "172px", width: "104px" }}>
            {TABS.map((t, i) => (
              <div key={t} style={{ marginTop: i === 0 ? 0 : 3 }}>
                <BinderTab label={t} active={tab === t} onClick={() => changeTab(t)} index={i} />
              </div>
            ))}
          </div>

          <div className="relative flex-1 px-8 pb-8 pt-4 min-h-0">
            {!selected ? (
              <div className="h-full flex items-center justify-center" style={{ fontFamily: "'Patrick Hand', cursive", color: "#7a6248", fontSize: "15px" }}>
                {fetchError || "No scan data available."}
              </div>
            ) : (
              <>
                {tab === "imagery" && (
                  <div className="h-full min-h-0 grid grid-cols-2 gap-6">
                    {[
                      { key: "before", label: "before scan", src: selected.images.before },
                      { key: "after", label: "after scan (overlay)", src: selected.images.after },
                    ].map(({ key, label, src }) => (
                      <div key={key} className="flex flex-col min-h-0">
                        <span className="mb-1" style={{ fontFamily: "'Patrick Hand', cursive", fontSize: "13px", color: "#7a6248" }}>
                          {label}
                        </span>
                        <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden" style={{ background: "#d8c9a0", border: "1px solid #b3a074", boxShadow: "inset 0 0 20px rgba(90,70,45,0.25)" }}>
                          {src ? (
                            <img src={src} alt={label} className="satellite-image" />
                          ) : (
                            <span style={{ fontFamily: "'Patrick Hand', cursive", color: "#9a8a68", fontSize: "13px" }}>
                              [ no image data ]
                            </span>
                          )}
                          {key === "after" && selected.images.mask && (
                            <img src={selected.images.mask} alt="Deforestation mask overlay" className="satellite-image absolute inset-0 pointer-events-none" style={{ objectFit: "contain", opacity: 0.82 }} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {tab === "map" && (
                  <div className="h-full min-h-0 overflow-hidden" style={{ background: "#d8c9a0", border: "1px solid #b3a074", boxShadow: "inset 0 0 20px rgba(90,70,45,0.25)" }}>
                    {selected.lat != null && selected.lon != null ? (
                      <MapContainer center={[selected.lat, selected.lon]} zoom={14} style={{ height: "100%", width: "100%" }} zoomControl={false}>
                        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="&copy; Esri" />
                        <MapUpdater lat={selected.lat} lon={selected.lon} />
                        {alerts.filter((alert) => alert.lat != null && alert.lon != null).map((alert) => (
                          <Marker
                            key={alert.id}
                            position={[alert.lat, alert.lon]}
                            icon={getIconForStatus(alert)}
                            eventHandlers={{ click: () => changeEntry(alert.id) }}
                          >
                            <Popup>
                              <span style={{ fontFamily: "'Patrick Hand', cursive" }}>{alert.id}</span><br />
                              <span>{alert.verdict}</span>
                            </Popup>
                          </Marker>
                        ))}
                      </MapContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center" style={{ fontFamily: "'Patrick Hand', cursive", color: "#9a8a68", fontSize: "13px" }}>
                        [ coordinates unavailable ]
                      </div>
                    )}
                  </div>
                )}

                {tab === "reasoning" && (
                  <div className="h-full overflow-y-auto pr-2 scrollbar-hide relative z-10">
                    {selected.reason && (
                      <p style={{ fontFamily: "'Patrick Hand', cursive", fontSize: "17px", lineHeight: 1.7, color: "#3a2e1f", maxWidth: "900px" }}>
                        {selected.reason}
                      </p>
                    )}

                    {selected.reasoning.length > 0 && (
                      <div className="mt-6 space-y-3" style={{ maxWidth: "900px" }}>
                        <div style={{ fontFamily: "'Kalam', cursive", fontSize: "12px", letterSpacing: "0.08em", color: "#7a6248" }} className="uppercase">
                          agent reasoning log
                        </div>
                        {selected.reasoning.map((log, idx) => (
                          <p key={`${selected.id}-${idx}`} style={{ fontFamily: "'Patrick Hand', cursive", fontSize: "15px", lineHeight: 1.55, color: "#4a3826", borderLeft: "2px solid #8a7455", paddingLeft: "12px" }}>
                            {log}
                          </p>
                        ))}
                      </div>
                    )}

                    {selected.ndvi != null && (
                      <p className="mt-5" style={{ fontFamily: "'Patrick Hand', cursive", fontSize: "13px", color: "#7a6248" }}>
                        ndvi drop: {selected.ndvi}
                      </p>
                    )}

                    {!selected.reason && selected.reasoning.length === 0 && (
                      <p style={{ fontFamily: "'Patrick Hand', cursive", color: "#7a6248" }}>
                        No reasoning data available for this scan.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="relative text-center pb-3">
            <span style={{ fontFamily: "'Patrick Hand', cursive", fontSize: "12px", color: "#6b5a3f", fontWeight: 700 }}>
              — {selected?.page ?? "—"} —
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
