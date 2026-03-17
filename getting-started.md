# Getting Started

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Node.js](https://nodejs.org/) 18+ (for frontend services and NestJS backends)
- [Python](https://www.python.org/) 3.10 (for FastAPI backends)
- Git

## Project Structure

```
OpenAgriNet/
├── OAN-Provider-Service/     # NestJS — provider catalog management
├── OAN-Seeker-Service/       # NestJS — seeker middleware & caching
├── oan-ai-api/               # FastAPI — core AI services
├── bharat-oan-api/           # FastAPI — national India deployment
├── mh-oan-api/               # FastAPI — Maharashtra deployment
├── amul-oan-api-check/       # FastAPI — AMUL dairy deployment
├── amul/                     # FastAPI + Temporal — veterinary OCR pipeline
├── voice-oan-api/            # FastAPI — voice interface
├── oan-ui-service/           # React/Vite — main UI
├── OAN-Provider-UI/          # React/Vite — provider dashboard
├── OAN-Seeker-UI/            # React/Vite — seeker dashboard
└── code/beckn-providers/     # Beckn protocol providers
```

## Infrastructure Services

All backend services depend on some combination of these infrastructure components. Run them with Docker:

### Redis

Session cache, suggestions cache, and search cache.

```bash
docker run -d --name redis-stack \
  -p 6379:6379 \
  -p 8001:8001 \
  redis/redis-stack:latest
```

Redis UI available at `http://localhost:8001`.

### PostgreSQL

Relational database for provider catalogs, items, and user data.

```bash
docker run -d --name postgres \
  -p 5432:5432 \
  -e POSTGRES_USER=hasura \
  -e POSTGRES_PASSWORD=hasura \
  -e POSTGRES_DB=hasura_db \
  postgres:15
```

### Hasura

GraphQL engine over PostgreSQL. Provides real-time subscriptions and row-level permissions.

```bash
docker run -d --name hasura \
  -p 8080:8080 \
  -e HASURA_GRAPHQL_DATABASE_URL=postgres://hasura:hasura@host.docker.internal:5432/hasura_db \
  -e HASURA_GRAPHQL_ADMIN_SECRET=your_admin_secret \
  -e HASURA_GRAPHQL_ENABLE_CONSOLE=true \
  hasura/graphql-engine:latest
```

Hasura console at `http://localhost:8080`.

### Marqo

Vector search engine for semantic retrieval over agricultural content.

```bash
docker run -d --name marqo \
  -p 8882:8882 \
  marqoai/marqo:latest
```

### MinIO

S3-compatible object storage for documents and media.

```bash
docker run -d --name minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin123 \
  minio/minio server /data --console-address ":9001"
```

MinIO console at `http://localhost:9001` (minioadmin / minioadmin123).

## Backend Services

### NestJS Services (Provider & Seeker)

Both NestJS services follow the same pattern:

```bash
cd OAN-Provider-Service   # or OAN-Seeker-Service
npm install
npm run start:dev
```

**Required environment variables** — create a `.env` file:

```bash
# Database
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=hasura
DB_PASSWORD=hasura
DB_NAME=hasura_db

# Hasura
HASURA_URL=http://localhost:8080/v1/graphql
HASURA_GRAPHQL_ADMIN_SECRET=your_admin_secret

# S3 / MinIO
S3_REGION=us-east-1
S3_BUCKET=oan-uploads
ACCESS_KEY_ID=minioadmin
SECRET_ACCESS_KEY=minioadmin123

# Beckn (Provider Service only)
DOMAIN=schemes:oan
BAP_ID=your_bap_id
BAP_URI=your_bap_uri
```

**With Docker:**

```bash
cd OAN-Provider-Service
docker build -t oan-provider-service .
docker run -d --name provider-service \
  -p 3000:3000 \
  --env-file .env \
  oan-provider-service
```

### FastAPI Services (AI APIs)

All Python services follow the same pattern. Example with `mh-oan-api`:

```bash
cd mh-oan-api
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Required environment variables** — create a `.env` file:

```bash
# LLM Configuration
LLM_PROVIDER=openai          # or: vllm, anthropic
LLM_MODEL_NAME=gpt-4.1
OPENAI_API_KEY=your_key

# For vLLM (alternative)
# INFERENCE_ENDPOINT_URL=http://your-vllm-endpoint
# INFERENCE_API_KEY=your_key

# Vector Search
MARQO_ENDPOINT_URL=http://localhost:8882
MARQO_INDEX_NAME=your_index_name

# Cache
REDIS_HOST=localhost
REDIS_PORT=6379

# Beckn Protocol
BAP_ID=your_bap_id
BAP_URI=your_bap_uri
BAP_ENDPOINT=your_bap_endpoint

# Speech Services
MEITY_API_KEY_VALUE=your_bhashini_key    # Bhashini TTS/STT

# Maps
MAPBOX_API_TOKEN=your_mapbox_token
```

**With Docker:**

```bash
cd mh-oan-api
docker build -t mh-oan-api .
docker run -d --name mh-oan-api \
  -p 8000:8000 \
  --env-file .env \
  mh-oan-api
```

### Service Variants

Each FastAPI service uses the same setup pattern with variant-specific defaults:

| Service | Directory | Default Language | Key Differences |
|---------|-----------|-----------------|-----------------|
| OAN AI API | `oan-ai-api/` | Hindi (hi) | Core AI service |
| Bharat OAN | `bharat-oan-api/` | Hindi (hi) | National schemes focus |
| MahaVistaar | `mh-oan-api/` | Marathi (mr) | Maharashtra-specific tools |
| AMUL OAN | `amul-oan-api-check/` | Marathi (mr) | Dairy/veterinary, voice-first |
| Voice OAN | `voice-oan-api/` | Marathi (mr) | Voice interface |

### AMUL Veterinary Pipeline

The OCR pipeline has additional infrastructure requirements:

```bash
cd amul
docker compose up -d
```

This starts:
- **Temporal Server** (:7233) — workflow orchestration
- **Temporal UI** (:8080) — workflow visualization
- **Marqo** (:8882) — vector search
- **MinIO** (:9000) — document storage
- **Lang Detect** (:3000) — language detection microservice
- **Pipeline API** (:8001) — FastAPI REST API
- **Pipeline Worker** — document processing

Additional required environment variable:
```bash
MISTRAL_API_KEY=your_mistral_key   # For OCR processing
```

**Without Docker Compose** (local development):

```bash
# Terminal 1: Temporal server
temporal server start-dev

# Terminal 2: Pipeline worker
pip install -r requirements.txt
python -m pipeline.worker

# Terminal 3: API server
uvicorn pipeline.api:app --reload --port 8001

# Terminal 4: UI (optional)
cd ui && npm install && npm run dev
```

## Frontend Services

All React/Vite frontends follow the same pattern:

```bash
cd oan-ui-service   # or OAN-Provider-UI, OAN-Seeker-UI
npm install
npm run dev
```

| Service | Directory | Port | UI Framework |
|---------|-----------|------|-------------|
| Main UI | `oan-ui-service/` | 5173 | Tailwind + Radix UI |
| Provider Dashboard | `OAN-Provider-UI/` | 5173 | Ant Design + Chakra UI |
| Seeker Dashboard | `OAN-Seeker-UI/` | 5173 | Material UI |

**Production build:**

```bash
npm run build      # Outputs to dist/
npm run preview    # Preview the build locally
```

**With Docker:**

```bash
cd oan-ui-service
docker build -t oan-ui .
docker run -d --name oan-ui -p 8081:8081 oan-ui
```

Frontend Docker builds use a multi-stage approach: Node 18 for building, nginx for serving.

## Environment Variable Reference

### Required for All FastAPI Services

| Variable | Description | Example |
|----------|-------------|---------|
| `LLM_PROVIDER` | LLM backend | `openai`, `vllm`, `anthropic` |
| `LLM_MODEL_NAME` | Model identifier | `gpt-4.1` |
| `OPENAI_API_KEY` | API key (if using OpenAI) | `sk-...` |
| `MARQO_ENDPOINT_URL` | Marqo search endpoint | `http://localhost:8882` |
| `MARQO_INDEX_NAME` | Search index name | `oan-index` |
| `REDIS_HOST` | Redis hostname | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |

### Required for Beckn Integration

| Variable | Description | Example |
|----------|-------------|---------|
| `BAP_ID` | Beckn Application Platform ID | `your-bap-id` |
| `BAP_URI` | BAP callback URI | `https://your-bap.com` |
| `BAP_ENDPOINT` | BAP API endpoint | `https://api.your-bap.com` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `MEITY_API_KEY_VALUE` | Bhashini speech services API key | — |
| `MAPBOX_API_TOKEN` | Mapbox geocoding token | — |
| `INFERENCE_ENDPOINT_URL` | vLLM endpoint (if using vLLM) | — |
| `INFERENCE_API_KEY` | vLLM API key | — |
| `ANTHROPIC_API_KEY` | Anthropic key (if using Claude) | — |
| `ELEVEN_LABS_API_KEY` | Eleven Labs TTS key | — |
| `USE_TRANSLATION_PIPELINE` | Enable translation pipeline | `false` |

## API Authentication

All API endpoints require JWT Bearer tokens using RS256 algorithm. Each service expects a public key at `jwt_public_key.pem` in the service root.

```bash
# Example: calling the chat endpoint
curl -H "Authorization: Bearer <your_jwt_token>" \
  "http://localhost:8000/api/chat?query=weather+in+pune&source_lang=en&target_lang=en&session_id=test"
```

## Verifying Your Setup

Once services are running, verify with health checks:

```bash
# Infrastructure
curl http://localhost:6379/ping              # Redis (via redis-cli)
curl http://localhost:8882                    # Marqo
curl http://localhost:8080/healthz            # Hasura
curl http://localhost:9000/minio/health/live  # MinIO

# Backend services
curl http://localhost:3000/health             # Provider Service
curl http://localhost:8000/api/health         # FastAPI services
```
