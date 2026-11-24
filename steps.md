# Tradivia Local Setup Steps

Use these steps to install and run Tradivia System on a new Windows laptop.

## 1. Install Required Software

Install these first:

- Git: https://git-scm.com/download/win
- Node.js 20 LTS or 22 LTS: https://nodejs.org/
- Python 3: https://www.python.org/downloads/windows/
- Microsoft Word, required for PDF export on Windows

Recommended: use Node.js 20 LTS. Node.js 24 can require Visual Studio C++ Build Tools for `better-sqlite3`, which can make `npm install` fail.

If you must use Node.js 24, install Visual Studio Build Tools with the `Desktop development with C++` workload.

## 2. Clone The Project

Open PowerShell and run:

```powershell
git clone https://github.com/Souhaib0101/Tradivia-system-local.git
cd Tradivia-system-local
```

## 3. Install Node Dependencies

From the project root:

```powershell
npm install
```

If `npm install` fails on `better-sqlite3`, switch to Node.js 20 LTS and run `npm install` again.

## 4. Install Python Dependencies

Create the local Python environment:

```powershell
py -3 -m venv .python
.\.python\Scripts\python.exe -m pip install -r workers\documents\requirements.txt
```

The project automatically detects `.python\Scripts\python.exe` on Windows.

## 5. Configure Environment Variables

Copy the example environment file:

```powershell
Copy-Item .env.example .env
```

For normal local use, the default values are enough:

```env
PORT=3001
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
VITE_API_URL=http://localhost:3001/api
ADMIN_DEFAULT_PASSWORD=ChangeMe123!
```

If you change the frontend port, update both `CORS_ORIGIN` and `VITE_API_URL`.

Example for frontend port `5174` and backend port `3002`:

```env
PORT=3002
CORS_ORIGIN=http://localhost:5174,http://127.0.0.1:5174
VITE_API_URL=http://localhost:3002/api
```

## 6. Start The Backend

Open a first PowerShell terminal in the project root:

```powershell
npm run dev:api
```

Default API URL:

```text
http://localhost:3001
```

Health check:

```text
http://localhost:3001/health
```

Keep this terminal open while using the app.

## 7. Start The Frontend

Open a second PowerShell terminal in the project root:

```powershell
npm run dev:web
```

Default app URL:

```text
http://localhost:5173
```

If port `5173` is already used, run:

```powershell
$env:VITE_API_URL='http://localhost:3002/api'
npm run dev -w @tradivia/web -- --port 5174
```

In that case, start the backend with matching values:

```powershell
$env:PORT='3002'
$env:CORS_ORIGIN='http://localhost:5174,http://127.0.0.1:5174'
npm run dev:api
```

## 8. Login

On first startup, use:

```text
Username: admin
Password: ChangeMe123!
```

Change the password before using the app seriously.

## 9. Useful Checks

Run API tests:

```powershell
npm test
```

Build the frontend:

```powershell
npm run build -w @tradivia/web
```

Run document worker tests:

```powershell
.\.python\Scripts\python.exe -m unittest discover -s workers\documents -p "test*.py" -v
```

## 10. Common Problems

If login is blocked by CORS:

- Confirm the frontend URL is listed in `CORS_ORIGIN`.
- Confirm `VITE_API_URL` points to the backend port.
- Restart both backend and frontend after changing `.env`.

If the API says the port is already active:

- Another API process is already running.
- Use the existing one, or stop it with `Ctrl+C`.

If PDF export fails:

- Start the API from a normal interactive Windows session.
- Confirm Microsoft Word is installed.
- Confirm Python dependencies were installed.

If `npm install` fails on `better-sqlite3`:

- Use Node.js 20 LTS, or install Visual Studio Build Tools with C++ support.
