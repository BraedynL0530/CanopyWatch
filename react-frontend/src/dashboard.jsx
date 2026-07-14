import React, { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, ShieldAlert, Activity, Database, Terminal, Map, Image as ImageIcon, ChevronRight, Crosshair, MapPin } from "lucide-react";

export default function App() {
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('agent');

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

  const getMapCoordinates = (lat, lon) => {
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
        <div className="space-y-6">
          <div className="bg-[#111] border border-[#222] rounded-sm overflow-hidden flex flex-col h-[600px]">
            <div className="p-4 border-b border-[#222] bg-[#0a0a0a]">
              <h3 className="font-mono text-xs text-[#888] uppercase tracking-widest flex items-center gap-2"><Database size={14}/> Investigation Queue</h3>
            </div>
            <div className="overflow-y-auto p-2 space-y-2">
              {alerts.map(alert => (
                <div key={alert.id} onClick={() => setSelectedAlert(alert)}
                  className={`p-3 rounded-sm border-l-2 cursor-pointer ${selectedAlert?.id === alert.id ? "bg-[#1a1a1a] border-[#00ff9d]" : "border-[#222] hover:bg-[#111]"}`}>
                  <h3 className="font-bold text-white text-sm">{alert.id}</h3>
                  <span className={`text-[9px] uppercase px-2 py-0.5 rounded-sm font-bold border ${getStatusColor(alert.status)}`}>{alert.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {selectedAlert && (
          <div className="bg-[#111] border border-[#222] rounded-sm h-[600px] flex flex-col">
            <div className="p-6 border-b border-[#222]">
              <h2 className="text-2xl font-bold text-white">TARGET: {selectedAlert.id}</h2>
            </div>
            <div className="flex border-b border-[#222]">
              {['agent', 'imagery'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-4 text-sm font-mono uppercase ${activeTab === tab ? "border-b-2 border-white" : "text-[#666]"}`}>
                  {tab}
                </button>
              ))}
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              {activeTab === 'agent' && (
                <div className="space-y-4">
                  {selectedAlert.cot.map((log, idx) => <p key={idx} className="font-mono text-xs text-[#888]">{log}</p>)}
                </div>
              )}
              {activeTab === 'imagery' && (
                <div className="grid grid-cols-2 gap-4">
                  <img src={selectedAlert.images.before} alt="Before" className="rounded border border-[#333]" />
                  <img src={selectedAlert.images.after} alt="After" className="rounded border border-[#333]" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}