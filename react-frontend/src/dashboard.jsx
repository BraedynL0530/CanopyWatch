import React, { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, ShieldAlert, Activity, Database, Terminal, Map, Image as ImageIcon, ChevronRight, Crosshair, MapPin } from "lucide-react";

export default function App() {
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('map'); // Default to map!

  useEffect(() => {
    const fetchRealData = async () => {
      try {
        const response = await fetch("/api/get-latest-scans");
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        // Map backend scan structure to frontend requirements
        const formattedAlerts = data.scans.map(scan => ({
          id: scan.id,
          lat: scan.lat,
          lon: scan.lon,
          date: scan.timestamp,
          confidence: scan.confidence,
          status: scan.status,
          reason: scan.reason,
          ndviDrop: scan.ndvi_drop,
          cot: scan.logs || [],
          images: {
            before: scan.before_url,
            after: scan.after_url
          }
        }));

        setAlerts(formattedAlerts);
        if (formattedAlerts.length > 0) setSelectedAlert(formattedAlerts[0]);
      } catch (err) {
        console.error("Failed to fetch scan data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRealData();
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-[#00ff9d] font-mono text-xl animate-pulse tracking-widest">CONNECTING TO AGENT...</div>;

  const getStatusColor = (status) => {
    if (status === "Illegal Logging") return "text-[#ff4b4b] bg-[rgba(255,75,75,0.1)] border-[#ff4b4b]";
    if (status === "Needs Review") return "text-[#ffb84d] bg-[rgba(255,184,77,0.1)] border-[#ffb84d]";
    return "text-[#00ff9d] bg-[rgba(0,255,157,0.1)] border-[#00ff9d]";
  };

  const getPinColor = (status) => {
    if (status === "Illegal Logging") return "text-[#ff4b4b]";
    if (status === "Needs Review") return "text-[#ffb84d]";
    return "text-[#00ff9d]";
  };

  const getMapCoordinates = (lat, lon) => {
    // These bounds should match whatever map background you are using
    const minLat = -30, maxLat = 5;
    const minLon = -75, maxLon = -35;
    const y = ((maxLat - lat) / (maxLat - minLat)) * 100;
    const x = ((lon - minLon) / (maxLon - minLon)) * 100;
    return { top: `${Math.max(0, Math.min(100, y))}%`, left: `${Math.max(0, Math.min(100, x))}%` };
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] p-4 md:p-8 font-sans">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-[#222] pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Crosshair className="text-[#00ff9d]" /> CanopyWatch
          </h1>
          <p className="text-[#888] mt-1 text-sm font-mono tracking-widest">AUTONOMOUS LEGAL VERIFICATION AGENT</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[350px,1fr] gap-6">
        {/* SIDEBAR: Investigation Queue */}
        <div className="space-y-6">
          <div className="bg-[#111] border border-[#222] rounded-sm overflow-hidden flex flex-col h-[600px]">
            <div className="p-4 border-b border-[#222] bg-[#0a0a0a]">
              <h3 className="font-mono text-xs text-[#888] uppercase tracking-widest flex items-center gap-2"><Database size={14}/> Investigation Queue</h3>
            </div>
            <div className="overflow-y-auto p-2 space-y-2">
              {alerts.map(alert => (
                <div key={alert.id} onClick={() => setSelectedAlert(alert)}
                  className={`p-3 rounded-sm border-l-2 cursor-pointer transition-colors ${selectedAlert?.id === alert.id ? "bg-[#1a1a1a] border-[#00ff9d]" : "border-[#222] hover:bg-[#111]"}`}>
                  <h3 className="font-bold text-white text-sm">{alert.id}</h3>
                  <span className={`text-[9px] uppercase px-2 py-0.5 rounded-sm font-bold border ${getStatusColor(alert.status)}`}>{alert.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MAIN PANEL */}
        {selectedAlert && (
          <div className="bg-[#111] border border-[#222] rounded-sm h-[600px] flex flex-col">
            <div className="p-6 border-b border-[#222] flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">TARGET: {selectedAlert.id}</h2>
              <span className="font-mono text-sm text-[#888]">LAT: {selectedAlert.lat.toFixed(4)} | LON: {selectedAlert.lon.toFixed(4)}</span>
            </div>

            {/* TABS */}
            <div className="flex border-b border-[#222]">
              {['map', 'agent', 'imagery'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-4 text-sm font-mono uppercase transition-colors ${activeTab === tab ? "border-b-2 border-[#00ff9d] text-white" : "text-[#666] hover:text-[#aaa]"}`}>
                  {tab}
                </button>
              ))}
            </div>

            {/* TAB CONTENT */}
            <div className="p-6 flex-1 overflow-y-auto relative">

              {activeTab === 'map' && (
                <div className="absolute inset-4 bg-[#1a1a1a] rounded border border-[#333] overflow-hidden">
                  {/* Optional: Add a map background image here if you have one! */}
                  <div className="w-full h-full relative" style={{ backgroundImage: "url('/your-world-map-image.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}>

                    {/* Render ALL pins on the map */}
                    {alerts.map(alert => {
                      const isSelected = selectedAlert?.id === alert.id;
                      return (
                        <MapPin
                          key={`pin-${alert.id}`}
                          onClick={() => setSelectedAlert(alert)}
                          className={`absolute cursor-pointer transform -translate-x-1/2 -translate-y-full drop-shadow-lg transition-all ${isSelected ? "text-[#00ff9d] z-20 w-8 h-8" : `${getPinColor(alert.status)} opacity-60 hover:opacity-100 z-10 w-6 h-6`}`}
                          style={getMapCoordinates(alert.lat, alert.lon)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'agent' && (
                <div className="space-y-4">
                  {selectedAlert.cot.length > 0 ? (
                    selectedAlert.cot.map((log, idx) => <p key={idx} className="font-mono text-sm text-[#aaa] border-l-2 border-[#333] pl-3">{log}</p>)
                  ) : (
                    <p className="font-mono text-sm text-[#666] italic">No agent reasoning logs available for this scan.</p>
                  )}
                </div>
              )}

              {activeTab === 'imagery' && (
                <div className="grid grid-cols-2 gap-4 h-full">
                  <div className="flex flex-col">
                    <span className="font-mono text-xs text-[#888] mb-2 uppercase">Before Scan</span>
                    {selectedAlert.images.before ? (
                      <img src={selectedAlert.images.before} alt="Before" className="rounded border border-[#333] object-cover h-full w-full" />
                    ) : (
                      <div className="flex-1 border border-[#333] border-dashed flex items-center justify-center text-[#666] font-mono text-xs">NO IMAGE</div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-mono text-xs text-[#888] mb-2 uppercase">After Scan</span>
                    {selectedAlert.images.after ? (
                      <img src={selectedAlert.images.after} alt="After" className="rounded border border-[#333] object-cover h-full w-full" />
                    ) : (
                      <div className="flex-1 border border-[#333] border-dashed flex items-center justify-center text-[#666] font-mono text-xs">NO IMAGE</div>
                    )}
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