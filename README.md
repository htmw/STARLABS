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
