import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import AuthPage from "./AuthPage";
import { apiFetch } from "./api";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./App.css";

import {
    requestNotificationPermission,
    listenForForegroundNotifications,
    registerFCMTokenWithBackend
} from "./notificationService";

window.getAcciSafeToken = async () => {
    if (!auth.currentUser) {
        console.log("No user is currently signed in.");
        return;
    }

    const token = await auth.currentUser.getIdToken(true);

    console.log("ACCI_SAFE_TOKEN:");
    console.log(token);

    return token;
};

const API_URL = "http://127.0.0.1:8000";

const getAccidentStatusLabel = (status) => {
  switch (status) {
    case "ACCIDENT_CONFIRMED":
      return "Confirmed";

    case "EMERGENCY_ACTIVE":
      return "Emergency Active";

    case "CANCELLED":
      return "Cancelled";

    case "FALSE_ALARM":
      return "False Alarm";

    default:
      return status || "Unknown";
  }
};

const getAccidentStatusClass = (status) => {
  switch (status) {
    case "ACCIDENT_CONFIRMED":
      return "confirmed";

    case "EMERGENCY_ACTIVE":
      return "emergency";

    case "CANCELLED":
      return "cancelled";

    case "FALSE_ALARM":
      return "false-alarm";

    default:
      return "unknown";
  }
};

