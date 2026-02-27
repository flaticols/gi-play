// Package store provides in-memory key-value storage for code snippets with TTL-based expiration.
package store

import (
	"crypto/rand"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/oklog/ulid/v2"
)

var ErrNotFound = errors.New("snippet not found")

type entry struct {
	code      string
	expiresAt time.Time
}

// Store manages code snippet storage in memory with TTL-based expiration.
type Store struct {
	mu   sync.RWMutex
	data map[string]entry
	ttl  time.Duration
	done chan struct{}
}

// New creates a new in-memory Store. Snippets expire after the given TTL.
func New(ttl time.Duration) *Store {
	s := &Store{
		data: make(map[string]entry),
		ttl:  ttl,
		done: make(chan struct{}),
	}
	go s.cleanup()
	return s
}

// Close stops the background cleanup goroutine.
func (s *Store) Close() error {
	close(s.done)
	return nil
}

// Save stores a snippet and returns its ID.
func (s *Store) Save(code string) (string, error) {
	id := generateID()

	s.mu.Lock()
	s.data[id] = entry{
		code:      code,
		expiresAt: time.Now().Add(s.ttl),
	}
	s.mu.Unlock()

	return id, nil
}

// Get retrieves a snippet by ID. Returns ErrNotFound if expired or missing.
func (s *Store) Get(id string) (string, error) {
	s.mu.RLock()
	e, ok := s.data[id]
	s.mu.RUnlock()

	if !ok || time.Now().After(e.expiresAt) {
		return "", ErrNotFound
	}
	return e.code, nil
}

// cleanup periodically removes expired entries.
func (s *Store) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-s.done:
			return
		case <-ticker.C:
			s.mu.Lock()
			now := time.Now()
			for id, e := range s.data {
				if now.After(e.expiresAt) {
					delete(s.data, id)
				}
			}
			s.mu.Unlock()
		}
	}
}

// generateID creates a ULID (lowercase for URL friendliness).
func generateID() string {
	entropy := ulid.Monotonic(rand.Reader, 0)
	id := ulid.MustNew(ulid.Timestamp(time.Now()), entropy)
	return strings.ToLower(id.String())
}
