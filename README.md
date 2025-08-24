Mini Task Scheduler — Demo Package
==================================

Files included:
- backend/scheduler.c         : C CLI backend (file-based tasks, logging)
- backend/config.json
- backend/tasks_example.txt
- frontend/dashboard.html
- frontend/history.html
- frontend/about.html
- frontend/index.html        : main single-page app (dashboard-style)
- frontend/styles.css
- frontend/theme.js
- frontend/app.js
- frontend/script.js
- frontend/manifest.webmanifest
- frontend/sw.js
- assets/ (placeholder images/icons)

Quick run instructions (demo):
1. Serve frontend: open terminal in frontend/ and run:
   python3 -m http.server 8000
   Then open http://localhost:8000/dashboard.html in your browser.

2. Backend: compile the C program (optional for CLI use):
   cd backend
   gcc scheduler.c -o scheduler
   ./scheduler
   The backend is a CLI tool that reads/writes tasks_<username>.txt and log_<username>.txt.

Notes:
- The frontend is standalone and shows a polished UI with dark/light mode that persists.
- Fullscreen mobile reminders are implemented as in-browser fullscreen modals triggered by polling notifications.json written by a separate scheduler daemon (you can simulate by editing files).
- This package is tailored for a quick demo; you can extend with a small server to connect frontend <-> backend if you want.
