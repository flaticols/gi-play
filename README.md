# gi Playground

Web-based Go interpreter playground using [emicklei/gi](https://github.com/emicklei/gi).

## Quick Start

```bash
# Run locally
make run

# Or with go directly
go run .
```

Open http://localhost:8080

## Features

- Monaco editor with Go syntax highlighting
- Auto light/dark theme based on system preference
- Share snippets via URL (`/s/{ulid}`)
- Embeddable widget for blogs (`/embed/{ulid}`)
- PWA installable

## Development

```bash
# Use local gi (../gi directory)
make dev-local

# Switch back to remote gi
make dev-remote

# Run in dev mode
make dev
```

## Build & Deploy

```bash
# Build binary
make build

# Docker
make docker-build
make docker-run

# Apple Container
make container-build
make container-run
```

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/run` | POST | Execute Go code |
| `/api/share` | POST | Save snippet, returns `{id}` |
| `/api/s/{id}` | GET | Get snippet code |

## Configuration

```bash
./gi-playground -addr :8080 -db snippets.db
```

## Security Note

The gi interpreter has access to Go's standard library (os, os/exec, etc.). For production, run inside a container with restricted permissions.

## License

MIT
