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

	"github.com/flaticols/gi-play/internal/explore"
	"github.com/flaticols/gi-play/internal/sandbox"
	"github.com/flaticols/gi-play/internal/session"
	"github.com/flaticols/gi-play/internal/store"
	"github.com/flaticols/gi-play/web"
)

// Config holds application configuration.
type Config struct {
	Addr   string
	DBPath string
}

// run starts the playground server with the given configuration.
func run(cfg Config) error {
	// Initialize store
	snippetStore, err := store.New(cfg.DBPath)
	if err != nil {
		return err
	}
	defer snippetStore.Close()

	// Initialize session store for explore mode
	sessionStore := session.NewStore()
	defer sessionStore.Close()

	// Initialize explore handler
	exploreHandler := explore.NewHandler(sessionStore)

	// Setup routes
	mux := http.NewServeMux()

	// API endpoints
	mux.HandleFunc("GET /api/version", handleVersion)
	mux.HandleFunc("POST /api/run", handleRun)
	mux.HandleFunc("POST /api/run-explore", handleRunExplore(sessionStore))
	mux.HandleFunc("POST /api/share", handleShare(snippetStore))
	mux.HandleFunc("GET /api/s/{id}", handleGet(snippetStore))
	mux.HandleFunc("GET /api/explore/{sessionID}/vars", exploreHandler.HandleVars)

	// Explore routes - structexplorer iframe
	mux.Handle("GET /explore/{sessionID}/", exploreHandler)

	// SPA routes - serve index.html for /s/{id} paths
	mux.HandleFunc("GET /s/{id}", handleSPA("index.html"))
	mux.HandleFunc("GET /embed/{id}", handleSPA("embed.html"))

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

func handleRun(w http.ResponseWriter, r *http.Request) {
	var req runRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.Code) == "" {
		http.Error(w, "code is required", http.StatusBadRequest)
		return
	}

	result := sandbox.Execute(r.Context(), req.Code, sandbox.DefaultConfig())

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

type exploreResponse struct {
	Output    string   `json:"output"`
	Error     string   `json:"error,omitempty"`
	Duration  int64    `json:"duration_ms"`
	SessionID string   `json:"session_id,omitempty"`
	Variables []string `json:"variables,omitempty"`
}

func handleRunExplore(sessions *session.Store) http.HandlerFunc {
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

		result := sandbox.ExecuteWithExplore(r.Context(), req.Code, sandbox.DefaultConfig())

		resp := exploreResponse{
			Output:    result.Output,
			Error:     result.Error,
			Duration:  result.Duration,
			Variables: result.Variables,
		}

		// Only create session if we have explorable state
		if result.Package != nil && len(result.Variables) > 0 {
			resp.SessionID = sessions.Save(result.Package, result.Variables)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
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
