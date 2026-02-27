# Build stage
FROM golang:1.25.5-alpine3.23 AS builder

WORKDIR /app

# Install git for go mod download
RUN apk add --no-cache git

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o gi-playground .

# Runtime stage
FROM alpine:3.19

WORKDIR /app

# Add non-root user
RUN adduser -D -u 1000 gi

# Copy binary
COPY --from=builder /app/gi-playground .

USER gi

EXPOSE 8080

ENTRYPOINT ["./gi-playground"]
CMD ["-addr", ":8080", "-ttl", "24h"]
