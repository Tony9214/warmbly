# Local Development Guide

This guide explains how to set up and run Warmbly locally for development using Docker Compose.

## Prerequisites

- **Docker** (20.10+) and **Docker Compose** (v2.0+)
- **Git**
- Optional for native development:
  - Go 1.25+
  - Rust (for tracking service)
  - Elixir 1.18+ (for realtime service)
  - Node.js 20+ (for frontend)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/warmbly/warmbly.git
cd warmbly
```

### 2. Start Infrastructure Only

If you want to run services natively but need the infrastructure (database, cache, message queue):

```bash
cd deploy/docker

# Start only infrastructure services
docker compose up -d postgres redis zookeeper kafka schema-registry
```

Wait for all services to be healthy:

```bash
docker compose ps
```

### 3. Start All Services

To run everything in Docker:

```bash
cd deploy/docker
docker compose up
```

This will build and start:
- **postgres** - PostgreSQL 16 database
- **redis** - Redis 7 cache
- **zookeeper** - Kafka coordination
- **kafka** - Message queue
- **schema-registry** - Avro schema registry
- **backend** - Go API server
- **consumer** - Kafka event consumer
- **worker** - Distributed worker
- **tracking** - Rust tracking service
- **realtime** - Elixir WebSocket service

### 4. Run in Background

```bash
docker compose up -d
```

View logs:

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
```

## Service URLs

Once running, services are available at:

| Service | URL | Description |
|---------|-----|-------------|
| Backend API | http://localhost:8080 | REST API |
| Tracking | http://localhost:3000 | Pixel/click tracking |
| Realtime | http://localhost:4000 | WebSocket gateway |
| Schema Registry | http://localhost:8081 | Avro schemas |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Cache |
| Kafka | localhost:9092 | Message queue |

## Database Setup

### Run Migrations

The backend service runs migrations automatically on startup. To run manually:

```bash
# Connect to the backend container
docker compose exec backend sh

# Run migrations (inside container)
go run cmd/migrate/main.go up
```

### Connect to Database

```bash
# Via psql
docker compose exec postgres psql -U warmbly -d warmbly_dev

# Or use any PostgreSQL client with:
# Host: localhost
# Port: 5432
# User: warmbly
# Password: warmbly
# Database: warmbly_dev
```

## Development Workflows

### Backend (Go)

Run natively with hot reload using air:

```bash
# Install air
go install github.com/cosmtrek/air@latest

# Start infrastructure
cd deploy/docker && docker compose up -d postgres redis kafka schema-registry

# Run backend with hot reload (from repo root)
cd ../..
air -c .air.toml
```

Or build and run manually:

```bash
# Set environment variables (see deploy/config/env.example)
export PRIMARY_DB="postgres://warmbly:warmbly@localhost:5432/warmbly_dev?sslmode=disable"
export REDIS="redis://localhost:6379"
# ... other vars

go run cmd/backend/main.go
```

### Frontend (React)

```bash
cd web
npm install
npm run dev
```

Frontend runs at http://localhost:5173 by default.

### Tracking Service (Rust)

```bash
cd tracking

# With cargo watch for hot reload
cargo install cargo-watch
cargo watch -x run

# Or build and run
cargo run
```

### Realtime Service (Elixir)

```bash
cd realtime
mix deps.get
mix phx.server
```

## Environment Variables

All environment variables are documented in `deploy/config/env.example`.

For local Docker development, the `docker-compose.yml` includes sensible defaults. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | dev | Environment mode |
| `PRIMARY_DB` | postgres://warmbly:warmbly@postgres:5432/warmbly_dev | PostgreSQL connection |
| `REDIS` | redis://redis:6379 | Redis connection |
| `KAFKA_BOOTSTRAP_SERVERS` | kafka:29092 | Kafka brokers |
| `AUTH_SECRET` | (auto-generated) | JWT signing secret |

## Common Tasks

### Rebuild a Single Service

```bash
docker compose build backend
docker compose up -d backend
```

### Reset Database

```bash
# Stop services
docker compose down

# Remove postgres volume
docker volume rm docker_postgres_data

# Start fresh
docker compose up -d
```

### View Kafka Topics

```bash
# List topics
docker compose exec kafka kafka-topics --bootstrap-server localhost:9092 --list

# Consume messages from a topic
docker compose exec kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic tracking-events \
  --from-beginning
```

### Check Schema Registry

```bash
# List schemas
curl http://localhost:8081/subjects

# Get specific schema
curl http://localhost:8081/subjects/tracking-events-value/versions/latest
```

## Troubleshooting

### Services Not Starting

1. Check if ports are already in use:
   ```bash
   lsof -i :5432  # PostgreSQL
   lsof -i :6379  # Redis
   lsof -i :9092  # Kafka
   ```

2. Check Docker logs:
   ```bash
   docker compose logs kafka
   docker compose logs backend
   ```

### Kafka Connection Issues

Kafka needs time to start. If services fail to connect:

```bash
# Restart dependent services after Kafka is ready
docker compose restart backend consumer worker tracking
```

### Database Connection Refused

Ensure PostgreSQL is healthy before starting dependent services:

```bash
docker compose up -d postgres
docker compose exec postgres pg_isready -U warmbly
# Should output: "localhost:5432 - accepting connections"
docker compose up -d
```

### Schema Registry Errors

If you see schema compatibility errors:

```bash
# Delete and recreate schemas (development only!)
curl -X DELETE http://localhost:8081/subjects/tracking-events-value
```

## Stopping Services

```bash
# Stop all services
docker compose down

# Stop and remove volumes (full reset)
docker compose down -v
```

## Next Steps

- [Architecture Overview](architecture.md) - Understand the system design
- [Events Documentation](Events.md) - Kafka event system
- [Deployment Guide](deployment-guide.md) - Production deployment
