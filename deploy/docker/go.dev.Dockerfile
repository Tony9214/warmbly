# Shared dev image for backend, consumer, and worker.
#
# Unlike the production Dockerfiles (multi-stage, stripped binary),
# this one ships the full Go toolchain + CGO deps + air so the
# container can rebuild on file change. The source tree is mounted in
# at runtime via docker-compose; nothing is COPYd at image build time
# beyond go.mod / go.sum so module download happens once.
#
# Used by docker-compose.yml when WARMBLY_MODE=dev (the default).
# Production deployments still use deploy/docker/{backend,consumer,worker}.Dockerfile.

FROM golang:1.25-alpine

RUN apk add --no-cache \
        git ca-certificates tzdata bash \
        gcc musl-dev librdkafka-dev pkgconf

# air watches the source tree and recompiles on change. Pin a known
# version so dev environments don't drift.
RUN go install github.com/air-verse/air@v1.61.7

WORKDIR /app

# Pre-warm the module cache. The full source mount overlays this at
# runtime; go.mod/go.sum copies here only exist so `go mod download`
# doesn't have to re-fetch every cold start.
COPY go.mod go.sum ./
RUN go mod download

# Source code is bind-mounted at /app by docker-compose. The CMD is
# overridden per-service in compose (each calls `air -c <its-config>`).
CMD ["sh", "-c", "echo 'specify an air config via compose command:'; exit 1"]
