# Build stage
FROM golang:1.26.1-alpine3.23 AS builder

WORKDIR /app

RUN apk add --no-cache git gcc musl-dev

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o gi-playground .

# Runtime stage — Alpine + Go toolchain (gi needs `go` for package loading)
FROM golang:1.26.1-alpine3.23

RUN apk add --no-cache su-exec && \
    adduser -D -u 1000 gi && \
    mkdir -p /data /tmp

COPY --from=builder /app/gi-playground /app/gi-playground
COPY <<'EOF' /app/entrypoint.sh
#!/bin/sh
chown -R gi:gi /data
exec su-exec gi ./gi-playground "$@"
EOF

RUN chmod +x /app/entrypoint.sh

WORKDIR /app
EXPOSE 8080

ENTRYPOINT ["./entrypoint.sh"]
CMD ["-addr", ":8080", "-db", "/data/snippets.db"]
