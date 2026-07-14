import React, { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, ShieldAlert, Activity, Database, Terminal, Map, Image as ImageIcon, ChevronRight, Crosshair, MapPin } from "lucide-react";

export default function App() {
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('agent'); // 'agent' | 'map' | 'imagery'

  useEffect(() => {
    // Simulated API Fetch
    const fetchData = async () => {
      const mockAlerts = [
        {
          id: "CW-8921", lat: -10.0214, lon: -62.0198, date: "2023-07-15", confidence: 0.98,
          status: "Illegal Logging", reason: "No active Sinaflor permits found for these coordinates during the event window.", ndviDrop: 0.32,
          cot: [
            "[System] GeoTIFF ingested from GEE bucket.",
            "[Model] U-Net inference complete. Forest confidence: 98.2%",
            "[Agent] Analyzing temporal anomaly at -10.0214, -62.0198...",
            "[Agent] Querying IBAMA/Sinaflor database for active permits (Buffer: 0.008°)",
            "[Database] 0 records found matching date criteria.",
            "[Agent] VERDICT: Illegal Logging (Presumed). Initiating alert protocols."
          ],
          images: {
            // Using placeholder imagery to simulate the GEE export
            before: "https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=512&auto=format&fit=crop",
            after: "https://images.unsplash.com/photo-1542272201-b1ca555f8505?q=80&w=512&auto=format&fit=crop"
          }
        },
        {
          id: "CW-8922", lat: -10.1500, lon: -62.4011, date: "2023-08-01", confidence: 0.85,
          status: "Needs Review", reason: "Permit found, but expired 2 days before the deforestation event.", ndviDrop: 0.28,
          cot: [
            "[System] GeoTIFF ingested from GEE bucket.",
            "[Model] U-Net inference complete. Forest confidence: 85.1%",
            "[Agent] Querying IBAMA/Sinaflor database...",
            "[Database] 1 record found. Permit ID: AUT-2023-991",
            "[Agent] Cross-referencing dates. Permit expired: 2023-07-30. Event date: 2023-08-01.",
            "[Agent] VERDICT: Borderline violation. Flagging for human review."
          ],
          images: { before: "https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=512&auto=format&fit=crop&grayscale=1", after: "https://images.unsplash.com/photo-1542272201-b1ca555f8505?q=80&w=512&auto=format&fit=crop&grayscale=1" }
        },
        {
          id: "CW-8923", lat: -9.9822, lon: -61.9544, date: "2023-08-12", confidence: 0.92,
          status: "Legal", reason: "Active agricultural permit verified via Sinaflor.", ndviDrop: 0.26,
          cot: [
            "[System] GeoTIFF ingested from GEE bucket.",
            "[Model] U-Net inference complete. Forest confidence: 92.4%",
            "[Agent] Querying IBAMA/Sinaflor database...",
            "[Database] 1 active record found. Status: VALIDA.",
            "[Agent] Matching polygon coordinates... Verified.",
            "[Agent] VERDICT: Legal land clearing. Archiving case."
          ],
          images: { before: "https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=512&auto=format&fit=crop", after: "https://images.unsplash.com/photo-1542272201-b1ca555f8505?q=80&w=512&auto=format&fit=crop" }
        },
      ];
      setAlerts(mockAlerts);
      setSelectedAlert(mockAlerts[0]);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-[#00ff9d] font-mono text-xl animate-pulse tracking-widest">CANOPYWATCH</div>;

  const getStatusColor = (status) => {
    if (status === "Illegal Logging") return "text-[#ff4b4b] bg-[rgba(255,75,75,0.1)] border-[#ff4b4b]";
    if (status === "Needs Review") return "text-[#ffb84d] bg-[rgba(255,184,77,0.1)] border-[#ffb84d]";
    return "text-[#00ff9d] bg-[rgba(0,255,157,0.1)] border-[#00ff9d]";
  };

  // Math to map coordinates roughly to a Brazil-focused radar grid
  const getMapCoordinates = (lat, lon) => {
    const minLat = -30, maxLat = 5;
    const minLon = -75, maxLon = -35;
    const y = ((maxLat - lat) / (maxLat - minLat)) * 100;
    const x = ((lon - minLon) / (maxLon - minLon)) * 100;
    return { top: `${Math.max(0, Math.min(100, y))}%`, left: `${Math.max(0, Math.min(100, x))}%` };
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] p-4 md:p-8 font-sans selection:bg-[#00ff9d] selection:text-black">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-[#222] pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Crosshair className="text-[#00ff9d]" /> CanopyWatch
          </h1>
          <p className="text-[#888] mt-1 text-sm font-mono tracking-widest">AUTONOMOUS LEGAL VERIFICATION AGENT</p>
        </div>
        <div className="flex items-center gap-3 bg-[rgba(0,255,157,0.05)] border border-[rgba(0,255,157,0.3)] text-[#00ff9d] px-5 py-2 rounded-sm text-sm font-mono shadow-[0_0_15px_rgba(0,255,157,0.1)] uppercase tracking-wider">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff9d] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00ff9d]"></span>
          </span>
          Pipeline Live
        </div>
      </header>

      {/* STATS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Active Threats", val: alerts.filter(a => a.status === "Illegal Logging").length, icon: AlertTriangle, color: "text-[#ff4b4b]" },
          { label: "Cleared Legal", val: alerts.filter(a => a.status === "Legal").length, icon: CheckCircle, color: "text-[#00ff9d]" },
          { label: "U-Net Confidence", val: "92.4%", icon: Activity, color: "text-[#4da6ff]" },
          { label: "Permits Audited", val: "1,240", icon: Database, color: "text-[#a64dff]" },
        ].map((stat, i) => (
          <div key={i} className="bg-[#111] border border-[#222] p-5 rounded-sm relative overflow-hidden group hover:border-[#444] transition-colors">
            <div className={`absolute top-0 left-0 w-1 h-full opacity-50 group-hover:opacity-100 transition-opacity ${stat.color.replace('text', 'bg')}`}></div>
            <span className="flex items-center gap-2 text-[#888] text-xs font-mono uppercase tracking-widest mb-3">
              <stat.icon size={14} className={stat.color} /> {stat.label}
            </span>
            <h2 className="text-3xl font-bold text-white tracking-tight">{stat.val}</h2>
          </div>
        ))}
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-[350px,1fr] gap-6">

        {/* LEFT PANEL: Queue & Radar */}
        <div className="space-y-6 flex flex-col">

          {/* Global Radar Map (Interactive CSS Grid) */}
          <div className="bg-[#111] border border-[#222] rounded-sm p-4 relative h-64 overflow-hidden group">
            <h3 className="font-mono text-xs text-[#888] mb-4 flex items-center gap-2 uppercase tracking-widest z-10 relative">
              <GlobeIcon size={14}/> Regional Overview
            </h3>
            {/* Grid Background */}
            <div className="absolute inset-0 top-12 opacity-20 pointer-events-none bg-[linear-gradient(to_right,#444_1px,transparent_1px),linear-gradient(to_bottom,#444_1px,transparent_1px)] bg-[size:2rem_2rem]"></div>

            {/* Plotting the Alert Pins */}
            <div className="relative w-full h-full">
              {alerts.map(alert => (
                <button
                  key={alert.id}
                  onClick={() => setSelectedAlert(alert)}
                  className={`absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full z-20 transition-transform ${selectedAlert?.id === alert.id ? 'scale-150 ring-2 ring-white' : 'hover:scale-125'}`}
                  style={{ ...getMapCoordinates(alert.lat, alert.lon), backgroundColor: alert.status === "Illegal Logging" ? '#ff4b4b' : alert.status === "Legal" ? '#00ff9d' : '#ffb84d' }}
                  title={alert.id}
                >
                  {alert.status === "Illegal Logging" && <span className="animate-ping absolute inset-0 rounded-full bg-[#ff4b4b] opacity-75"></span>}
                </button>
              ))}
            </div>
          </div>

          {/* Alert Queue List */}
          <div className="bg-[#111] border border-[#222] rounded-sm overflow-hidden flex flex-col flex-1 h-[400px]">
            <div className="p-4 border-b border-[#222] bg-[#0a0a0a]">
              <h3 className="font-mono text-xs text-[#888] flex items-center gap-2 uppercase tracking-widest"><Database size={14}/> Investigation Queue</h3>
            </div>
            <div className="overflow-y-auto p-2 space-y-2 custom-scrollbar">
              {alerts.map(alert => (
                <div
                  key={alert.id}
                  onClick={() => setSelectedAlert(alert)}
                  className={`p-3 rounded-sm border-l-2 cursor-pointer transition-all duration-200 ${
                    selectedAlert?.id === alert.id 
                      ? `bg-[#1a1a1a] ${alert.status === 'Illegal Logging' ? 'border-[#ff4b4b]' : alert.status === 'Legal' ? 'border-[#00ff9d]' : 'border-[#ffb84d]'}` 
                      : "bg-transparent border-[#222] hover:bg-[#111]"
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-white text-sm">{alert.id}</h3>
                    <span className={`text-[9px] uppercase px-2 py-0.5 rounded-sm font-bold border ${getStatusColor(alert.status)}`}>
                      {alert.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#666] font-mono">{alert.lat}, {alert.lon}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Case Details */}
        {selectedAlert && (
          <div className="bg-[#111] border border-[#222] rounded-sm flex flex-col h-full overflow-hidden">

            {/* Case Header */}
            <div className="p-6 border-b border-[#222] bg-[#0a0a0a] flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  TARGET: {selectedAlert.id}
                </h2>
                <div className="flex gap-4 mt-2 text-sm text-[#888] font-mono">
                  <span className="flex items-center gap-1"><MapPin size={14}/> {selectedAlert.lat}, {selectedAlert.lon}</span>
                  <span className="flex items-center gap-1"><Activity size={14}/> NDVI: -{selectedAlert.ndviDrop}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#888] uppercase font-mono tracking-widest mb-1">Model Confidence</p>
                <p className="text-3xl font-bold text-[#4da6ff]">{(selectedAlert.confidence * 100).toFixed(1)}%</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-[#222] bg-[#0a0a0a]">
              {[
                { id: 'agent', label: 'Chain of Thought', icon: Terminal },
                { id: 'map', label: 'Live Satellite Map', icon: Map },
                { id: 'imagery', label: 'Temporal Images', icon: ImageIcon },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-mono tracking-widest uppercase transition-colors ${
                    activeTab === tab.id 
                      ? "text-white border-b-2 border-white bg-[#111]" 
                      : "text-[#666] hover:text-[#aaa]"
                  }`}
                >
                  <tab.icon size={16} /> {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content Area */}
            <div className="p-6 flex-1 bg-[#111] overflow-y-auto">

              {/* TAB 1: AGENT TERMINAL (Chain of Thought) */}
              {activeTab === 'agent' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  {/* AI Summary Block */}
                  <div className="bg-[rgba(255,255,255,0.03)] p-5 rounded-sm border border-[#333]">
                    <h4 className="flex items-center gap-2 mb-3 text-xs font-mono text-white uppercase tracking-widest">
                      <ShieldAlert size={14} className={selectedAlert.status === "Legal" ? "text-[#00ff9d]" : "text-[#ffb84d]"}/>
                      Executive Summary
                    </h4>
                    <p className="text-[#ccc] text-sm leading-relaxed border-l-2 border-[#4da6ff] pl-4 italic">
                      "{selectedAlert.reason}"
                    </p>
                  </div>

                  {/* Hacker Terminal Window */}
                  <div className="bg-black rounded-sm border border-[#333] overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                    <div className="bg-[#1a1a1a] px-4 py-2 border-b border-[#333] flex items-center justify-between">
                      <div className="flex gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
                      </div>
                      <span className="text-[10px] text-[#666] font-mono">root@canopy-agent:~</span>
                    </div>
                    <div className="p-5 space-y-3 font-mono text-[13px]">
                      {selectedAlert.cot.map((log, idx) => {
                        let colorClass = "text-[#888]";
                        if (log.includes("[Model]")) colorClass = "text-[#4da6ff]";
                        if (log.includes("[Database]")) colorClass = "text-[#a64dff]";
                        if (log.includes("VERDICT")) colorClass = selectedAlert.status === "Legal" ? "text-[#00ff9d] font-bold" : "text-[#ff4b4b] font-bold";

                        return (
                          <div key={idx} className="flex items-start gap-3">
                            <span className="text-[#333] select-none">{String(idx + 1).padStart(2, '0')}</span>
                            <ChevronRight size={14} className="mt-0.5 text-[#444] shrink-0" />
                            <span className={`${colorClass} leading-relaxed`}>{log}</span>
                          </div>
                        );
                      })}
                      <div className="flex items-center gap-2 text-[#00ff9d] mt-6">
                        <span className="animate-pulse font-bold">█</span> <span className="opacity-50">Awaiting input stream...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: LIVE DRAGGABLE MAP (Google Maps iframe locked to Coords) */}
              {activeTab === 'map' && (
                <div className="h-[500px] rounded-sm border border-[#333] overflow-hidden animate-in fade-in duration-300 relative group">
                  <div className="absolute top-4 left-4 z-10 bg-black/80 backdrop-blur border border-[#333] px-3 py-1.5 rounded-sm flex items-center gap-2 text-xs font-mono text-white">
                    <div className="w-2 h-2 bg-[#00ff9d] rounded-full animate-pulse"></div> Live Satellite Feed
                  </div>
                  <iframe
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    scrolling="no"
                    marginHeight="0"
                    marginWidth="0"
                    src={`https://maps.google.com/maps?q=${selectedAlert.lat},${selectedAlert.lon}&t=k&z=13&output=embed`}
                    className="grayscale-[30%] contrast-[1.2]"
                  ></iframe>
                </div>
              )}

              {/* TAB 3: TEMPORAL IMAGERY (Before & After PNGs) */}
              {activeTab === 'imagery' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">

                  {/* Before Image */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center border-b border-[#333] pb-2">
                      <span className="text-xs text-[#888] font-mono tracking-widest uppercase">T-90 Days (Baseline)</span>
                      <span className="text-[10px] bg-[#222] px-2 py-1 rounded-sm text-[#888]">Visible RGB</span>
                    </div>
                    <div className="relative rounded-sm border border-[#333] overflow-hidden group">
                      <img src={selectedAlert.images.before} alt="Baseline imagery" className="w-full aspect-square object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>

                  {/* After Image */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center border-b border-[#333] pb-2">
                      <span className="text-xs text-[#888] font-mono tracking-widest uppercase text-white">T-0 (Detection Event)</span>
                      <span className="text-[10px] bg-[rgba(255,75,75,0.1)] border border-[#ff4b4b] px-2 py-1 rounded-sm text-[#ff4b4b]">Anomaly Detected</span>
                    </div>
                    <div className="relative rounded-sm border border-[#ff4b4b] overflow-hidden">
                      <img src={selectedAlert.images.after} alt="Detection imagery" className="w-full aspect-square object-cover" />
                      {/* Simulated prediction overlay for visual flair */}
                      {selectedAlert.status !== "Legal" && (
                         <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,75,75,0.4)_0%,transparent_50%)] animate-pulse mix-blend-screen pointer-events-none"></div>
                      )}
                    </div>
                  </div>

                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Custom simple icon for the map globe to avoid extra imports
function GlobeIcon(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
    </svg>
  );
}