const markerIcon = new L.Icon({
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function LiveSafetyPage({
  sensor,
  detection,
  status,
  isNormal,
  isObserving,
  isConfirmed,
  isCancellationWindow,
  isEmergencyActive,
}) {
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">LIVE MONITORING</p>
          <h2>Live Safety</h2>
        </div>

        <div className="topbar-actions">
          <div className="online-pill">
            <span></span>
            System Online
          </div>
        </div>
      </header>

      <section
        className={`live-status-banner ${
          isNormal
            ? "status-safe"
            : isObserving
            ? "status-warning"
            : isConfirmed ||
              isCancellationWindow ||
              isEmergencyActive
            ? "status-danger"
            : ""
        }`}
      >
        <div className="live-status-icon">
          {isNormal && "✓"}
          {isObserving && "!"}
          {(isConfirmed ||
            isCancellationWindow ||
            isEmergencyActive) &&
            "!"}
          {!sensor && "?"}
        </div>

        <div className="live-status-text">
          <p className="eyebrow">CURRENT SAFETY STATUS</p>

          <h3>
            {isNormal && "SAFE — Monitoring Active"}
            {isObserving &&
              "POSSIBLE ACCIDENT — Verification in Progress"}
            {isConfirmed &&
              "ACCIDENT CONFIRMED — Cancellation Window"}
            {isCancellationWindow &&
              "ACCIDENT CONFIRMED — Waiting for Rider"}
            {isEmergencyActive &&
              "EMERGENCY RESPONSE ACTIVE"}
            {!sensor && "Waiting for sensor data"}
          </h3>

          <p>
            {detection?.message ||
              "Waiting for sensor data."}
          </p>
        </div>

        <div className="stage-indicator">
          {sensor
            ? `STAGE ${detection?.stage || 1} / 5`
            : "WAITING"}
        </div>
      </section>

      <section className="dashboard-grid">

        <div className="card metric-card">
          <div className="card-header">
            <span>Speed</span>
            <span className="metric-icon">🏍</span>
          </div>

          <div className="metric-value">
            {sensor
              ? `${sensor.speed_after} km/h`
              : "—"}
          </div>

          <p className="muted">
            Current motorcycle speed
          </p>
        </div>

        <div className="card metric-card">
          <div className="card-header">
            <span>Acceleration</span>
            <span className="metric-icon">⚡</span>
          </div>

          <div className="metric-value">
            {sensor
              ? `${sensor.acceleration} g`
              : "—"}
          </div>

          <p className="muted">
            Current acceleration
          </p>
        </div>

        <div className="card metric-card">
          <div className="card-header">
            <span>Tilt Angle</span>
            <span className="metric-icon">◢</span>
          </div>

          <div className="metric-value">
            {sensor
              ? `${sensor.tilt_angle}°`
              : "—"}
          </div>

          <p className="muted">
            Current motorcycle tilt
          </p>
        </div>

      </section>

      <section className="card verification-card">

        <div className="section-header">
          <div>
            <p className="eyebrow">
              ACCIDENT DETECTION ENGINE
            </p>

            <h3>
              Five-Stage Verification
            </h3>
          </div>

          <span className="stage-indicator-small">
            {sensor
              ? `Stage ${detection?.stage || 1} / 5`
              : "Waiting"}
          </span>
        </div>

        <div className="verification-grid">

          <VerificationStage
            number="1"
            title="Impact Detection"
            active={detection?.checks?.impact_detected}
            currentStage={detection?.stage === 1}
          />

          <VerificationStage
            number="2"
            title="Speed Verification"
            active={detection?.checks?.speed_verified}
            currentStage={detection?.stage === 2}
          />

          <VerificationStage
            number="3"
            title="Sudden Stop Analysis"
            active={detection?.checks?.sudden_stop}
            currentStage={detection?.stage === 3}
          />

          <VerificationStage
            number="4"
            title="Tilt Analysis"
            active={detection?.checks?.significant_tilt}
            currentStage={detection?.stage === 4}
          />

          <VerificationStage
            number="5"
            title="Observation Period"
            active={detection?.checks?.observation_complete}
            currentStage={detection?.stage === 5}
          />

        </div>

      </section>
    </>
  );
}

// =========================================================
// ACCIDENT HISTORY PAGE
// =========================================================

function AccidentHistoryPage({
  accidents,
  loading,
  error,
}) {
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">
            SAFETY RECORDS
          </p>

          <h2>
            Accident History
          </h2>
        </div>

        <div className="online-pill">
          <span></span>
          System Online
        </div>
      </header>

      {error && (
        <div className="error-state">
          {error}
        </div>
      )}

      <section className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">
              INCIDENT LOG
            </p>

            <h3>
              Recorded Safety Events
            </h3>
          </div>

          <div className="contact-stat">
            <strong>
              {accidents.length}
            </strong>

            <span>
              Events
            </span>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            Loading accident history...
          </div>
        ) : accidents.length === 0 ? (
          <div className="empty-state">
            No accident events have been recorded.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Date & Time</th>
                  <th>Impact</th>
                  <th>Speed</th>
                  <th>Tilt</th>
                  <th>Location</th>
                </tr>
              </thead>

              <tbody>
                {accidents.map((accident) => (
                  <tr key={accident.id}>
                    <td>
                      <span className="incident-id">
                        #{accident.id}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`status-badge ${
                          accident.status ===
                          "CANCELLED"
                            ? "cancelled"
                            : accident.status ===
                              "FALSE_ALARM"
                            ? "false-alarm"
                            : accident.status ===
                              "EMERGENCY_ACTIVE"
                            ? "emergency"
                            : "confirmed"
                        }`}
                      >
                        <span></span>

                        {accident.status ===
                        "CANCELLED"
                          ? "Cancelled"
                          : accident.status ===
                            "FALSE_ALARM"
                          ? "False Alarm"
                          : accident.status ===
                            "EMERGENCY_ACTIVE"
                          ? "Emergency Active"
                          : accident.status ===
                            "ACCIDENT_CONFIRMED"
                          ? "Confirmed"
                          : accident.status ||
                            "Unknown"}
                      </span>
                    </td>

                    <td>
                      {accident.timestamp
                        ? new Date(
                            accident.timestamp
                          ).toLocaleString()
                        : "—"}
                    </td>

                    <td>
                      {accident.acceleration ?? "—"} g
                    </td>

                    <td>
                      {accident.speed_before ?? "—"} km/h
                    </td>

                    <td>
                      {accident.tilt_angle ?? "—"}°
                    </td>

                    <td>
                      {accident.latitude != null &&
                      accident.longitude != null
                        ? `${Number(
                            accident.latitude
                          ).toFixed(4)}, ${Number(
                            accident.longitude
                          ).toFixed(4)}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

// =========================================================
// HOSPITALS PAGE
// =========================================================

function HospitalsPage({
  hospitals,
  hospitalsLoading,
  hospitalError,
  hospitalLocation,
  onRefresh,
}) {
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">
            EMERGENCY RESPONSE
          </p>

          <h2>
            Nearby Hospitals
          </h2>
        </div>

        <button
          className="refresh-button"
          onClick={onRefresh}
          disabled={hospitalsLoading}
        >
          {hospitalsLoading
            ? "Finding..."
            : "↻ Find Nearby"}
        </button>
      </header>

      <section className="hospital-location-banner">
        <div className="hospital-location-icon">
          🏥
        </div>

        <div>
          <p className="eyebrow">
            SEARCH LOCATION
          </p>

          <h3>
            {hospitalLocation
              ? `${Number(
                  hospitalLocation.latitude
                ).toFixed(5)}, ${Number(
                  hospitalLocation.longitude
                ).toFixed(5)}`
              : "Waiting for GPS location"}
          </h3>

          <p>
            {hospitalLocation
              ? "Hospitals are searched within 5 km of the latest available AcciSafe location."
              : "Send live GPS data or record an accident to enable hospital lookup."}
          </p>
        </div>
      </section>

      {hospitalError && (
        <div className="error-state hospital-error">
          {hospitalError}
        </div>
      )}

      {hospitalsLoading ? (
        <section className="card">
          <div className="empty-state">
            Searching OpenStreetMap for nearby
            hospitals...
          </div>
        </section>
      ) : hospitals.length === 0 ? (
        <section className="card">
          <div className="empty-state">
            No nearby hospitals found for the
            available location.
          </div>
        </section>
      ) : (
        <section className="hospital-grid">
          {hospitals.map(
            (hospital, index) => (
              <article
                className="card hospital-card"
                key={`${hospital.name}-${hospital.latitude}-${hospital.longitude}`}
              >
                <div className="hospital-card-top">
                  <div className="hospital-rank">
                    {index + 1}
                  </div>

                  <div>
                    <h3>
                      {hospital.name}
                    </h3>

                    <span className="hospital-distance">
                      {hospital.distance_km} km away
                    </span>
                  </div>
                </div>

                <p className="hospital-address">
                  {hospital.address ||
                    "Address unavailable"}
                </p>

                {hospital.phone && (
                  <p className="hospital-detail">
                    ☎ {hospital.phone}
                  </p>
                )}

                {hospital.emergency && (
                  <span className="hospital-emergency-badge">
                    Emergency service listed
                  </span>
                )}

                {hospital.maps_url && (
                  <a
                    className="hospital-map-button"
                    href={hospital.maps_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Google Maps ↗
                  </a>
                )}
              </article>
            )
          )}
        </section>
      )}
    </>
  );
}

// =========================================================
// SETTINGS PAGE
// =========================================================

function SettingsPage({ sensorConfig, onRefresh, onReset, resetting }) {
  const items = sensorConfig
    ? [
        {
          icon: "⚡",
          label: "Impact threshold",
          value: `${sensorConfig.impact_threshold_g} g`,
          description: "Acceleration required to trigger impact detection",
        },
        {
          icon: "🏍",
          label: "Minimum speed",
          value: `${sensorConfig.minimum_speed_threshold_kmh} km/h`,
          description: "Minimum vehicle speed required before an impact is considered",
        },
        {
          icon: "↘",
          label: "Sudden stop threshold",
          value: `${sensorConfig.speed_drop_threshold_kmh} km/h`,
          description: "Minimum speed reduction used for sudden-stop verification",
        },
        {
          icon: "↳",
          label: "Tilt threshold",
          value: `${sensorConfig.tilt_threshold_degrees}°`,
          description: "Tilt angle used during accident verification",
        },
        {
          icon: "◷",
          label: "Observation period",
          value: `${sensorConfig.observation_period_seconds} seconds`,
          description: "Time used to determine whether the rider resumes normal movement",
        },
        {
          icon: "◉",
          label: "Stationary threshold",
          value: `${sensorConfig.stationary_speed_threshold_kmh} km/h`,
          description: "Speed below which the vehicle is considered stationary",
        },
        {
          icon: "⏱",
          label: "Cancellation period",
          value: `${sensorConfig.cancellation_period_seconds} seconds`,
          description: "Time given to cancel a confirmed accident before emergency response",
        },
      ]
    : [];

  return (
    <>
      {/* PAGE HEADER */}
      <header className="topbar">
        <div>
          <p className="eyebrow">SYSTEM CONFIGURATION</p>
          <h2>Settings</h2>
        </div>

        <button
          className="refresh-button"
          onClick={onRefresh}
          disabled={resetting}
        >
          ↻ Refresh
        </button>
      </header>

      {/* DETECTION ENGINE */}
      <section className="card settings-card">
        <div className="section-header">
          <div>
            <p className="eyebrow">DETECTION ENGINE</p>
            <h3>Current Safety Thresholds</h3>
          </div>

          <span className="settings-readonly">
            ● READ ONLY
          </span>
        </div>

        <p className="settings-description">
          These values control the five-stage accident verification process.
          They are managed by the backend detection engine.
        </p>

        {!sensorConfig ? (
          <div className="empty-state">
            Loading detection configuration...
          </div>
        ) : (
          <div className="settings-grid">
            {items.map((item) => (
              <div className="setting-row" key={item.label}>
                <div className="setting-main">
                  <div className="setting-icon">
                    {item.icon}
                  </div>

                  <div className="setting-text">
                    <strong>{item.label}</strong>
                    <span>{item.description}</span>
                  </div>
                </div>

                <div className="setting-value">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="settings-note">
          <span className="settings-note-icon">ⓘ</span>

          <p>
            Thresholds are currently controlled by the backend detection
            engine. They can be tuned later using real sensor data without
            changing the dashboard.
          </p>
        </div>
      </section>

      {/* MONITORING CONTROL */}
      <section className="card settings-card">
        <div className="section-header">
          <div>
            <p className="eyebrow">MONITORING CONTROL</p>
            <h3>Detection Session</h3>
          </div>

          <span className="settings-status-badge">
            ● LIVE SYSTEM
          </span>
        </div>

        <div className="settings-control-content">
          <div className="settings-control-icon">
            ↻
          </div>

          <div>
            <h4>Reset live detection engine</h4>

            <p className="muted">
              Resetting the detection engine clears only the current live
              monitoring state. Accident history, emergency contacts, and
              saved notifications remain safely stored in the database.
            </p>
          </div>
        </div>

        <button
          className="settings-reset-button"
          onClick={onReset}
          disabled={resetting}
        >
          {resetting
            ? "RESETTING..."
            : "RESET LIVE DETECTION ENGINE"}
        </button>
      </section>

      {/* SYSTEM INFORMATION */}
      <section className="card settings-card">
        <div className="section-header">
          <div>
            <p className="eyebrow">SYSTEM INFORMATION</p>
            <h3>AcciSafe v1.0</h3>
          </div>

          <span className="settings-status-badge">
            ● ONLINE
          </span>
        </div>

        <div className="system-info-grid">
          <div className="system-info-item">
            <span>Backend</span>
            <strong>FastAPI</strong>
          </div>

          <div className="system-info-item">
            <span>Frontend</span>
            <strong>React + Vite</strong>
          </div>

          <div className="system-info-item">
            <span>Database</span>
            <strong>SQLite</strong>
          </div>

          <div className="system-info-item">
            <span>Authentication</span>
            <strong>Firebase Auth</strong>
          </div>

          <div className="system-info-item">
            <span>Cloud Storage</span>
            <strong>Firebase Firestore</strong>
          </div>

          <div className="system-info-item">
            <span>Maps</span>
            <strong>OpenStreetMap / Leaflet</strong>
          </div>
        </div>
      </section>
    </>
  );
}

// =========================================================
// ADMIN DASHBOARD PAGE
// =========================================================

function AdminDashboardPage() {
  const [adminAccidents, setAdminAccidents] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [adminMessage, setAdminMessage] =
    useState("");

  const fetchAdminData = async () => {
    setLoading(true);
    setError("");
    setAdminMessage("");

    try {
      const response = await apiFetch(
        `${API_URL}/admin/accidents`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to load administrator data."
        );
      }

      setAdminAccidents(
        data.accidents || []
      );

      setAdminMessage(
        `Administrator access verified. ${data.count || 0} accident records available.`
      );

    } catch (err) {
      console.error(
        "Admin dashboard error:",
        err
      );

      setError(
        err.message ||
          "Unable to load administrator data."
      );

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const total = adminAccidents.length;

  const emergencyActive =
    adminAccidents.filter(
      (accident) =>
        accident.status ===
        "EMERGENCY_ACTIVE"
    ).length;

  const confirmed =
    adminAccidents.filter(
      (accident) =>
        accident.status ===
        "ACCIDENT_CONFIRMED"
    ).length;

  const falseAlarms =
    adminAccidents.filter(
      (accident) =>
        accident.status ===
        "FALSE_ALARM"
    ).length;

  const cancelled =
    adminAccidents.filter(
      (accident) =>
        accident.status ===
        "CANCELLED"
    ).length;

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">
            SYSTEM ADMINISTRATION
          </p>

          <h2>
            Admin Dashboard
          </h2>
        </div>

        <div className="topbar-actions">
          <div className="online-pill">
            <span></span>
            Admin Access
          </div>
        </div>
      </header>

      {error && (
        <div className="error-state">
          {error}
        </div>
      )}

      {adminMessage && !error && (
        <div className="card">
          <p className="muted">
            {adminMessage}
          </p>
        </div>
      )}

      <section className="dashboard-grid">

        <div className="card metric-card">
          <div className="card-header">
            <span>Total Events</span>
            <span className="metric-icon">
              📊
            </span>
          </div>

          <div className="metric-value">
            {loading ? "—" : total}
          </div>

          <p className="muted">
            All recorded system events
          </p>
        </div>


        <div className="card metric-card">
          <div className="card-header">
            <span>Emergency Active</span>
            <span className="metric-icon">
              🚨
            </span>
          </div>

          <div className="metric-value">
            {loading ? "—" : emergencyActive}
          </div>

          <p className="muted">
            Active emergency responses
          </p>
        </div>


        <div className="card metric-card">
          <div className="card-header">
            <span>Confirmed</span>
            <span className="metric-icon">
              ⚠
            </span>
          </div>

          <div className="metric-value">
            {loading ? "—" : confirmed}
          </div>

          <p className="muted">
            Confirmed accident events
          </p>
        </div>


        <div className="card metric-card">
          <div className="card-header">
            <span>False Alarms</span>
            <span className="metric-icon">
              ✓
            </span>
          </div>

          <div className="metric-value">
            {loading ? "—" : falseAlarms}
          </div>

          <p className="muted">
            Events classified as false alarms
          </p>
        </div>

      </section>


      <section className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">
              INCIDENT MONITORING
            </p>

            <h3>
              All Rider Accident Events
            </h3>
          </div>

          <button
            className="refresh-button"
            onClick={fetchAdminData}
            disabled={loading}
          >
            {loading
              ? "Loading..."
              : "↻ Refresh"}
          </button>
        </div>


        {loading ? (
          <div className="empty-state">
            Loading administrator data...
          </div>
        ) : adminAccidents.length === 0 ? (
          <div className="empty-state">
            No accident events recorded.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>User</th>
                  <th>Status</th>
                  <th>Date & Time</th>
                  <th>Impact</th>
                  <th>Speed</th>
                  <th>Location</th>
                </tr>
              </thead>

              <tbody>
                {adminAccidents.map(
                  (accident) => (
                    <tr key={accident.id}>

                      <td>
                        <span className="incident-id">
                          #{accident.id}
                        </span>
                      </td>

                      <td>
                        {accident.user_id
                          ? accident.user_id
                          : "Legacy"}
                      </td>

                      <td>
                        <span
                          className={`status-badge ${
                            accident.status ===
                            "CANCELLED"
                              ? "cancelled"
                              : accident.status ===
                                "FALSE_ALARM"
                              ? "false-alarm"
                              : accident.status ===
                                "EMERGENCY_ACTIVE"
                              ? "emergency"
                              : "confirmed"
                          }`}
                        >
                          <span></span>

                          {getAccidentStatusLabel(
                            accident.status
                          )}
                        </span>
                      </td>

                      <td>
                        {accident.timestamp
                          ? new Date(
                              accident.timestamp
                            ).toLocaleString()
                          : "—"}
                      </td>

                      <td>
                        {accident.acceleration ??
                          "—"}{" "}
                        g
                      </td>

                      <td>
                        {accident.speed_before ??
                          "—"}{" "}
                        km/h
                      </td>

                      <td>
                        {accident.latitude != null &&
                        accident.longitude != null
                          ? `${Number(
                              accident.latitude
                            ).toFixed(4)}, ${Number(
                              accident.longitude
                            ).toFixed(4)}`
                          : "—"}
                      </td>

                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function App() {

  // =========================================================
// HOSPITAL STATE
// =========================================================

const [hospitals, setHospitals] = useState([]);
const [hospitalsLoading, setHospitalsLoading] = useState(false);
const [hospitalError, setHospitalError] = useState("");
const [hospitalLocation, setHospitalLocation] = useState(null);


// =========================================================
// SETTINGS STATE
// =========================================================

const [sensorConfig, setSensorConfig] = useState(null);
const [resettingEngine, setResettingEngine] = useState(false);

  // =========================================================
  // FIREBASE AUTHENTICATION
  // =========================================================

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
  const unsubscribe = onAuthStateChanged(
    auth,
    async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setIsAdmin(false);
        setAuthLoading(false);
        return;
      }

      try {
        // Force-refresh the token so newly assigned
        // Firebase custom claims are available.
        const tokenResult =
          await currentUser.getIdTokenResult(true);

        const admin =
          tokenResult.claims?.admin === true;

        console.log(
          "🔐 AcciSafe user:",
          currentUser.email
        );

        console.log(
          "🔐 Admin claim:",
          admin
        );

        setIsAdmin(admin);
      } catch (error) {
        console.error(
          "❌ Failed to determine admin role:",
          error
        );

        setIsAdmin(false);
      } finally {
        setAuthLoading(false);
      }
    }
  );

  return () => unsubscribe();
}, []);
  
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // =========================================================
  // DASHBOARD STATE
  // =========================================================

  const [accidents, setAccidents] = useState([]);
  const [liveSensor, setLiveSensor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // =========================================================
  // NAVIGATION
  // =========================================================

  const [activePage, setActivePage] = useState("dashboard");

  // =========================================================
  // EMERGENCY CONTACT STATE
  // =========================================================

  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactError, setContactError] = useState("");

  const [showContactForm, setShowContactForm] = useState(false);

  const [editingContactId, setEditingContactId] = useState(null);

  const [contactForm, setContactForm] = useState({
    name: "",
    phone: "",
    relationship: "",
    active: true,
  });

  const [savingContact, setSavingContact] = useState(false);


  // =========================================================
  // LOAD ACCIDENT HISTORY
  // =========================================================

  const fetchAccidents = async () => {

    try {

      const response = await apiFetch(
        `${API_URL}/accidents/`
      );

      if (!response.ok) {
        throw new Error(
          "Failed to fetch accident history"
        );
      }

      const data = await response.json();

      setAccidents(data.accidents || []);

    } catch (err) {

      console.error(err);

      setError(
        "Unable to connect to AcciSafe backend."
      );

    } finally {

      setLoading(false);

    }
  };


  // =========================================================
  // LOAD LIVE SENSOR DATA
  // =========================================================

  const fetchLiveSensor = async () => {

    try {

      const response = await apiFetch(
        `${API_URL}/sensor/latest`
      );

      if (!response.ok) {
        throw new Error(
          "Failed to fetch live sensor data"
        );
      }

      const data = await response.json();

      setLiveSensor(data);

    } catch (err) {

      console.error(
        "Live sensor error:",
        err
      );

    }
  };

  // =========================================================
// LOAD NEARBY HOSPITALS
// =========================================================

const fetchHospitals = async () => {
  setHospitalsLoading(true);
  setHospitalError("");

  try {
    const currentSensor = liveSensor?.sensor;
    const latestAccident = accidents[0];

    const latitude =
      currentSensor?.latitude ??
      latestAccident?.latitude;

    const longitude =
      currentSensor?.longitude ??
      latestAccident?.longitude;

    if (
      latitude === undefined ||
      latitude === null ||
      longitude === undefined ||
      longitude === null
    ) {
      setHospitals([]);
      setHospitalLocation(null);

      setHospitalError(
        "No GPS location is available yet. Send sensor data or record an accident first."
      );

      return;
    }

    setHospitalLocation({
      latitude,
      longitude,
    });

    const response = await apiFetch(
      `${API_URL}/hospitals/nearby?latitude=${latitude}&longitude=${longitude}&radius_km=5&limit=8`
    );

    const data = await response.json();

    if (!response.ok || data.success === false) {
      throw new Error(
        data.message ||
          "Unable to find nearby hospitals."
      );
    }

    setHospitals(data.hospitals || []);

  } catch (err) {
    console.error(
      "Hospital loading error:",
      err
    );

    setHospitalError(
      err.message ||
        "Unable to load nearby hospitals."
    );

    setHospitals([]);

  } finally {
    setHospitalsLoading(false);
  }
};

// =========================================================
// LOAD DETECTION CONFIGURATION
// =========================================================

const fetchSensorConfig = async () => {
  try {
    const response = await apiFetch(
      `${API_URL}/sensor/config`
    );

    if (!response.ok) {
      throw new Error(
        "Failed to fetch detection configuration"
      );
    }

    const data = await response.json();

    setSensorConfig(data);

  } catch (err) {
    console.error(
      "Sensor configuration error:",
      err
    );
  }
};


// =========================================================
// RESET DETECTION ENGINE
// =========================================================

const resetEngine = async () => {
  if (resettingEngine) {
    return;
  }

  const confirmed = window.confirm(
    "Reset the live detection engine? Accident history, contacts, and notifications will not be deleted."
  );

  if (!confirmed) {
    return;
  }

  setResettingEngine(true);

  try {
    const response = await apiFetch(
      `${API_URL}/sensor/reset`,
      {
        method: "POST",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
          "Unable to reset detection engine."
      );
    }

    await fetchLiveSensor();

  } catch (err) {
    console.error(err);

    setError(
      err.message ||
        "Unable to reset detection engine."
    );

  } finally {
    setResettingEngine(false);
  }
};


  // =========================================================
  // LOAD EMERGENCY CONTACTS
  // =========================================================

  const fetchContacts = async () => {

    setContactsLoading(true);
    setContactError("");

    try {

      const response = await apiFetch(
        `${API_URL}/contacts/`
      );

      if (!response.ok) {
        throw new Error(
          "Failed to fetch emergency contacts"
        );
      }

      const data = await response.json();

      setContacts(data.contacts || []);

    } catch (err) {

      console.error(err);

      setContactError(
        "Unable to load emergency contacts."
      );

    } finally {

      setContactsLoading(false);

    }
  };


  // =========================================================
  // OPEN ADD CONTACT FORM
  // =========================================================

  const openAddContact = () => {

    setEditingContactId(null);

    setContactForm({
      name: "",
      phone: "",
      relationship: "",
      active: true,
    });

    setShowContactForm(true);
    setContactError("");

  };


  // =========================================================
  // OPEN EDIT CONTACT FORM
  // =========================================================

  const openEditContact = (contact) => {

    setEditingContactId(contact.id);

    setContactForm({
      name: contact.name,
      phone: contact.phone,
      relationship: contact.relationship,
      active: Boolean(contact.active),
    });

    setShowContactForm(true);
    setContactError("");

  };


  // =========================================================
  // CLOSE CONTACT FORM
  // =========================================================

  const closeContactForm = () => {

    setShowContactForm(false);
    setEditingContactId(null);

    setContactForm({
      name: "",
      phone: "",
      relationship: "",
      active: true,
    });

  };


  // =========================================================
  // CONTACT FORM CHANGE
  // =========================================================

  const handleContactChange = (event) => {

    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setContactForm((previous) => ({
      ...previous,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));

  };


  // =========================================================
  // SAVE CONTACT
  // =========================================================

  const saveContact = async (event) => {

    event.preventDefault();

    if (!contactForm.name.trim()) {
      setContactError("Please enter the contact name.");
      return;
    }

    if (!contactForm.phone.trim()) {
      setContactError("Please enter the phone number.");
      return;
    }

    if (!contactForm.relationship.trim()) {
      setContactError(
        "Please enter the relationship."
      );
      return;
    }

    setSavingContact(true);
    setContactError("");

    try {

      const isEditing =
        editingContactId !== null;

      const url = isEditing
        ? `${API_URL}/contacts/${editingContactId}`
        : `${API_URL}/contacts/`;

      const method = isEditing
        ? "PUT"
        : "POST";

      const response = await apiFetch(
        url,
        {
          method,
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            contactForm
          ),
        }
      );

      const data = await response.json();

      if (!response.ok) {

        throw new Error(
          data.detail ||
            "Unable to save contact."
        );

      }

      await fetchContacts();

      closeContactForm();

    } catch (err) {

      console.error(err);

      setContactError(
        err.message ||
          "Unable to save contact."
      );

    } finally {

      setSavingContact(false);

    }
  };


  // =========================================================
  // DELETE CONTACT
  // =========================================================

  const deleteContact = async (contactId) => {

    const confirmed =
      window.confirm(
        "Delete this emergency contact?"
      );

    if (!confirmed) {
      return;
    }

    try {

      const response = await apiFetch(
        `${API_URL}/contacts/${contactId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {

        throw new Error(
          data.detail ||
            "Unable to delete contact."
        );

      }

      await fetchContacts();

    } catch (err) {

      console.error(err);

      setContactError(
        err.message ||
          "Unable to delete contact."
      );

    }
  };


  // =========================================================
  // TOGGLE CONTACT
  // =========================================================

  const toggleContact = async (contact) => {

    try {

      const response = await apiFetch(
        `${API_URL}/contacts/${contact.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            name: contact.name,
            phone: contact.phone,
            relationship:
              contact.relationship,
            active: !contact.active,
          }),
        }
      );

      if (!response.ok) {

        const data =
          await response.json();

        throw new Error(
          data.detail ||
            "Unable to update contact."
        );

      }

      await fetchContacts();

    } catch (err) {

      console.error(err);

      setContactError(
        err.message ||
          "Unable to update contact."
      );

    }
  };


  // =========================================================
  // CANCEL EMERGENCY ALERT
  // =========================================================

  const cancelEmergency = async () => {

    if (cancelling) {
      return;
    }

    setCancelling(true);

    try {

      const response = await apiFetch(
        `${API_URL}/sensor/cancel`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {

        throw new Error(
          data.message ||
            "Unable to cancel alert."
        );

      }

      await fetchLiveSensor();

    } catch (err) {

      console.error(
        "Cancellation error:",
        err
      );

      setError(
        err.message ||
          "Unable to cancel emergency alert."
      );

    } finally {

      setCancelling(false);

    }
  };


  // =========================================================
  // INITIAL LOAD + LIVE POLLING
  // =========================================================

 useEffect(() => {

    if (authLoading || !user) {
        return;
    }

    fetchAccidents();
    fetchLiveSensor();
    fetchContacts();
    fetchSensorConfig();

    const interval = setInterval(() => {
        fetchLiveSensor();
    }, 1000);

    return () => {
        clearInterval(interval);
    };

}, [authLoading, user]);

useEffect(() => {
    console.log("🔔 AcciSafe notification effect started");
    console.log("authLoading:", authLoading);
    console.log("user:", user);

    if (authLoading || !user) {
        console.log(
            "🔔 Notification setup skipped:",
            authLoading ? "Auth still loading" : "No logged-in user"
        );
        return;
    }

    console.log("🔔 Starting notification setup...");

    let unsubscribe;

    async function setupNotifications() {
        console.log("🔔 Calling requestNotificationPermission()...");

        try {
            const token = await requestNotificationPermission();

            console.log("🔔 Notification function returned.");
            console.log("FCM token:", token);

            if (token) {
                console.log(
                    "✅ AcciSafe notification system initialized."
                );
                await registerFCMTokenWithBackend(token);
            } else {
                console.log(
                    "⚠️ No FCM token was returned."
                );
            }

            unsubscribe =
                listenForForegroundNotifications((payload) => {
                    console.log(
                        "🚨 AcciSafe notification received:",
                        payload
                    );

                    const title =
                        payload.notification?.title ||
                        "AcciSafe Emergency Alert";

                    const body =
                        payload.notification?.body ||
                        "Emergency event detected.";

                    if (
                        "Notification" in window &&
                        Notification.permission === "granted"
                    ) {
                        new Notification(title, {
                            body: body
                        });
                    }
                });

            console.log(
                "✅ Foreground notification listener registered."
            );

        } catch (error) {
            console.error(
                "❌ Notification setup crashed:",
                error
            );
        }
    }

    setupNotifications();

    return () => {
        if (unsubscribe) {
            unsubscribe();
        }
    };
}, [authLoading, user]);


  // =========================================================
  // LOAD CONTACTS WHEN PAGE OPENS
  // =========================================================

  useEffect(() => {

    if (
      activePage ===
      "contacts"
    ) {

      const timer = setTimeout(() => {
        fetchContacts();
      }, 0);

      return () => clearTimeout(timer);
    }

  }, [activePage]);


  // =========================================================
  // DERIVED VALUES
  // =========================================================

  const sensor =
    liveSensor?.sensor || null;

  const detection =
    liveSensor?.detection || null;

  const status =
    detection?.status || "NO_DATA";

  const isNormal =
    status === "NORMAL";

  const isObserving =
    status === "OBSERVING";

  const isConfirmed =
    status ===
    "ACCIDENT_CONFIRMED";

  const isCancellationWindow =
    status ===
    "CANCELLATION_WINDOW";

  const isEmergencyActive =
    status ===
    "EMERGENCY_ACTIVE";

  const cancellationRemaining =
    detection?.cancellation_remaining ??
    0;


  // =========================================================
  // RENDER
  // =========================================================

  if (authLoading) {
    return (
      <div className="auth-loading">
        Loading AcciSafe...
      </div>
    );
  }

  if (!user) {
    return (
      <AuthPage
        onLogin={(loggedInUser) => {
          setUser(loggedInUser);
        }}
      />
    );
  }

  return (

    <div className="app">

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside className="sidebar">

        <div className="brand">

          <div className="brand-icon">
            🛡
          </div>

          <div>
            <h1>AcciSafe</h1>

            <span>
              Rider Safety System
            </span>
          </div>

        </div>


        <nav className="navigation">

          <button
            className={
              `nav-item ${
                activePage === "dashboard"
                  ? "active"
                  : ""
              }`
            }
            onClick={() =>
              setActivePage(
                "dashboard"
              )
            }
          >
            <span>⌂</span>
            Dashboard
          </button>


          <button
            className={
              `nav-item ${
                activePage === "live"
                  ? "active"
                  : ""
              }`
            }
            onClick={() =>
              setActivePage(
                "live"
              )
            }
          >
            <span>◉</span>
            Live Safety
          </button>


          <button
  className={
    `nav-item ${
      activePage === "history"
        ? "active"
        : ""
    }`
  }
  onClick={() =>
    setActivePage(
      "history"
    )
  }
>
            <span>⚠</span>
            Accident History
          </button>


          <button
            className={
              `nav-item ${
                activePage === "contacts"
                  ? "active"
                  : ""
              }`
            }
            onClick={() =>
              setActivePage(
                "contacts"
              )
            }
          >
            <span>♧</span>
            Emergency Contacts
          </button>


          <button
  className={
    `nav-item ${
      activePage === "hospitals"
        ? "active"
        : ""
    }`
  }
  onClick={() =>
    setActivePage(
      "hospitals"
    )
  }
>
            <span>+</span>
            Hospitals
          </button>


                    <button
  className={
    `nav-item ${
      activePage === "settings"
        ? "active"
        : ""
    }`
  }
  onClick={() =>
    setActivePage(
      "settings"
    )
  }
>
            <span>⚙</span>
            Settings
          </button>

          {isAdmin && (
  <button
    className={
      `nav-item ${
        activePage === "admin"
          ? "active"
          : ""
      }`
    }
    onClick={() =>
      setActivePage("admin")
    }
  >
    <span>🛡</span>
    Admin Dashboard
  </button>
)}

        </nav>


        <button
          className="logout-button"
          onClick={handleLogout}
        >
          ↪ Sign Out
        </button>


        <div className="sidebar-footer">

          <div className="connection-indicator">

            <span className="status-dot"></span>

            <div>

              <strong>
                System Online
              </strong>

              <small>
                Backend connected
              </small>

            </div>

          </div>


          <div className="version">
            AcciSafe v1.0
          </div>

        </div>

      </aside>


      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <main className="main-content">


        {/* ===================================================
            CONTACTS PAGE
        =================================================== */}

        {activePage === "contacts" ? (

          <>

            <header className="topbar">

              <div>

                <p className="eyebrow">
                  SAFETY CONFIGURATION
                </p>

                <h2>
                  Emergency Contacts
                </h2>

              </div>


              <div className="topbar-actions">

                <div className="online-pill">

                  <span></span>

                  System Online

                </div>

                <div className="profile">

                  <div className="profile-avatar">
                    R
                  </div>

                  <div>

                    <strong>
                      Rider
                    </strong>

                    <small>
                      Primary Account
                    </small>

                  </div>

                </div>

              </div>

            </header>


            {/* CONTACT OVERVIEW */}

            <section className="contacts-overview">

              <div>

                <p className="eyebrow">
                  EMERGENCY RESPONSE
                </p>

                <h3>
                  Who should AcciSafe notify?
                </h3>

                <p>
                  Active contacts will receive
                  an emergency notification when
                  the rider does not cancel a
                  confirmed accident.
                </p>

              </div>


              <div className="contact-stat">

                <strong>
                  {contacts.length}
                </strong>

                <span>
                  Total Contacts
                </span>

              </div>


              <div className="contact-stat">

                <strong>
                  {
                    contacts.filter(
                      (contact) =>
                        Boolean(
                          contact.active
                        )
                    ).length
                  }
                </strong>

                <span>
                  Active Contacts
                </span>

              </div>

            </section>


            {/* CONTACT HEADER */}

            <section className="card contacts-card">

              <div className="section-header">

                <div>

                  <p className="eyebrow">
                    CONTACT MANAGEMENT
                  </p>

                  <h3>
                    Your Emergency Contacts
                  </h3>

                </div>


                <button
                  className="add-contact-button"
                  onClick={
                    openAddContact
                  }
                >
                  + Add Contact
                </button>

              </div>


              {/* FORM */}

              {showContactForm && (

                <form
                  className="contact-form"
                  onSubmit={
                    saveContact
                  }
                >

                  <div className="contact-form-header">

                    <div>

                      <p className="eyebrow">
                        {editingContactId
                          ? "EDIT CONTACT"
                          : "NEW CONTACT"}
                      </p>

                      <h3>
                        {editingContactId
                          ? "Update Emergency Contact"
                          : "Add Emergency Contact"}
                      </h3>

                    </div>

                    <button
                      type="button"
                      className="close-form-button"
                      onClick={
                        closeContactForm
                      }
                    >
                      ✕
                    </button>

                  </div>


                  <div className="contact-form-grid">

                    <label>

                      <span>
                        Full Name
                      </span>

                      <input
                        type="text"
                        name="name"
                        value={
                          contactForm.name
                        }
                        onChange={
                          handleContactChange
                        }
                        placeholder="e.g. Rahul Kumar"
                      />

                    </label>


                    <label>

                      <span>
                        Phone Number
                      </span>

                      <input
                        type="tel"
                        name="phone"
                        value={
                          contactForm.phone
                        }
                        onChange={
                          handleContactChange
                        }
                        placeholder="+91 9876543210"
                      />

                    </label>


                    <label>

                      <span>
                        Relationship
                      </span>

                      <input
                        type="text"
                        name="relationship"
                        value={
                          contactForm.relationship
                        }
                        onChange={
                          handleContactChange
                        }
                        placeholder="e.g. Parent"
                      />

                    </label>


                    <label className="active-checkbox">

                      <input
                        type="checkbox"
                        name="active"
                        checked={
                          contactForm.active
                        }
                        onChange={
                          handleContactChange
                        }
                      />

                      <span>
                        Receive emergency alerts
                      </span>

                    </label>

                  </div>


                  {contactError && (

                    <div className="contact-error">
                      {contactError}
                    </div>

                  )}


                  <div className="contact-form-actions">

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={
                        closeContactForm
                      }
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="save-contact-button"
                      disabled={
                        savingContact
                      }
                    >
                      {savingContact
                        ? "Saving..."
                        : editingContactId
                        ? "Save Changes"
                        : "Add Contact"}
                    </button>

                  </div>

                </form>

              )}


              {/* CONTACT ERROR */}

              {!showContactForm &&
                contactError && (

                  <div className="contact-error">
                    {contactError}
                  </div>

                )}


              {/* LOADING */}

              {contactsLoading ? (

                <div className="contacts-empty">
                  Loading emergency contacts...
                </div>

              ) : contacts.length === 0 ? (

                <div className="contacts-empty">

                  <div className="contacts-empty-icon">
                    ♧
                  </div>

                  <h3>
                    No emergency contacts
                  </h3>

                  <p>
                    Add at least one trusted
                    contact so AcciSafe knows
                    who to notify during an
                    emergency.
                  </p>

                  <button
                    className="add-contact-button"
                    onClick={
                      openAddContact
                    }
                  >
                    + Add First Contact
                  </button>

                </div>

              ) : (

                <div className="contacts-list">

                  {contacts.map(
                    (contact) => (

                      <div
                        className={
                          `contact-row ${
                            contact.active
                              ? ""
                              : "contact-disabled"
                          }`
                        }
                        key={contact.id}
                      >

                        <div className="contact-avatar">
                          {contact.name
                            .charAt(0)
                            .toUpperCase()}
                        </div>


                        <div className="contact-info">

                          <strong>
                            {contact.name}
                          </strong>

                          <span>
                            {contact.relationship}
                          </span>

                        </div>


                        <div className="contact-phone">

                          <span>
                            Phone
                          </span>

                          <strong>
                            {contact.phone}
                          </strong>

                        </div>


                        <div className="contact-status">

                          <span
                            className={
                              `contact-status-badge ${
                                contact.active
                                  ? "active"
                                  : "inactive"
                              }`
                            }
                          >

                            <span></span>

                            {contact.active
                              ? "Active"
                              : "Disabled"}

                          </span>

                        </div>


                        <div className="contact-actions">

                          <button
                            className="contact-action-button"
                            onClick={() =>
                              toggleContact(
                                contact
                              )
                            }
                          >
                            {contact.active
                              ? "Disable"
                              : "Enable"}
                          </button>


                          <button
                            className="contact-action-button"
                            onClick={() =>
                              openEditContact(
                                contact
                              )
                            }
                          >
                            Edit
                          </button>


                          <button
                            className="contact-action-button delete"
                            onClick={() =>
                              deleteContact(
                                contact.id
                              )
                            }
                          >
                            Delete
                          </button>

                        </div>

                      </div>

                    )
                  )}

                </div>

              )}

            </section>


            {/* INFORMATION */}

            <section className="contact-info-banner">

              <div className="contact-info-icon">
                🛡
              </div>

              <div>

                <h3>
                  How emergency notifications work
                </h3>

                <p>
                  When AcciSafe confirms an accident,
                  the rider receives a cancellation
                  window. If the rider does not cancel
                  the alert before the countdown expires,
                  every active emergency contact is
                  notified with the accident location.
                </p>

              </div>

            </section>

          </>

        ) : 

          activePage === "live" ? (

  <LiveSafetyPage
    sensor={sensor}
    detection={detection}
    status={status}
    isNormal={isNormal}
    isObserving={isObserving}
    isConfirmed={isConfirmed}
    isCancellationWindow={isCancellationWindow}
    isEmergencyActive={isEmergencyActive}
  />

) : activePage === "history" ? (

  <AccidentHistoryPage
    accidents={accidents}
    loading={loading}
    error={error}
  />

) : activePage === "hospitals" ? (

  <HospitalsPage
    hospitals={hospitals}
    hospitalsLoading={hospitalsLoading}
    hospitalError={hospitalError}
    hospitalLocation={hospitalLocation}
    onRefresh={fetchHospitals}
  />

) : activePage === "settings" ? (

  <SettingsPage
    sensorConfig={sensorConfig}
    onRefresh={fetchSensorConfig}
    onReset={resetEngine}
    resetting={resettingEngine}
  />

) : activePage === "admin" && isAdmin ? (

  <AdminDashboardPage />

) : (

  /* =================================================
     DASHBOARD PAGE
  ================================================= */

  <>

            <header className="topbar">

              <div>

                <p className="eyebrow">
                  RIDER DASHBOARD
                </p>

                <h2>
                  Safety Overview
                </h2>

              </div>


              <div className="topbar-actions">

                <div className="online-pill">

                  <span></span>

                  System Online

                </div>


                <div className="profile">

                  <div className="profile-avatar">
                    R
                  </div>

                  <div>

                    <strong>
                      Rider
                    </strong>

                    <small>
                      Primary Account
                    </small>

                  </div>

                </div>

              </div>

            </header>


            {/* EMERGENCY CONTROL PANEL */}

            {(isConfirmed ||
              isCancellationWindow ||
              isEmergencyActive) && (

              <section
                className={
                  `emergency-control ${
                    isEmergencyActive
                      ? "emergency-control-active"
                      : ""
                  }`
                }
              >

                <div className="emergency-control-icon">
                  🚨
                </div>


                <div className="emergency-control-content">

                  <p className="eyebrow">
                    EMERGENCY RESPONSE
                  </p>

                  <h2>

                    {isEmergencyActive
                      ? "Emergency Response Active"
                      : "Accident Confirmed"}

                  </h2>

                  <p>

                    {isEmergencyActive
                      ? "The cancellation window has expired. Emergency response should now be initiated."
                      : "AcciSafe has confirmed an accident. If you are safe, cancel the alert before the countdown expires."}

                  </p>

                </div>


                {!isEmergencyActive && (

                  <div className="emergency-action">

                    <div className="countdown">

                      <span>
                        {Math.ceil(
                          cancellationRemaining
                        )}
                      </span>

                      <small>
                        seconds
                      </small>

                    </div>


                    <button
                      className="cancel-alert-button"
                      onClick={
                        cancelEmergency
                      }
                      disabled={
                        cancelling
                      }
                    >

                      {cancelling
                        ? "CANCELLING..."
                        : "I'M OK — CANCEL ALERT"}

                    </button>

                  </div>

                )}


                {isEmergencyActive && (

                  <div className="emergency-active-badge">
                    🚨 ACTIVE
                  </div>

                )}

              </section>

            )}


            {/* LIVE SAFETY STATUS */}

            <section
              className={
                `live-status-banner ${
                  isNormal
                    ? "status-safe"
                    : isObserving
                    ? "status-warning"
                    : isConfirmed ||
                      isCancellationWindow ||
                      isEmergencyActive
                    ? "status-danger"
                    : ""
                }`
              }
            >

              <div className="live-status-icon">

                {isNormal && "✓"}

                {isObserving && "!"}

                {(isConfirmed ||
                  isCancellationWindow ||
                  isEmergencyActive) &&
                  "!"}

                {!sensor && "?"}

              </div>


              <div className="live-status-text">

                <p className="eyebrow">
                  LIVE SAFETY STATUS
                </p>

                <h3>

                  {isNormal &&
                    "SAFE — Monitoring Active"}

                  {isObserving &&
                    "POSSIBLE ACCIDENT — Verification in Progress"}

                  {isConfirmed &&
                    "ACCIDENT CONFIRMED — Cancellation Window"}

                  {isCancellationWindow &&
                    "ACCIDENT CONFIRMED — Waiting for Rider"}

                  {isEmergencyActive &&
                    "EMERGENCY RESPONSE ACTIVE"}

                  {!sensor &&
                    "Waiting for sensor data"}

                </h3>

                <p>

                  {isNormal &&
                    "No accident currently detected."}

                  {isObserving &&
                    "AcciSafe has detected a possible accident and is verifying the event."}

                  {isConfirmed &&
                    "The five-stage verification process has confirmed an accident. Rider cancellation is available."}

                  {isCancellationWindow &&
                    "Emergency response will begin automatically when the cancellation window expires."}

                  {isEmergencyActive &&
                    "The cancellation window has expired. Emergency response should be initiated."}

                </p>

              </div>


              <div className="stage-indicator">

                {sensor
                  ? `STAGE ${
                      detection?.stage || 1
                    } / 5`
                  : "WAITING"}

              </div>

            </section>


            {/* SENSOR CARDS */}

            <section className="dashboard-grid">

              <div className="card safety-card">

                <div className="card-header">

                  <span>
                    Current Status
                  </span>

                  <span className="live-label">
                    LIVE
                  </span>

                </div>


                <div className="safety-status">

                  <div
                    className={
                      `safe-icon ${
                        isObserving
                          ? "warning-icon"
                          : isConfirmed ||
                            isCancellationWindow ||
                            isEmergencyActive
                          ? "danger-icon"
                          : ""
                      }`
                    }
                  >

                    {isNormal && "✓"}

                    {isObserving && "!"}

                    {(isConfirmed ||
                      isCancellationWindow ||
                      isEmergencyActive) &&
                      "!"}

                  </div>


                  <div>

                    <h3>

                      {isNormal && "SAFE"}

                      {isObserving &&
                        "VERIFYING"}

                      {isConfirmed &&
                        "CANCEL WINDOW"}

                      {isCancellationWindow &&
                        "CANCEL WINDOW"}

                      {isEmergencyActive &&
                        "EMERGENCY"}

                    </h3>

                    <p>

                      {isNormal &&
                        "Monitoring active"}

                      {isObserving &&
                        "Observation period"}

                      {isConfirmed &&
                        "Rider can cancel"}

                      {isCancellationWindow &&
                        "Rider can cancel"}

                      {isEmergencyActive &&
                        "Response active"}

                    </p>

                  </div>

                </div>


                <div className="monitoring-bar">

                  <div
                    className={
                      isConfirmed ||
                      isCancellationWindow ||
                      isEmergencyActive
                        ? "danger-progress"
                        : isObserving
                        ? "warning-progress"
                        : ""
                    }
                  ></div>

                </div>


                <p className="muted">

                  {detection?.message ||
                    "Waiting for sensor data."}

                </p>

              </div>


              <div className="card metric-card">

                <div className="card-header">

                  <span>
                    Accident Events
                  </span>

                  <span className="metric-icon">
                    ⚠
                  </span>

                </div>

                <div className="metric-value">
                  {accidents.length}
                </div>

                <p className="muted">
                  Safety events recorded
                </p>

              </div>


              <div className="card metric-card">

                <div className="card-header">

                  <span>
                    Current Impact
                  </span>

                  <span className="metric-icon">
                    ⚡
                  </span>

                </div>

                <div className="metric-value">

                  {sensor
                    ? `${sensor.acceleration} g`
                    : "—"}

                </div>

                <p className="muted">
                  Live acceleration
                </p>

              </div>


              <div className="card metric-card">

                <div className="card-header">

                  <span>
                    Current Speed
                  </span>

                  <span className="metric-icon">
                    🏍
                  </span>

                </div>

                <div className="metric-value">

                  {sensor
                    ? `${sensor.speed_after} km/h`
                    : "—"}

                </div>

                <p className="muted">
                  Current recorded speed
                </p>

              </div>

            </section>


            {/* SENSOR + MAP */}

            <section className="content-grid">

              <div className="card live-card">

                <div className="section-header">

                  <div>

                    <p className="eyebrow">
                      REAL-TIME MONITORING
                    </p>

                    <h3>
                      Vehicle Sensors
                    </h3>

                  </div>

                  <span className="live-label">
                    ● LIVE
                  </span>

                </div>


                <div className="sensor-grid">

                  <div className="sensor">

                    <span className="sensor-icon">
                      🏍
                    </span>

                    <div>

                      <span>
                        Speed
                      </span>

                      <strong>

                        {sensor
                          ? `${sensor.speed_after} km/h`
                          : "—"}

                      </strong>

                    </div>

                  </div>


                  <div className="sensor">

                    <span className="sensor-icon">
                      ⚡
                    </span>

                    <div>

                      <span>
                        Acceleration
                      </span>

                      <strong>

                        {sensor
                          ? `${sensor.acceleration} g`
                          : "—"}

                      </strong>

                    </div>

                  </div>


                  <div className="sensor">

                    <span className="sensor-icon">
                      ◢
                    </span>

                    <div>

                      <span>
                        Tilt Angle
                      </span>

                      <strong>

                        {sensor
                          ? `${sensor.tilt_angle}°`
                          : "—"}

                      </strong>

                    </div>

                  </div>


                  <div className="sensor">

                    <span className="sensor-icon">
                      ◉
                    </span>

                    <div>

                      <span>
                        GPS
                      </span>

                      <strong className="gps-good">
                        Connected
                      </strong>

                    </div>

                  </div>

                </div>

              </div>


              <div className="card map-card">

                <div className="section-header">

                  <div>

                    <p className="eyebrow">
                      GPS LOCATION
                    </p>

                    <h3>
                      Live Position
                    </h3>

                  </div>

                  <span className="location-pin">
                    ⌖
                  </span>

                </div>


                <div className="real-map">

                  {sensor ? (

                    <MapContainer
                      center={[
                        sensor.latitude,
                        sensor.longitude,
                      ]}
                      zoom={15}
                      scrollWheelZoom={true}
                      className="leaflet-map"
                    >

                      <TileLayer
                        attribution="&copy; OpenStreetMap contributors"
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />

                      <Marker
                        position={[
                          sensor.latitude,
                          sensor.longitude,
                        ]}
                        icon={markerIcon}
                      >

                        <Popup>

                          <strong>
                            AcciSafe Motorcycle
                          </strong>

                          <br />

                          Speed:{" "}
                          {sensor.speed_after}
                          {" "}km/h

                          <br />

                          Acceleration:{" "}
                          {sensor.acceleration}
                          {" "}g

                          <br />

                          Tilt:{" "}
                          {sensor.tilt_angle}°

                        </Popup>

                      </Marker>

                    </MapContainer>

                  ) : (

                    <div className="no-map-data">
                      Waiting for GPS data
                    </div>

                  )}

                </div>

              </div>

            </section>


            {/* FIVE STAGE VERIFICATION */}

            <section className="card verification-card">

              <div className="section-header">

                <div>

                  <p className="eyebrow">
                    ACCIDENT DETECTION ENGINE
                  </p>

                  <h3>
                    Five-Stage Verification
                  </h3>

                </div>

                <span className="stage-indicator-small">

                  {sensor
                    ? `Stage ${
                        detection?.stage || 1
                      } / 5`
                    : "Waiting"}

                </span>

              </div>


              <div className="verification-grid">

                <VerificationStage
                  number="1"
                  title="Impact Detection"
                  active={
                    detection?.checks
                      ?.impact_detected
                  }
                  currentStage={
                    detection?.stage === 1
                  }
                />

                <VerificationStage
                  number="2"
                  title="Speed Verification"
                  active={
                    detection?.checks
                      ?.speed_verified
                  }
                  currentStage={
                    detection?.stage === 2
                  }
                />

                <VerificationStage
                  number="3"
                  title="Sudden Stop Analysis"
                  active={
                    detection?.checks
                      ?.sudden_stop
                  }
                  currentStage={
                    detection?.stage === 3
                  }
                />

                <VerificationStage
                  number="4"
                  title="Tilt Analysis"
                  active={
                    detection?.checks
                      ?.significant_tilt
                  }
                  currentStage={
                    detection?.stage === 4
                  }
                />

                <VerificationStage
                  number="5"
                  title="Observation Period"
                  active={
                    detection?.checks
                      ?.observation_complete
                  }
                  currentStage={
                    detection?.stage === 5
                  }
                />

              </div>

            </section>


            {/* ACCIDENT HISTORY */}

            <section className="card history-card">

              <div className="section-header">

                <div>

                  <p className="eyebrow">
                    SAFETY RECORD
                  </p>

                  <h3>
                    Accident History
                  </h3>

                </div>

                <button
                  className="refresh-button"
                  onClick={
                    fetchAccidents
                  }
                >
                  ↻ Refresh
                </button>

              </div>


              {loading && (

                <div className="empty-state">
                  Loading accident history...
                </div>

              )}


              {!loading && error && (

                <div className="error-state">
                  {error}
                </div>

              )}


              {!loading &&
                !error &&
                accidents.length === 0 && (

                  <div className="empty-state">
                    No safety accidents have been recorded.
                  </div>

                )}


              {!loading &&
                !error &&
                accidents.length > 0 && (

                  <div className="table-container">

                    <table>

                      <thead>

                        <tr>

                          <th>ID</th>
                          <th>Status</th>
                          <th>Date & Time</th>
                          <th>Impact</th>
                          <th>Speed</th>
                          <th>Tilt</th>
                          <th>Location</th>

                        </tr>

                      </thead>


                      <tbody>

                        {accidents.map(
                          (accident) => (

                            <tr
                              key={
                                accident.id
                              }
                            >

                              <td>

                                <span className="incident-id">
                                  #{accident.id}
                                </span>

                              </td>


                              <td>

  <span
    className={
      `status-badge ${
        getAccidentStatusClass(
          accident.status
        )
      }`
    }
  >

    <span></span>

    {getAccidentStatusLabel(
      accident.status
    )}

  </span>

</td>


                              <td>

                                {new Date(
                                  accident.timestamp
                                ).toLocaleString()}

                              </td>


                              <td>
                                {
                                  accident.acceleration
                                } g
                              </td>


                              <td>
                                {
                                  accident.speed_before
                                } km/h
                              </td>


                              <td>
                                {
                                  accident.tilt_angle
                                }°
                              </td>


                              <td>

                                {Number(
                                  accident.latitude
                                ).toFixed(4)}

                                {", "}

                                {Number(
                                  accident.longitude
                                ).toFixed(4)}

                              </td>

                            </tr>

                          )
                        )}

                      </tbody>

                    </table>

                  </div>

                )}

            </section>


            {/* EMERGENCY RESPONSE */}

            <section
              className={
                `response-banner ${
                  isConfirmed ||
                  isCancellationWindow ||
                  isEmergencyActive
                    ? "response-active"
                    : ""
                }`
              }
            >

              <div className="response-icon">

                {isConfirmed ||
                isCancellationWindow ||
                isEmergencyActive
                  ? "🚨"
                  : "🛡"}

              </div>


              <div>

                <h3>

                  {isEmergencyActive
                    ? "Emergency Response Active"
                    : isConfirmed ||
                      isCancellationWindow
                    ? "Emergency Response Pending"
                    : "Emergency Response Ready"}

                </h3>


                <p>

                  {isEmergencyActive
                    ? "The rider did not cancel the alert. Emergency response should now be initiated."
                    : isConfirmed ||
                      isCancellationWindow
                    ? "Accident confirmed. Rider has a limited cancellation window."
                    : "If an accident is confirmed, AcciSafe can initiate emergency notifications and location sharing."}

                </p>

              </div>


              <div className="response-status">

                {isEmergencyActive
                  ? "ACTIVE"
                  : isConfirmed ||
                    isCancellationWindow
                  ? "PENDING"
                  : "READY"}

              </div>

            </section>

          </>

        )}

      </main>

    </div>
  );
}


// =========================================================
// VERIFICATION STAGE COMPONENT
// =========================================================

function VerificationStage({
  number,
  title,
  active,
  currentStage,
}) {

  return (

    <div
      className={
        `verification-stage ${
          active
            ? "stage-complete"
            : currentStage
            ? "stage-current"
            : ""
        }`
      }
    >

      <div className="stage-number">

        {active
          ? "✓"
          : number}

      </div>


      <div>

        <span>
          Stage {number}
        </span>

        <strong>
          {title}
        </strong>

      </div>

    </div>
  );
}


export default App;