package main

import (
	"context"
	"encoding/json"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"runtime/debug"
	"strings"
	"syscall"
	"time"

	"github.com/flaticols/gi-play/internal/sandbox"
	"github.com/flaticols/gi-play/internal/store"
	"github.com/flaticols/gi-play/web"
)

// Config holds application configuration.
type Config struct {
	Addr               string
	SnippetTTL         time.Duration
	CloudflareEndpoint string
	CloudflareToken    string
}

// run starts the playground server with the given configuration.
func run(cfg Config) error {
	// Initialize store
	snippetStore := store.New(cfg.SnippetTTL)
	defer snippetStore.Close()

	// Initialize executor
	var executor sandbox.Executor
	if cfg.CloudflareEndpoint != "" {
		executor = sandbox.NewCloudflareExecutor(cfg.CloudflareEndpoint, cfg.CloudflareToken)
		log.Println("Using Cloudflare Sandbox executor")
	} else {
		executor = sandbox.NewSubprocessExecutor()
		log.Println("Using subprocess executor (isolated)")
	}

	// Setup routes
	mux := http.NewServeMux()

	// API endpoints
	mux.HandleFunc("GET /api/version", handleVersion)
	mux.HandleFunc("POST /api/run", handleRun(executor))
	mux.HandleFunc("POST /api/share", handleShare(snippetStore))
	mux.HandleFunc("GET /api/s/{id}", handleGet(snippetStore))

	// SPA routes - serve index.html for /s/{id} paths
	mux.HandleFunc("GET /s/{id}", handleSPA("index.html"))
	mux.HandleFunc("GET /embed/{id}", handleSPA("embed.html"))
	// Bare /embed/ for code-in-hash embeds (no snippet ID needed)
	mux.HandleFunc("GET /embed/", handleSPA("embed.html"))

	// Static files
	mux.Handle("/", http.FileServer(http.FS(web.FS())))

	server := &http.Server{
		Addr:         cfg.Addr,
		Handler:      withCORS(mux),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		server.Shutdown(ctx)
	}()

	log.Printf("Starting gi-playground on %s", cfg.Addr)
	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		return err
	}
	return nil
}

type runRequest struct {
	Code string `json:"code"`
}

type versionResponse struct {
	GiVersion string `json:"gi_version"`
}

func handleVersion(w http.ResponseWriter, r *http.Request) {
	version := "unknown"
	if info, ok := debug.ReadBuildInfo(); ok {
		for _, dep := range info.Deps {
			if dep.Path == "github.com/emicklei/gi" {
				version = dep.Version
				break
			}
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(versionResponse{GiVersion: version})
}

func handleRun(exec sandbox.Executor) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req runRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		if strings.TrimSpace(req.Code) == "" {
			http.Error(w, "code is required", http.StatusBadRequest)
			return
		}

		result := exec.Execute(r.Context(), req.Code, sandbox.DefaultConfig())

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	}
}

type shareRequest struct {
	Code string `json:"code"`
}

type shareResponse struct {
	ID string `json:"id"`
}

func handleShare(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req shareRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		if strings.TrimSpace(req.Code) == "" {
			http.Error(w, "code is required", http.StatusBadRequest)
			return
		}

		id, err := s.Save(req.Code)
		if err != nil {
			http.Error(w, "failed to save snippet", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(shareResponse{ID: id})
	}
}

type getResponse struct {
	Code string `json:"code"`
}

func handleGet(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if id == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		code, err := s.Get(id)
		if err == store.ErrNotFound {
			http.Error(w, "snippet not found", http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, "failed to get snippet", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(getResponse{Code: code})
	}
}

func handleSPA(filename string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		content, err := fs.ReadFile(web.FS(), filename)
		if err != nil {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(content)
	}
}

func withCORS(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		h.ServeHTTP(w, r)
	})
}
