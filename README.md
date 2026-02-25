# STARLABS

S.T.A.R. Labs

## Local Development

### Database (Postgres)

The project uses a local Postgres database via Docker for development.

#### Start the database

```bash
docker compose -f infra/docker-compose.yml up -d
```

#### Stop the database

```bash
docker compose -f infra/docker-compose.yml down
```

### Backend (Express)

From the project root:

```bash
cd backend
npm install
npm run dev
```

Backend runs at:

http://localhost:4000

### Frontend (React + Vite)

From the project root:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at:

http://localhost:5173

### Important notes

- Docker must be running before starting the database

- Backend and frontend are run in separate terminals

- Environment variables are defined in .env.example files
