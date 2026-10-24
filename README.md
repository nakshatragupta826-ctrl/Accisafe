AcciSafe: IoT Motorcycle Accident Detection & Emergency Response System
![AcciSafe Banner](https://img.shields.io/badge/Status-Active-brightgreen)
![Python](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.10%2B-blue)
![React](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite%20%7C%20Tailwind-61DAFB)
![Database](https://img.shields.io/badge/Database-SQLite-003B57)
![Testing](https://img.shields.io/badge/Testing-Apache%20JMeter%20%7C%20Selenium%20IDE-orange)
![PM](https://img.shields.io/badge/Project%20Management-Atlassian%20Jira-0052CC)
AcciSafe is an intelligent, software-simulated IoT safety framework designed to detect motorcycle accidents using continuous multi-sensor telemetry and automatically dispatch emergency alerts via the Telegram Bot API. By using a novel 5-Stage Verification Pipeline, AcciSafe suppresses false positives caused by potholes, abrupt braking, or phone drops while ensuring rapid emergency dispatch during critical crashes.
---
 Features
5-Stage Crash Verification Engine: Evaluates linear acceleration ($A \ge 3.0g$), pre-impact velocity, sudden speed drop ($\Delta V$), bike tilt inclination ($> 45^\circ$), and an observation grace window.
Zero-Cost Instant Emergency Dispatch: Sends immediate Telegram alerts featuring live Google Maps location pins to registered emergency contacts.
False Positive Suppression: Provides a rider-configurable cancellation grace period (15–60s) directly on the web dashboard to prevent accidental dispatches.
Real-Time Web Dashboard: Built with React, Vite, and Tailwind CSS to display live telemetry, manage emergency contacts, view accident history, and configure threshold parameters.
Continuous Sensor Simulator: Software-based IoT simulation engine (`continuous_simulator.py`) replicating real-time ESP32 IMU and GPS telemetry stream.
Role-Based Access Control (RBAC): Firebase Authentication and custom route guards distinguishing riders from admin managers.
---
 System Architecture
The project follows a decoupled 3-tier architecture:
```
+-------------------------------------------------------+
|                 IoT Simulation Layer                  |
|          (continuous_simulator.py / ESP32)            |
+---------------------------+---------------------------+
                            | HTTP POST Telemetry
                            v
+-------------------------------------------------------+
|                Backend Services Layer                 |
|             (FastAPI / SQLite / Firebase)             |
|   - 5-Stage Verification Engine                       |
|   - Telemetry Ingestion & Boundary Logic              |
+---------------------------+---------------------------+
                            |
         +------------------+------------------+
         |                                     | Telegram Dispatch API
         v                                     v
+---------------------------------+   +---------------------------------+
|        Presentation Layer       |   |       External Services         |
|   (React + Vite + Tailwind CSS) |   |  (Telegram Bot API / Google Maps)|
+---------------------------------+   +---------------------------------+
```
---
 Technology Stack
Backend: Python 3.10+, FastAPI, SQLite, Uvicorn, Requests
Frontend: React 18, Vite, Tailwind CSS, Lucide Icons, Firebase Auth SDK
Testing Tools:
Apache JMeter: API assertions, security checks (HTTP 401), Boundary Value Analysis (BVA), and load simulation.
Selenium IDE: Automated UI regression tests, contact CRUD workflows, and RBAC assertion suites.
Project Planning: Atlassian Jira (Agile Sprints & Backlog Management)
---
 Getting Started
1. Prerequisites
Python 3.10+
Node.js 18+ & npm
Git
2. Repository Setup
```bash
git clone https://github.com/accisafe/accisafe.git
cd accisafe
```
---
3. Backend Setup & Run
Navigate to the backend directory:
```bash
   cd backend
   ```
Create and activate a virtual environment:
```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\activate

   # Linux/macOS
   python3 -m venv venv
   source venv/bin/activate
   ```
Install dependencies:
```bash
   pip install -r requirements.txt
   ```
Configure Environment Variables (`.env`):
```env
   TELEGRAM_BOT_TOKEN="YOUR_TELEGRAM_BOT_TOKEN"
   TELEGRAM_CHAT_ID="YOUR_TELEGRAM_CHAT_ID"
   DATABASE_URL="sqlite:///./accisafe.db"
   ```
Launch the FastAPI backend server:
```bash
   uvicorn main:app --reload --port 8000
   ```
Access Interactive Swagger API Docs at: `http://localhost:8000/docs`
---
4. Frontend Setup & Run
Open a new terminal and navigate to the frontend directory:
```bash
   cd frontend
   ```
Install frontend packages:
```bash
   npm install
   ```
Launch the Vite development server:
```bash
   npm run dev
   ```
Access Dashboard at: `http://localhost:5173`
---
5. Running the IoT Telemetry Simulator
To simulate continuous sensor data streaming and trigger test crash events:
```bash
cd backend/simulator
python continuous_simulator.py
```
---
 Automated Testing
Apache JMeter (Backend API Suite)
Open Apache JMeter.
Load the test plan located at `tests/jmeter/accisafe_api_tests.jmx`.
Execute the thread group to run authentication security checks, BVA threshold tests, and sensor payload validations.
Selenium IDE (Frontend UI Suite)
Launch the Selenium IDE browser extension.
Open the project file located at `tests/selenium/accisafe_ui_tests.side`.
Select `Run all tests` to automate login, contact creation/deletion, and routing assertions.
---
