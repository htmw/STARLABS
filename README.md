# STARLABS

KneeVision — AI-assisted knee X-ray analysis platform.

Frontend: React + Vite  
Backend: Node.js + Express  
Database: MongoDB Atlas

## Local Development

### Database (MongoDB Atlas)

The backend uses **MongoDB Atlas** for persistent storage.

Database name:

kneevision

Collections currently used:

- `users` – stores registered users with hashed passwords
- `images` – stores uploaded image metadata

MongoDB automatically creates collections when the first document is inserted.

Environment variables for database access are defined in `.env` files.

### Backend (Express + MongoDB)

From the project root:

```bash
cd backend
npm install
npm run dev
```

Backend runs at:

http://localhost:4000

The backend connects to MongoDB Atlas using the `MONGODB_URI` environment variable.

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

- MongoDB Atlas is used for the database

- Backend and frontend are run in separate terminals

- Environment variables are defined in .env.example files

## Environment Variables

Example backend `.env` file:

MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/kneevision
JWT_SECRET=dev-secret-change-me
PORT=4000

Important: Never commit real credentials or connection strings to GitHub.

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

Note: In local development, `presign` returns an upload URL pointing to our backend (local presign). This keeps the frontend flow identical and allows swapping to S3 later without UI changes. Image metadata is stored in the MongoDB `images` collection after upload.

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

- User data is stored in the MongoDB `users` collection.

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

- Login authenticates users against the MongoDB `users` collection.

- JWT is signed using JWT_SECRET.
