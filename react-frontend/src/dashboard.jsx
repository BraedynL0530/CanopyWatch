import React, { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, Clock, ShieldAlert, MapPin, Calendar, Activity, Database } from "lucide-react";
import "./index.css";

export default function App() {
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [loading, setLoading] = useState(true);

  // Simulated fetch from your backend
  useEffect(() => {
    const fetchData = async () => {
      // Mock data representing the pipeline results
      const mockAlerts = [
        { id: 1, lat: -10.02, lon: -62.01, date: "2023-07-15", confidence: 0.98, status: "Illegal Logging (Presumed)", reason: "No active permits found for coordinates.", ndviDrop: 0.32 },
        { id: 2, lat: -10.15, lon: -62.40, date: "2023-08-01", confidence: 0.85, status: "Needs Permit", reason: "Permit expired 2 days before event.", ndviDrop: 0.28 },
        { id: 3, lat: -9.98, lon: -61.95, date: "2023-08-12", confidence: 0.92, status: "Legal", reason: "Active permit verified via Sinaflor.", ndviDrop: 0.26 },
      ];
      setAlerts(mockAlerts);
      setSelectedAlert(mockAlerts[0]);
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#0d1117] text-white">Loading System Data...</div>;

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#f0f6fc] p-8 font-sans">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">CanopyWatch Dashboard</h1>
          <p className="text-[#8b949e]">Real-time Deforestation Legal Verification</p>
        </div>
        <div className="bg-[rgba(63,185,80,0.12)] border border-[rgba(126,231,135,0.4)] text-[#7ee787] px-6 py-2 rounded-full">
          System Operational
        </div>
      </header>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Active Alerts", val: alerts.length, icon: AlertTriangle },
          { label: "Legal Cases", val: alerts.filter(a => a.status === "Legal").length, icon: CheckCircle },
          { label: "Avg Confidence", val: "92%", icon: Activity },
          { label: "Permits Scanned", val: "1,240", icon: Database },
        ].map((stat, i) => (
          <div key={i} className="bg-[#161b22] border border-[#30363d] p-5 rounded-xl">
            <span className="flex items-center gap-2 text-[#8b949e] text-sm"><stat.icon size={16} />{stat.label}</span>
            <h2 className="text-3xl font-bold mt-2">{stat.val}</h2>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[360px,1fr] gap-6">
        <div className="space-y-4">
          {alerts.map(alert => (
            <div
              key={alert.id}
              onClick={() => setSelectedAlert(alert)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedAlert?.id === alert.id ? "bg-[#161b22] border-[#7ee787]" : "bg-[#161b22] border-[#30363d] hover:border-[#7ee787]"}`}
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">Case #{alert.id}</h3>
                <span className={`text-[10px] uppercase px-2 py-1 rounded-full ${alert.confidence > 0.9 ? "bg-[rgba(248,81,73,0.18)] text-[#ff938d]" : "bg-[rgba(210,153,34,0.15)] text-[#e3b341]"}`}>
                  {alert.confidence > 0.9 ? "High Risk" : "Review"}
                </span>
              </div>
              <p className="text-xs text-[#8b949e]">{alert.lat}, {alert.lon} • {alert.date}</p>
            </div>
          ))}
        </div>

        <div className="bg-[#161b22] border border-[#30363d] p-8 rounded-2xl">
          <h2 className="text-2xl font-bold mb-6">Case Analysis: #{selectedAlert.id}</h2>
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-[#0d1117] p-4 rounded-lg border border-[#30363d]"><span className="text-xs text-[#8b949e]">Coordinates</span><p className="font-mono">{selectedAlert.lat}, {selectedAlert.lon}</p></div>
            <div className="bg-[#0d1117] p-4 rounded-lg border border-[#30363d]"><span className="text-xs text-[#8b949e]">Event Date</span><p>{selectedAlert.date}</p></div>
            <div className="bg-[#0d1117] p-4 rounded-lg border border-[#30363d]"><span className="text-xs text-[#8b949e]">NDVI Delta</span><p>{selectedAlert.ndviDrop}</p></div>
            <div className="bg-[#0d1117] p-4 rounded-lg border border-[#30363d]"><span className="text-xs text-[#8b949e]">Verdict</span><p className="text-[#7ee787]">{selectedAlert.status}</p></div>
          </div>
          <div className="bg-[rgba(13,17,23,0.5)] p-6 rounded-lg border border-[#30363d]">
            <h4 className="flex items-center gap-2 mb-3 text-sm font-semibold"><ShieldAlert size={16} /> Legal Reasoning</h4>
            <p className="text-[#c9d1d9] leading-relaxed italic">"{selectedAlert.reason}"</p>
          </div>
        </div>
      </div>
    </div>
  );
}