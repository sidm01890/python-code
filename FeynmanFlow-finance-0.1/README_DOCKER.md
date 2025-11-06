Run the app with Docker (Windows cmd.exe focused)

This README explains the exact steps a recipient should follow after cloning the repository from GitHub to run the app using Docker on Windows (cmd.exe). The commands are copy/paste ready.

Prerequisites
- Docker Desktop installed and running on the target machine.
- (Optional) A MySQL server accessible from the container, or adjust `.env` to point to an existing MySQL.

Steps to run (copy these commands into cmd.exe in the repo root):

1) Clone the repository (if not already):

```cmd
cd %USERPROFILE%\Desktop
git clone https://github.com/your-username/FeynmanFlow.git
# Switch to the branch used for this deployment
git checkout finance-0.1
cd FeynmanFlow-3


```

2) Create `.env` in the repository root with your environment variables. Example `.env` contents (use your real credentials):

```
DB_HOST=host.docker.internal
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
SALES_DB_NAME=students

ASTRA_DB_APPLICATION_TOKEN=your_astra_token
ASTRA_DB_API_ENDPOINT=https://<your-astra-endpoint>
ASTRA_DB_KEYSPACE=default_keyspace
```

Notes:
- `host.docker.internal` allows Windows Docker containers to reach services running on the host (useful for local MySQL).
- Keep this file secret and do NOT commit it to git.

3) Build the Docker image:

```cmd
docker build -t feynmanflow:latest .
```

4) Run the container (foreground):

```cmd
docker run --rm -p 8000:8000 --env-file .env feynmanflow:latest
```

Or detached:

```cmd
docker run -d --name feynmanflow -p 8000:8000 --env-file .env feynmanflow:latest
```

5) Verify the server:
- Swagger UI: http://localhost:8000/docs
- Health check: http://localhost:8000/

Stopping the container (if detached):

```cmd
docker stop feynmanflow
```

Troubleshooting
- If the container exits immediately or shows import-time errors, check `docker logs <container-id>` or `docker logs -f feynmanflow`.
- Common causes:
  - Missing or incorrect `.env` variables (DB/Astra credentials)
  - Astra DB connection failing — this repo connects to Astra at import time in some modules; provide valid tokens or I can modify the code to load Astra connections lazily.
  - Missing MySQL instance — use `host.docker.internal` to point the container to host MySQL, or I can provide a `docker-compose.yml` with MySQL.

Optional: run with mounted uploads to persist files

```cmd
docker run --rm -p 8000:8000 --env-file .env -v "%cd%\\uploads:/app/uploads" -v "%cd%\\failed_chunks:/app/failed_chunks" feynmanflow:latest
```

If you'd like, I can make the following improvements next:
- Provide a `docker-compose.yml` that starts MySQL and the app together.
- Make Astra DB and model loading lazy so the container starts even without external services.
- Reduce image size or cache large models outside the Docker build (advanced).

*** End of README_DOCKER.md ***
