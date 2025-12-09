package session

import (
	"sync"
	"time"

	"github.com/emicklei/gi"
	"github.com/oklog/ulid/v2"
)

const (
	DefaultTTL     = 5 * time.Minute
	CleanupInterval = 1 * time.Minute
)

// Session holds execution state for exploration.
type Session struct {
	ID        string
	Package   *gi.Package
	Variables []string // package-level variable names
	CreatedAt time.Time
	ExpiresAt time.Time
}

// Store manages sessions with TTL-based expiration.
type Store struct {
	mu       sync.RWMutex
	sessions map[string]*Session
	ttl      time.Duration
	stopCh   chan struct{}
}

// NewStore creates a new session store.
func NewStore() *Store {
	s := &Store{
		sessions: make(map[string]*Session),
		ttl:      DefaultTTL,
		stopCh:   make(chan struct{}),
	}
	go s.cleanup()
	return s
}

// Save stores a package and returns a session ID.
func (s *Store) Save(pkg *gi.Package, variables []string) string {
	s.mu.Lock()
	defer s.mu.Unlock()

	id := generateID()
	now := time.Now()

	s.sessions[id] = &Session{
		ID:        id,
		Package:   pkg,
		Variables: variables,
		CreatedAt: now,
		ExpiresAt: now.Add(s.ttl),
	}

	return id
}

// Get retrieves a session by ID.
func (s *Store) Get(id string) (*Session, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	sess, ok := s.sessions[id]
	if !ok {
		return nil, false
	}

	if time.Now().After(sess.ExpiresAt) {
		return nil, false
	}

	return sess, true
}

// Touch extends the session TTL.
func (s *Store) Touch(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if sess, ok := s.sessions[id]; ok {
		sess.ExpiresAt = time.Now().Add(s.ttl)
	}
}

// Delete removes a session.
func (s *Store) Delete(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, id)
}

// Close stops the cleanup goroutine.
func (s *Store) Close() {
	close(s.stopCh)
}

func (s *Store) cleanup() {
	ticker := time.NewTicker(CleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.mu.Lock()
			now := time.Now()
			for id, sess := range s.sessions {
				if now.After(sess.ExpiresAt) {
					delete(s.sessions, id)
				}
			}
			s.mu.Unlock()
		case <-s.stopCh:
			return
		}
	}
}

func generateID() string {
	return ulid.Make().String()
}
