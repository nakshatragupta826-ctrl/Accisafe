AcciSafe: IoT Motorcycle Accident Detection & Emergency Response System
AcciSafe is an intelligent, software-simulated IoT safety framework designed to detect motorcycle accidents using continuous multi-sensor telemetry and automatically dispatch emergency alerts via the Telegram Bot API. By leveraging a novel 5-Stage Verification Pipeline, AcciSafe suppresses false positives caused by everyday riding conditions (such as potholes, sudden braking, or phone drops) while ensuring rapid rescue dispatch within seconds of a verified crash.
---
 Features
5-Stage Verification Engine: Cross-evaluates linear acceleration, pre-impact speed, velocity drop, lean angle tilt, and post-impact immobility to eliminate false alarms.
Instant Telegram Dispatch: Delivers emergency alerts featuring interactive Google Maps location pins directly to emergency contacts via Telegram.
Rider Grace Window: Configurable observation window (15–60 seconds) allowing riders to manually cancel false alarms from the web dashboard.
Live Safety Dashboard: Real-time web UI built with React, Vite, and Tailwind CSS to display telemetry stream metrics, accident history, and nearby hospitals.
Emergency Contact Management: Complete CRUD management for rider emergency contacts with phone number validation.
Automated Sensor Simulation: Standalone Python simulator script emitting real-time HTTP sensor telemetry to emulate physical ESP32 and MPU6050 hardware.
---
 Technology Stack
Layer	Technology / Tools
Backend API	Python 3.10+, FastAPI, SQLite, Uvicorn, Requests
Frontend UI	React 18, Vite, Tailwind CSS, Lucide Icons
Authentication	Firebase Auth / JWT Bearer Tokens
Notification Gateway	Telegram Bot API, Firebase Cloud Messaging (FCM)
Testing & QA	Apache JMeter (API & Load Testing), Selenium IDE (Browser Automation)
Agile Management	Atlassian Jira, Git & GitHub
---
 System Architecture
```
                      +-----------------------------+
                      |   IoT Sensor Simulator      |
                      | (MPU6050 Acceleration/Tilt, |
                      |    GPS Speed & Coordinates) |
                      +--------------+--------------+
                                     |
                                     | HTTP POST Payload
                                     v
                      +-----------------------------+
                      |     FastAPI Backend Server  |
                      |  - JWT Authentication       |
                      |  - 5-Stage Verification     |
                      |  - SQLite Data Persistence  |
                      +-------+-------------+-------+
                              |             |
        Observation & Control |             | Emergency Alert
                              v             v
      +-------------------------+   +-------------------------+
      | React Web Dashboard     |   | Telegram Bot API        |
      | - Live Telemetry        |   | - Location Pin Alert    |
      | - Contact Management    |   | - Emergency Dispatch    |
      | - Grace Period Cancel   |   +-------------------------+
      +-------------------------+
```
---
 5-Stage Verification Pipeline
To avoid false alarms caused by routine riding events, telemetry is continuously evaluated across five strict conditions:
Impact Detection: Evaluates linear acceleration against $A \ge 3.0\text{ g}$.
Pre-Impact Speed Verification: Checks if the vehicle was traveling at a moving velocity prior to impact.
Deceleration Analysis: Verifies sudden drop in speed ($\Delta V > V_{\text{threshold}}$).
Lean Angle Tilt: Measures angular inclination exceeding $45^\circ$.
Observation & Grace Window: Activates a countdown timer during which the rider can manually cancel the alert before Telegram dispatch.
---
 Getting Started
Prerequisites
Python 3.10+
Node.js 18+ & `npm`
Telegram Bot Token & Chat ID (Obtained via @BotFather)
1. Backend Setup
```bash
# Clone the repository
git clone https://github.com/your-username/accisafe.git
cd accisafe/backend

# Create and activate a virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install required dependencies
pip install -r requirements.txt

# Create .env file for configuration
cp .env.example .env
```
Add your Telegram credentials to `.env`:
```env
TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
TELEGRAM_CHAT_ID="your_telegram_chat_id"
DATABASE_URL="sqlite:///./accisafe.db"
```
Start the FastAPI server:
```bash
uvicorn main:app --reload --port 8000
```
API interactive documentation will be available at: `http://localhost:8000/docs`
---
2. Frontend Setup
```bash
cd ../frontend

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```
Access the web dashboard at: `http://localhost:5173`
---
3. Running Sensor Telemetry Simulation
To simulate crash telemetry and trigger the pipeline:
```bash
cd ../backend
python continuous_simulator.py
```
---
 Testing & Quality Assurance
Apache JMeter (Backend API Suite)
Security Validation (`SEC-01`–`SEC-04`): Confirms `HTTP 401 Unauthorized` for unauthenticated requests.
Boundary Value Analysis (`BVA-01`–`BVA-07`): Validates precise pipeline thresholds ($3.99\text{ g}$ vs $4.00\text{ g}$, $44^\circ$ vs $45^\circ$).
Load Testing: Simulates multi-user concurrent telemetry streams.
Selenium IDE (Frontend Automation)
Authentication Workflows: Tests login validation, incorrect password errors, and duplicate registration protection.
Contact CRUD: Validates emergency contact addition, form regex rules (short phone number rejection), and deletion dialogs.
RBAC Assertions: Ensures non-admin accounts are restricted from accessing system settings and admin functions.
---
