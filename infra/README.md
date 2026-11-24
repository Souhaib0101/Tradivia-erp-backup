# Infrastructure status

Docker deployment is intentionally **not supported in the current release**.
The old Compose definition referenced missing Dockerfiles and could never build.
In addition, faithful PDF export on Windows uses Microsoft Word through COM,
which is not available inside a normal Linux container.

Use the documented local startup instead:

```powershell
npm install
npm run dev:api
npm run dev:web
```

The retained `docker-compose.yml` is an empty, explicitly deprecated Compose
model so that it cannot be mistaken for a deployable configuration.

A future container deployment should be introduced only together with:

- tested API and web Dockerfiles;
- persistent volumes for SQLite and uploads;
- secrets and CORS configuration;
- health checks;
- a documented LibreOffice-based PDF path, or a DOCX-only limitation;
- automated container integration tests.
