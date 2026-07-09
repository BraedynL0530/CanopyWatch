import { useEffect, useState } from "react";
import { satelliteData } from "./api"; // Probally gonna switch to raw fast api endpoint
import "../css/SatelliteDashboard.css";

export default function SatelliteDashboard() {
    const [cases, setCases] = useState([]);
    const [selectedCase, setSelectedCase] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCases();
    }, []);

    async function loadCases() {
        try {
            /*
             ==========================================================
             JSON/API SECTION
             ==========================================================

             Expected API:

             GET /api/satellite-data/

             Example response:

             [
               {
                  id: 1,
                  location: "...",
                  country: "...",
                  latitude: 0,
                  longitude: 0,

                  risk: "HIGH",

                  confidence: 97,

                  permit_status: "NONE",

                  protected_area: true,

                  hectares_lost: 4.2,

                  date: "2026-07-08",

                  before_image: "...",

                  after_image: "...",

                  overlay_image: "...",

                  agent_analysis: "...",

                  model: "U-Net",

                  satellite: "Sentinel-2",

                  cloud_cover: 3.1
               }
             ]

             Shape this however you want later.

             */

            const response = await satelliteData();

            // If using axios:
            const data = response.data;

            // If using fetch:
            // const data = await response.json();

            setCases(data);

            if (data.length > 0) {
                setSelectedCase(data[0]);
            }

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="sat-dashboard loading">
                Loading satellite data...
            </div>
        );
    }

    return (
        <div className="sat-dashboard">

            {/* =======================
               HEADER
            ======================== */}

            <header className="dashboard-header">
                <div>
                    <h1>CanopyGuard AI</h1>
                    <p>Satellite Deforestation Intelligence</p>
                </div>

                <div className="header-status">
                    Live
                </div>
            </header>

            {/* =======================
               STATS
               JSON SECTION
            ======================== */}

            <div className="stats-grid">

                <div className="stat-card">
                    <span>Cases</span>

                    {/* Replace with API value later */}
                    <h2>{cases.length}</h2>
                </div>

                <div className="stat-card">
                    <span>High Risk</span>

                    {/* Change risk values however you'd like */}
                    <h2>
                        {
                            cases.filter(c => c.risk === "HIGH").length
                        }
                    </h2>
                </div>

                <div className="stat-card">
                    <span>Protected Areas</span>

                    <h2>
                        {
                            cases.filter(c => c.protected_area).length
                        }
                    </h2>
                </div>

                <div className="stat-card">
                    <span>Avg Confidence</span>

                    <h2>
                        {cases.length
                            ? Math.round(
                                cases.reduce(
                                    (a, b) => a + b.confidence,
                                    0
                                ) / cases.length
                            )
                            : 0}
                        %
                    </h2>
                </div>

            </div>

            <div className="dashboard-body">

                {/* =======================
                    LEFT SIDE
                    CASE LIST
                ======================== */}

                <div className="case-list">

                    {cases.map((item) => (

                        <div
                            key={item.id}
                            className={
                                selectedCase?.id === item.id
                                    ? "case-card active"
                                    : "case-card"
                            }
                            onClick={() => setSelectedCase(item)}
                        >

                            {/* JSON */}

                            <div className="case-title">

                                <h3>{item.location}</h3>

                                <span className={`risk ${item.risk.toLowerCase()}`}>
                                    {item.risk}
                                </span>

                            </div>

                            <p>{item.country}</p>

                            <small>{item.date}</small>

                        </div>

                    ))}

                </div>

                {/* =======================
                    DETAILS PANEL
                ======================== */}

                <div className="details">

                    {selectedCase && (

                        <>

                            <h2>{selectedCase.location}</h2>

                            <p>{selectedCase.country}</p>

                            {/* =======================
                                METADATA
                                JSON
                            ======================== */}

                            <div className="metadata">

                                <div>

                                    <span>Permit</span>

                                    <strong>
                                        {selectedCase.permit_status}
                                    </strong>

                                </div>

                                <div>

                                    <span>Protected</span>

                                    <strong>
                                        {selectedCase.protected_area
                                            ? "YES"
                                            : "NO"}
                                    </strong>

                                </div>

                                <div>

                                    <span>Confidence</span>

                                    <strong>
                                        {selectedCase.confidence}%
                                    </strong>

                                </div>

                                <div>

                                    <span>Area Lost</span>

                                    <strong>
                                        {selectedCase.hectares_lost} ha
                                    </strong>

                                </div>

                            </div>

                            {/* =======================
                               AGENT OUTPUT
                               JSON
                            ======================== */}

                            <div className="analysis">

                                <h3>Agent Analysis</h3>

                                <p>
                                    {selectedCase.agent_analysis}
                                </p>

                            </div>

                            {/* =======================
                               SATELLITE IMAGES
                               JSON
                            ======================== */}

                            <div className="images">

                                <div>

                                    <h4>Before</h4>

                                    <img
                                        src={selectedCase.before_image}
                                        alt=""
                                    />

                                </div>

                                <div>

                                    <h4>After</h4>

                                    <img
                                        src={selectedCase.after_image}
                                        alt=""
                                    />

                                </div>

                                <div>

                                    <h4>Difference</h4>

                                    <img
                                        src={selectedCase.overlay_image}
                                        alt=""
                                    />

                                </div>

                            </div>

                            {/* =======================
                               EXTRA DATA
                               JSON
                            ======================== */}

                            <div className="extra">

                                <div>
                                    <span>Model</span>
                                    <strong>{selectedCase.model}</strong>
                                </div>

                                <div>
                                    <span>Satellite</span>
                                    <strong>{selectedCase.satellite}</strong>
                                </div>

                                <div>
                                    <span>Cloud Cover</span>
                                    <strong>{selectedCase.cloud_cover}%</strong>
                                </div>

                                <div>
                                    <span>Coordinates</span>
                                    <strong>
                                        {selectedCase.latitude},
                                        {" "}
                                        {selectedCase.longitude}
                                    </strong>
                                </div>

                            </div>

                        </>

                    )}

                </div>

            </div>

        </div>
    );
}