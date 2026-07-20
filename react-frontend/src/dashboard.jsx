import React, { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, ShieldAlert, Activity, Database, Terminal, Map as MapIcon, Image as ImageIcon, ChevronRight, Crosshair, MapPin, Zap } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const createCustomIcon = (color) => {
  return L.divIcon({
    className: 'custom-icon',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  });
};

const defaultIcon = createCustomIcon('#888888');
const selectedIcon = createCustomIcon('#00ff9d');
const alertIcon = createCustomIcon('#ff4b4b');

function MapUpdater({ lat, lon }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lon) {
      map.flyTo([lat, lon], 14, { duration: 1.5 });
    }
  }, [lat, lon, map]);
  return null;
}

export default function App() {
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('map');

  // NEW: State for the scanning UI
  const [scanRegion, setScanRegion] = useState('brazil');
  const [notification, setNotification] = useState('');

  useEffect(() => {
    const fetchRealData = async () => {
      try {
        const response = await fetch("/api/get-latest-scans");
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        const formattedAlerts = data.scans.map(scan => ({
          id: scan.id,
          lat: scan.lat,
          lon: scan.lon,
          date: scan.timestamp,
          damage_percentage: scan.damage_percentage, // not used yet
          status: scan.status,
          reason: scan.reason,
          ndviDrop: scan.ndvi_drop,
          cot: scan.reasoning || [],
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

    setLoading(false);
  }, []);

  // NEW: The scan button handler
  const handleInitiateScan = () => {
    // 1. Show the UI popup
    setNotification(`Queuing scan for region: ${scanRegion.toUpperCase()} this may take a few days(time for trip)`);

    // 2. Hide it after 2 seconds
    setTimeout(() => setNotification(''), 2000);

    //this is just a button so people feel like they did stuff as its already queued
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-[#00ff9d] font-mono text-xl animate-pulse tracking-widest">CONNECTING TO AGENT...</div>;

  const getStatusColor = (status) => {
    if (status === "Illegal Logging") return "text-[#ff4b4b] bg-[rgba(255,75,75,0.1)] border-[#ff4b4b]";
    if (status === "Needs Review") return "text-[#ffb84d] bg-[rgba(255,184,77,0.1)] border-[#ffb84d]";
    return "text-[#00ff9d] bg-[rgba(0,255,157,0.1)] border-[#00ff9d]";
  };

  const getIconForStatus = (alert) => {
    if (selectedAlert?.id === alert.id) return selectedIcon;
    if (alert.status === "Illegal Logging") return alertIcon;
    return defaultIcon;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] p-4 md:p-8 font-sans relative">

      {/* NEW: Global Notification Banner */}
      {notification && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-[rgba(0,255,157,0.1)] border border-[#00ff9d] text-[#00ff9d] px-6 py-3 rounded-sm font-mono text-sm z-[9999] shadow-[0_0_15px_rgba(0,255,157,0.3)] flex items-center gap-3 backdrop-blur-sm transition-all duration-300">
          <Activity size={18} className="animate-pulse" />
          {notification}
        </div>
      )}

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-[#222] pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Crosshair className="text-[#00ff9d]" /> CanopyWatch
          </h1>
          <p className="text-[#888] mt-1 text-sm font-mono tracking-widest">AUTONOMOUS LEGAL VERIFICATION AGENT</p>
        </div>

        {/* NEW: Scan Controls Area */}
        <div className="flex items-end gap-4 bg-[#111] p-3 rounded-sm border border-[#222]">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#888] font-mono uppercase tracking-wider">Target Region</label>
            <select
              value={scanRegion}
              onChange={(e) => setScanRegion(e.target.value)}
              className="bg-[#0a0a0a] border border-[#333] text-[#e0e0e0] font-mono text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-[#00ff9d] cursor-pointer appearance-none min-w-[180px]"
            >
              <option value="brazil">Brazil (Amazon)</option>
              <option value="indonesia" disabled className="text-gray-600 bg-[#0a0a0a]">
                Indonesia (Borneo) — Coming Soon
              </option>
              <option value="drc" disabled className="text-gray-600 bg-[#0a0a0a]">
                DR Congo Basin — Coming Soon
              </option>
            </select>
          </div>

          <button
            onClick={handleInitiateScan}
            className="bg-[rgba(0,255,157,0.1)] border border-[#00ff9d] text-[#00ff9d] hover:bg-[#00ff9d] hover:text-black font-mono font-bold text-sm px-6 py-2 rounded-sm transition-all flex items-center gap-2 h-[38px]"
          >
            <Zap size={16} />
            SCAN
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[350px,1fr] gap-6">
        {/* SIDEBAR */}
        <div className="space-y-6">
          <div className="bg-[#111] border border-[#222] rounded-sm overflow-hidden flex flex-col h-[600px]">
            <div className="p-4 border-b border-[#222] bg-[#0a0a0a]">
              <h3 className="font-mono text-xs text-[#888] uppercase tracking-widest flex items-center gap-2"><Database size={14}/> Investigation Queue</h3>
            </div>
            <div className="overflow-y-auto p-2 space-y-2">
              {alerts.length === 0 ? (
                <div className="p-4 text-center font-mono text-xs text-[#666]">NO SCANS IN QUEUE</div>
              ) : (
                alerts.map(alert => (
                  <div key={alert.id} onClick={() => setSelectedAlert(alert)}
                    className={`p-3 rounded-sm border-l-2 cursor-pointer transition-colors ${selectedAlert?.id === alert.id ? "bg-[#1a1a1a] border-[#00ff9d]" : "border-[#222] hover:bg-[#111]"}`}>
                    <h3 className="font-bold text-white text-sm">{alert.id}</h3>
                    <span className={`text-[9px] uppercase px-2 py-0.5 rounded-sm font-bold border ${getStatusColor(alert.status)}`}>{alert.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* MAIN PANEL */}
        {selectedAlert ? (
          <div className="bg-[#111] border border-[#222] rounded-sm h-[600px] flex flex-col">
            <div className="p-6 border-b border-[#222] flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">TARGET: {selectedAlert.id}</h2>
              <span className="font-mono text-sm text-[#888]">LAT: {selectedAlert.lat?.toFixed(4)} | LON: {selectedAlert.lon?.toFixed(4)}</span>
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
            <div className="p-6 flex-1 overflow-y-auto relative z-0">

              {activeTab === 'map' && (
                <div className="absolute inset-4 bg-[#1a1a1a] rounded border border-[#333] overflow-hidden">
                  <MapContainer
                    center={[selectedAlert.lat || 0, selectedAlert.lon || 0]}
                    zoom={14}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                  >
                    <TileLayer
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                    />

                    {selectedAlert.lat && selectedAlert.lon && (
                      <MapUpdater lat={selectedAlert.lat} lon={selectedAlert.lon} />
                    )}

                    {alerts.map(alert => (
                      <Marker
                        key={alert.id}
                        position={[alert.lat, alert.lon]}
                        icon={getIconForStatus(alert)}
                        eventHandlers={{ click: () => setSelectedAlert(alert) }}
                      >
                        <Popup className="font-mono text-xs text-black">
                          <strong>{alert.id}</strong><br/>
                          Status: {alert.status}
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              )}

              {activeTab === 'agent' && (
                <div className="space-y-4">
                  {selectedAlert.cot?.length > 0 ? (
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
                    {selectedAlert.images?.before ? (
                      <img src={selectedAlert.images.before} alt="Before" className="rounded border border-[#333] object-cover h-full w-full" />
                    ) : (
                      <div className="flex-1 border border-[#333] border-dashed flex items-center justify-center text-[#666] font-mono text-xs">NO IMAGE</div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-mono text-xs text-[#888] mb-2 uppercase">After Scan</span>
                    {selectedAlert.images?.after ? (
                      <img src={selectedAlert.images.after} alt="After" className="rounded border border-[#333] object-cover h-full w-full" />
                    ) : (
                      <div className="flex-1 border border-[#333] border-dashed flex items-center justify-center text-[#666] font-mono text-xs">NO IMAGE</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-[#111] border border-[#222] rounded-sm h-[600px] flex items-center justify-center text-[#666] font-mono">
            SELECT A TARGET OR INITIATE A SCAN
          </div>
        )}
      </div>
    </div>
  );
}