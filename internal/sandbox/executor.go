package sandbox

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"time"
)

// Executor defines how code is executed.
type Executor interface {
	Execute(ctx context.Context, source string, cfg Config) Result
}

// LocalExecutor runs code in-process via the gi interpreter.
// No memory isolation from the host process.
type LocalExecutor struct{}

func (l *LocalExecutor) Execute(ctx context.Context, source string, cfg Config) Result {
	return Execute(ctx, source, cfg)
}

// SubprocessExecutor runs the gi interpreter in a separate OS process
// for memory isolation. The host binary is re-invoked with --exec flag.
type SubprocessExecutor struct {
	Binary string // path to the gi-playground binary
}

func NewSubprocessExecutor() *SubprocessExecutor {
	binary, _ := os.Executable()
	return &SubprocessExecutor{Binary: binary}
}

func (s *SubprocessExecutor) Execute(ctx context.Context, source string, cfg Config) Result {
	start := time.Now()

	execCtx, cancel := context.WithTimeout(ctx, cfg.Timeout)
	defer cancel()

	cmd := exec.CommandContext(execCtx, s.Binary, "--exec")
	cmd.Stdin = bytes.NewReader([]byte(source))

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		// If the context timed out, report timeout
		if execCtx.Err() == context.DeadlineExceeded {
			return Result{
				Error:    "execution timeout",
				Duration: time.Since(start).Milliseconds(),
			}
		}
		// If stderr has content, it's likely a parse/runtime error captured as JSON
		if stderr.Len() > 0 {
			return Result{
				Error:    stderr.String(),
				Duration: time.Since(start).Milliseconds(),
			}
		}
		return Result{
			Error:    fmt.Sprintf("execution failed: %v", err),
			Duration: time.Since(start).Milliseconds(),
		}
	}

	// Parse JSON result from subprocess stdout
	var result Result
	if err := json.Unmarshal(stdout.Bytes(), &result); err != nil {
		return Result{
			Output:   stdout.String(),
			Duration: time.Since(start).Milliseconds(),
		}
	}
	return result
}

// CloudflareExecutor sends code to a remote Cloudflare Container for execution.
type CloudflareExecutor struct {
	Endpoint   string
	APIToken   string
	HTTPClient *http.Client
}

func NewCloudflareExecutor(endpoint, apiToken string) *CloudflareExecutor {
	return &CloudflareExecutor{
		Endpoint: endpoint,
		APIToken: apiToken,
		HTTPClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

func (c *CloudflareExecutor) Execute(ctx context.Context, source string, cfg Config) Result {
	start := time.Now()

	payload, _ := json.Marshal(map[string]string{"code": source})
	req, err := http.NewRequestWithContext(ctx, "POST", c.Endpoint, bytes.NewReader(payload))
	if err != nil {
		return Result{Error: fmt.Sprintf("request creation failed: %v", err), Duration: time.Since(start).Milliseconds()}
	}
	req.Header.Set("Content-Type", "application/json")
	if c.APIToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.APIToken)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return Result{Error: fmt.Sprintf("execution request failed: %v", err), Duration: time.Since(start).Milliseconds()}
	}
	defer resp.Body.Close()

	var result Result
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return Result{Error: fmt.Sprintf("failed to parse response: %v", err), Duration: time.Since(start).Milliseconds()}
	}

	return result
}
