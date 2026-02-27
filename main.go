package main

import (
	"context"
	"encoding/json"
	"flag"
	"io"
	"log"
	"os"
	"time"

	"github.com/flaticols/gi-play/internal/sandbox"
)

func main() {
	addr := flag.String("addr", ":8080", "HTTP listen address")
	ttl := flag.Duration("ttl", 24*time.Hour, "Snippet expiration time")
	cfEndpoint := flag.String("cf-endpoint", "", "Cloudflare sandbox endpoint URL (empty = local execution)")
	cfToken := flag.String("cf-token", "", "Cloudflare API token")
	execMode := flag.Bool("exec", false, "Execute code from stdin and exit (used internally by subprocess executor)")
	flag.Parse()

	// Subprocess execution mode: read code from stdin, execute, write JSON result to stdout
	if *execMode {
		runExec()
		return
	}

	if err := run(Config{
		Addr:               *addr,
		SnippetTTL:         *ttl,
		CloudflareEndpoint: *cfEndpoint,
		CloudflareToken:    *cfToken,
	}); err != nil {
		log.Fatal(err)
	}
}

// runExec handles the --exec subprocess mode.
// Reads Go source from stdin, executes it, and writes the JSON result to stdout.
func runExec() {
	code, err := io.ReadAll(os.Stdin)
	if err != nil {
		result := sandbox.Result{Error: "failed to read stdin: " + err.Error()}
		json.NewEncoder(os.Stdout).Encode(result)
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), sandbox.DefaultTimeout)
	defer cancel()

	result := sandbox.Execute(ctx, string(code), sandbox.DefaultConfig())
	json.NewEncoder(os.Stdout).Encode(result)
}
