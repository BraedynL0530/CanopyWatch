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

// Updated map icons to fit the new palette
const defaultIcon = createCustomIcon('#728276');
const selectedIcon = createCustomIcon('#00ff9d'); // Kept neon for active target visibility
const alertIcon = createCustomIcon('#ff4b4b'); // Neon red

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
          damage_percentage: scan.damage_percentage,
          status: scan.status,
          reason: scan.reason,
          ndviDrop: scan.ndvi_drop,
          cot: scan.reasoning || [],
          images: {
            before: scan.before_url,
            after: scan.after_url,
            mask: scan.mask_url
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

  const handleInitiateScan = () => {
    setNotification(`Queuing scan for region: ${scanRegion.toUpperCase()} - This may take a few days.`);
    setTimeout(() => setNotification(''), 3000);
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#0B0F0C] text-[#3A5A43] font-mono text-xl animate-pulse tracking-widest">CONNECTING TO AGENT...</div>;

  // Status colors kept neon as requested
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
    // Changed to h-screen flex-col to force the layout to fill the screen and remove bottom space
    <div className="h-screen flex flex-col bg-[#0B0F0C] text-[#E0E6E2] p-4 md:p-6 font-sans relative overflow-hidden">

      {notification && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-[#131B15] border border-[#3A5A43] text-[#E0E6E2] px-6 py-3 rounded-md font-mono text-sm z-[9999] shadow-[0_4px_20px_rgba(11,15,12,0.8)] flex items-center gap-3 backdrop-blur-md transition-all duration-300">
          <Activity size={18} className="animate-pulse text-[#4ADE80]" />
          {notification}
        </div>
      )}

      {/* Header section */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-[#2C3D30] pb-4 shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold text-[#F0F4F1] tracking-tight flex items-center gap-3">
            <Crosshair className="text-[#5B8A62]" /> CanopyWatch
          </h1>
          <p className="text-[#8B9C90] mt-1 text-sm font-mono tracking-widest">AUTONOMOUS LEGAL VERIFICATION AGENT</p>
        </div>

        <div className="flex items-end gap-4 bg-[#131B15] p-3 rounded-lg border border-[#2C3D30] shadow-sm">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#728276] font-mono uppercase tracking-wider">Target Region</label>
            <select
              value={scanRegion}
              onChange={(e) => setScanRegion(e.target.value)}
              className="bg-[#0B0F0C] border border-[#2C3D30] text-[#E0E6E2] font-mono text-sm px-3 py-2 rounded focus:outline-none focus:border-[#5B8A62] cursor-pointer appearance-none min-w-[180px] hover:border-[#3A5A43] transition-colors"
            >
              <option value="brazil" className="bg-[#0B0F0C]">Brazil (Amazon)</option>
              <option value="indonesia" disabled className="text-[#56665B] bg-[#0B0F0C]">
                Indonesia (Borneo) — Coming Soon
              </option>
              <option value="drc" disabled className="text-[#56665B] bg-[#0B0F0C]">
                DR Congo Basin — Coming Soon
              </option>
            </select>
          </div>

          <button
            onClick={handleInitiateScan}
            className="bg-[#243628] border border-[#3A5A43] text-[#E0E6E2] hover:bg-[#3A5A43] hover:text-white font-mono font-bold text-sm px-6 py-2 rounded transition-all flex items-center gap-2 h-[38px] shadow-sm"
          >
            <Zap size={16} />
            SCAN
          </button>
        </div>
      </header>

      {/* Main Grid - flex-1 min-h-0 allows it to stretch and scroll internally without breaking screen bounds */}
      <div className="grid grid-cols-1 lg:grid-cols-[350px,1fr] gap-6 flex-1 min-h-0">

        {/* SIDEBAR */}
        <div className="bg-[#131B15] border border-[#2C3D30] rounded-xl overflow-hidden flex flex-col h-full shadow-lg">
          <div className="p-4 border-b border-[#2C3D30] bg-[#1A241C]">
            <h3 className="font-mono text-xs text-[#8B9C90] uppercase tracking-widest flex items-center gap-2"><Database size={14}/> Investigation Queue</h3>
          </div>
          <div className="overflow-y-auto p-3 space-y-2 flex-1 scrollbar-thin scrollbar-thumb-[#2C3D30] scrollbar-track-transparent">
            {alerts.length === 0 ? (
              <div className="p-4 text-center font-mono text-xs text-[#728276]">NO SCANS IN QUEUE</div>
            ) : (
              alerts.map(alert => (
                <div key={alert.id} onClick={() => setSelectedAlert(alert)}
                  className={`p-3 rounded-lg border-l-4 cursor-pointer transition-all duration-200 ${selectedAlert?.id === alert.id ? "bg-[#1E2C22] border-[#5B8A62] shadow-sm" : "border-transparent border-l-[#2C3D30] hover:bg-[#1A241C]"}`}>
                  <h3 className="font-bold text-[#F0F4F1] text-sm mb-2">{alert.id}</h3>
                  <span className={`text-[10px] uppercase px-2 py-1 rounded font-bold border ${getStatusColor(alert.status)}`}>{alert.status}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* MAIN PANEL */}
        {selectedAlert ? (
          <div className="bg-[#131B15] border border-[#2C3D30] rounded-xl flex flex-col h-full shadow-lg overflow-hidden">
            <div className="p-5 border-b border-[#2C3D30] bg-[#1A241C] flex flex-wrap justify-between items-center gap-4 shrink-0">
              <h2 className="text-xl md:text-2xl font-bold text-[#F0F4F1]">TARGET: {selectedAlert.id}</h2>
              <div className="flex items-center gap-4">
                {selectedAlert.damage_percentage != null && (
                  <span className="font-mono text-sm font-bold text-[#ff4b4b] bg-[#ff4b4b]/10 px-3 py-1 rounded border border-[#ff4b4b]/30">
                    DAMAGE: {selectedAlert.damage_percentage}%
                  </span>
                )}
                <span className="font-mono text-sm text-[#8B9C90] bg-[#0B0F0C] px-3 py-1 rounded border border-[#2C3D30]">
                  <MapPin size={12} className="inline mr-1 mb-1"/>
                  {selectedAlert.lat?.toFixed(4)} | {selectedAlert.lon?.toFixed(4)}
                </span>
              </div>
            </div>

            {/* TABS */}
            <div className="flex border-b border-[#2C3D30] bg-[#0B0F0C] shrink-0">
              {['map', 'agent', 'imagery'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-3 text-sm font-mono uppercase transition-all duration-200 ${activeTab === tab ? "border-b-2 border-[#5B8A62] text-[#F0F4F1] bg-[#131B15]" : "text-[#728276] hover:text-[#E0E6E2] hover:bg-[#131B15]/50 border-b-2 border-transparent"}`}>
                  {tab}
                </button>
              ))}
            </div>

            {/* TAB CONTENT */}
            <div className="p-6 flex-1 overflow-y-auto relative z-0">

              {activeTab === 'map' && (
                <div className="absolute inset-5 bg-[#0B0F0C] rounded-lg border border-[#2C3D30] overflow-hidden shadow-inner">
                  <MapContainer
                    center={[selectedAlert.lat || 0, selectedAlert.lon || 0]}
                    zoom={14}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                  >
                    <TileLayer
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      attribution='&copy; Esri'
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
                        <Popup className="font-mono text-xs font-bold text-black">
                          {alert.id}<br/>
                          <span className="font-normal">{alert.status}</span>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              )}

              {activeTab === 'agent' && (
                <div className="space-y-4 max-w-4xl">
                  <div className="text-xs font-mono leading-relaxed text-[#ffb84d] bg-[#332512] border border-[#664923] rounded p-4 shadow-sm">
                    <ShieldAlert size={16} className="inline mr-2 mb-1"/>
                    Permit status reflects IBAMA's ASV (vegetation suppression authorization) registry only — other permit types are not currently checked, and "No records found" means no matching ASV permit was found nearby, not that logging is confirmed illegal.
                  </div>
                  {selectedAlert.ndviDrop != null && (
                    <div className="inline-block font-mono text-xs text-[#E0E6E2] bg-[#1A241C] px-3 py-1.5 rounded border border-[#2C3D30]">
                      NDVI Drop Detected: <span className="text-[#ff4b4b] font-bold">{selectedAlert.ndviDrop}</span>
                    </div>
                  )}
                  <div className="bg-[#0B0F0C] rounded-lg border border-[#2C3D30] p-5 space-y-3 mt-4">
                    <h4 className="font-mono text-xs text-[#728276] uppercase tracking-widest mb-4 border-b border-[#2C3D30] pb-2">Agent Reasoning Log</h4>
                    {selectedAlert.cot?.length > 0 ? (
                      selectedAlert.cot.map((log, idx) => (
                        <p key={idx} className="font-mono text-sm text-[#B3C4B8] border-l-2 border-[#5B8A62] pl-4 py-1 bg-[#131B15]/50 rounded-r">
                          {log}
                        </p>
                      ))
                    ) : (
                      <p className="font-mono text-sm text-[#728276] italic">No agent reasoning logs available for this scan.</p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'imagery' && (
                <div className="flex flex-col h-full gap-4">
                  <div className="text-xs font-mono text-[#8B9C90] bg-[#1A241C] border border-[#2C3D30] rounded p-3 shrink-0">
                    Images are contrast-stretched for visibility. The model analyzes raw multispectral reflectance (including near-infrared), which is more sensitive to vegetation change than what's visible here. Highlighted overlays show flagged change pixels.
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
                    <div className="flex flex-col gap-2 h-full">
                      <span className="font-mono text-xs text-[#8B9C90] uppercase tracking-wider flex items-center gap-2">
                        <ImageIcon size={14}/> Before Scan
                      </span>
                      {selectedAlert.images?.before ? (
                        <div className="flex-1 rounded-lg border border-[#2C3D30] overflow-hidden shadow-inner bg-[#0B0F0C]">
                          <img src={selectedAlert.images.before} alt="Before" className="object-cover h-full w-full" />
                        </div>
                      ) : (
                        // Earthy/Bark contrast for empty states
                        <div className="flex-1 rounded-lg border-2 border-dashed border-[#3D332B] bg-[#1C1814] flex flex-col items-center justify-center text-[#8C7662] font-mono text-xs">
                          <ImageIcon size={24} className="mb-2 opacity-50"/>
                          NO IMAGE DATA
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 h-full">
                      <span className="font-mono text-xs text-[#8B9C90] uppercase tracking-wider flex items-center gap-2">
                        <ImageIcon size={14}/> After Scan (Analysis Overlay)
                      </span>
                      {selectedAlert.images?.after ? (
                        <div className="relative flex-1 rounded-lg border border-[#2C3D30] overflow-hidden shadow-inner bg-[#0B0F0C]">
                          <img src={selectedAlert.images.after} alt="After" className="object-cover h-full w-full" />
                          {selectedAlert.images?.mask && (
                            <img src={selectedAlert.images.mask} alt="Deforestation mask" className="absolute inset-0 object-cover h-full w-full pointer-events-none opacity-80" />
                          )}
                        </div>
                      ) : (
                         <div className="flex-1 rounded-lg border-2 border-dashed border-[#3D332B] bg-[#1C1814] flex flex-col items-center justify-center text-[#8C7662] font-mono text-xs">
                          <ImageIcon size={24} className="mb-2 opacity-50"/>
                          NO IMAGE DATA
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-[#131B15] border border-[#2C3D30] rounded-xl flex items-center justify-center text-[#56665B] font-mono shadow-lg flex-col gap-4">
            <Crosshair size={48} className="opacity-20" />
            SELECT A TARGET FROM QUEUE OR INITIATE SCAN
          </div>
        )}
      </div>
    </div>
  );
}