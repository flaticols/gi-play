.PHONY: build run dev clean docker-build docker-run docker-stop container-build container-run container-stop

APP_NAME := gi-playground
IMAGE_NAME := gi-playground
CONTAINER_NAME := gi-playground
PORT := 8080

# Local development
build:
	go build -o $(APP_NAME) .

run: build
	./$(APP_NAME)

dev:
	go run .

# Watch mode with air (restarts on changes in . and ../gi)
watch:
	go tool air

clean:
	rm -f $(APP_NAME) snippets.db

# Docker
docker-build:
	docker build -t $(IMAGE_NAME) .

docker-run:
	docker run -d \
		--name $(CONTAINER_NAME) \
		-p $(PORT):8080 \
		-v gi-playground-data:/data \
		$(IMAGE_NAME)

docker-stop:
	docker stop $(CONTAINER_NAME) && docker rm $(CONTAINER_NAME)

docker-logs:
	docker logs -f $(CONTAINER_NAME)

# Apple Container (containerctl)
container-build:
	container build -t $(IMAGE_NAME) .

container-run:
	container run -d \
		--name $(CONTAINER_NAME) \
		-p $(PORT):8080 \
		-v gi-playground-data:/data \
		$(IMAGE_NAME)

container-stop:
	container stop $(CONTAINER_NAME) && container rm $(CONTAINER_NAME)

container-logs:
	container logs -f $(CONTAINER_NAME)

# Helpers
test:
	go test ./...

fmt:
	go fmt ./...

tidy:
	go mod tidy

# Development with local gi
dev-local:
	@echo "Creating go.work for local gi development..."
	@echo "go 1.25.5" > go.work
	@echo "" >> go.work
	@echo "use (" >> go.work
	@echo "    ." >> go.work
	@echo "    ../gi" >> go.work
	@echo ")" >> go.work
	@echo "go.work created - using local ../gi"

dev-remote:
	@echo "Removing go.work to use remote gi..."
	@rm -f go.work go.work.sum
	@echo "go.work removed - using remote gi from go.mod"
