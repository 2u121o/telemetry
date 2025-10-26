# 🛰️ Telemetry GUI — FastAPI + Modular Frontend

A complete graphical user interface for telemetry data visualization and device management.  
This project combines a **FastAPI backend** for serving APIs and static files with a **modular frontend** (HTML + CSS + JavaScript ES Modules) that dynamically updates content through a client-side router.

---

## 🚀 Key Features

- **Modern responsive interface** with a sidebar and clean dark theme.  
- **Client-side router** (hash-based) that loads HTML fragments (`fragments/`) and their corresponding JS controllers (`routes/`).  
- **Modular architecture**: each page (`sessions`, `device`, `settings`) has its own HTML fragment and JS logic.  
- **Integrated FastAPI backend** with `/api/health` and `/ws/telemetry` endpoints.  
- **Fully local and dependency-light** — no external front-end frameworks required.

---

## 📂 Project Structure

telemetry-gui/
├── backend/
│ ├── app/
│ │ └── main.py # FastAPI app serving the frontend and API
│ ├── requirements.txt # Python dependencies
│ └── run.sh # Quick launch script for development
│
├── frontend/
│ ├── index.html # Main HTML entry point
│ ├── assets/
│ │ ├── style.css # Global dark theme styles
│ │ ├── favicon.svg # Simple SVG icon
│ │ ├── main.js # Entry script initializing router and UI
│ │ ├── router.js # Hash-based client-side router
│ │ ├── services/
│ │ │ └── api.js # Mock API layer (ready for real endpoints)
│ │ ├── utils/
│ │ │ └── dom.js # Small DOM helper utilities
│ │ └── routes/
│ │ ├── sessions.js # Page controller for “Sessions”
│ │ ├── device.js # Page controller for “Device”
│ │ └── settings.js # Page controller for “Settings”
│ │
│ └── fragments/
│ ├── sessions.html # HTML fragment for “Sessions”
│ ├── device.html # HTML fragment for “Device”
│ └── settings.html # HTML fragment for “Settings”
│
└── README.md # This file

## 🧩 Quick Start

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
./run.sh

Then open your browser at:
http://localhost:8000



🖥️ Usage

Sessions — Displays a list of telemetry sessions (mocked data).

Device — Shows device connection status (placeholder).

Settings — Displays basic app preferences (e.g., temperature unit).

Ping API — Calls the /api/health endpoint and shows the response.

Navigation between sections happens instantly, without page reloads.


⚙️ Development Notes

Each page is composed of:

an HTML fragment (frontend/fragments/NAME.html)

a JavaScript controller (frontend/assets/routes/NAME.js)

Controllers export:

mount(root) → called when the page is loaded

unmount() → called before switching pages

To add a new page:

Create a new fragment in frontend/fragments/

Create a corresponding JS module in frontend/assets/routes/

Add the route to the routes map in assets/main.js

Add a link to the sidebar in index.html


🧠 Tips

Use Ctrl + F5 (hard reload) to bypass browser cache when editing frontend files.

A missing or blank right panel usually means the fragment couldn’t be loaded — check the browser console for 404 errors.

The favicon 404 warning is harmless (a small SVG icon is now included).

For production, you can serve the static frontend/ directory with any FastAPI or reverse proxy configuration.