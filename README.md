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

## API Contract (Upload Flow)

Frontend upload flow uses a presign-style pattern:

1. POST /api/v1/uploads/presign  
   Req: { filename, contentType }  
   Res: { uploadUrl, method: "PUT", headers, fileUrl }

2. PUT {uploadUrl}  
   Uploads raw file bytes using returned headers.

3. POST /api/v1/images  
   Req: { fileUrl, originalName, contentType }  
   Res: { id, fileUrl, createdAt }

Note: In local development, `presign` returns an upload URL pointing to our backend (local presign). This keeps the frontend flow identical and allows swapping to S3 later without UI changes.

## API Contract (User Registration - SCRUM-18)

POST /api/v1/auth/register

Request:

```json
{ "email": "test@example.com", "password": "Password123!" }
```

Response (201 Created):

```json
{ "id": "string", "email": "test@example.com", "createdAt": "ISO-8601 string" }
```

Error Responses:

- 400 Bad Request — invalid email or password

- 409 Conflict — email already registered

Notes:

- Temporary in-memory storage is used until SCRUM-17 (Postgres schema) is merged.

- Passwords are hashed using bcrypt and are never returned in API responses.

## API Contract (User Login - SCRUM-19)

POST /api/v1/auth/login

Request:

```json
{ "email": "test@example.com", "password": "Password123!" }
```

Response (200 OK):

```json
{
  "token": "JWT token",
  "user": {
    "id": "string",
    "email": "test@example.com",
    "createdAt": "ISO-8601 string"
  }
}
```

Error Responses:

- 400 Bad Request — missing email or password

- 401 Unauthorized — invalid credentials

Notes:

- Temporary in-memory lookup is used until SCRUM-17 (Postgres schema) is merged.

- JWT is signed using JWT_SECRET.
