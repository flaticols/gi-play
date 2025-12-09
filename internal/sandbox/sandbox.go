// Package sandbox provides safe execution of Go code via the gi interpreter.
package sandbox

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"sync"
	"time"

	"github.com/emicklei/gi"
)

// Default limits
const (
	DefaultTimeout   = 5 * time.Second
	DefaultMaxOutput = 64 * 1024 // 64KB
)

var (
	ErrTimeout       = errors.New("execution timeout")
	ErrOutputTooLong = errors.New("output exceeds maximum length")
)

// Result holds the execution result.
type Result struct {
	Output   string `json:"output"`
	Error    string `json:"error,omitempty"`
	Duration int64  `json:"duration_ms"`
}

// Config holds sandbox configuration.
type Config struct {
	Timeout   time.Duration
	MaxOutput int
}

// DefaultConfig returns the default sandbox configuration.
func DefaultConfig() Config {
	return Config{
		Timeout:   DefaultTimeout,
		MaxOutput: DefaultMaxOutput,
	}
}

// execution mutex - gi is not thread-safe for stdout capture
var execMu sync.Mutex

// Execute runs the provided Go source code in a sandboxed environment.
func Execute(ctx context.Context, source string, cfg Config) Result {
	execMu.Lock()
	defer execMu.Unlock()

	start := time.Now()

	// Create pipe to capture stdout/stderr
	oldStdout := os.Stdout
	oldStderr := os.Stderr
	r, w, err := os.Pipe()
	if err != nil {
		return Result{
			Error:    fmt.Sprintf("failed to create pipe: %v", err),
			Duration: time.Since(start).Milliseconds(),
		}
	}

	os.Stdout = w
	os.Stderr = w

	// Channel for captured output
	outputCh := make(chan string, 1)
	go func() {
		var buf bytes.Buffer
		io.CopyN(&buf, r, int64(cfg.MaxOutput))
		outputCh <- buf.String()
	}()

	// Channel for execution result
	type execResult struct {
		err error
	}
	done := make(chan execResult, 1)

	// Create timeout context
	execCtx, cancel := context.WithTimeout(ctx, cfg.Timeout)
	defer cancel()

	go func() {
		defer func() {
			if rec := recover(); rec != nil {
				done <- execResult{err: fmt.Errorf("panic: %v", rec)}
			}
		}()

		// Parse source
		pkg, err := gi.ParseSource(source)
		if err != nil {
			done <- execResult{err: fmt.Errorf("parse error: %w", err)}
			return
		}

		// Call main function
		_, err = gi.Call(pkg, "main")
		if err != nil {
			done <- execResult{err: fmt.Errorf("runtime error: %w", err)}
			return
		}

		done <- execResult{err: nil}
	}()

	// Wait for completion or timeout
	var execErr error
	select {
	case <-execCtx.Done():
		execErr = ErrTimeout
	case res := <-done:
		execErr = res.err
	}

	// Restore stdout/stderr and close pipe
	w.Close()
	os.Stdout = oldStdout
	os.Stderr = oldStderr

	output := <-outputCh
	r.Close()

	result := Result{
		Output:   output,
		Duration: time.Since(start).Milliseconds(),
	}
	if execErr != nil {
		result.Error = execErr.Error()
	}
	return result
}
