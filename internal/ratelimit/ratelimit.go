package ratelimit

import (
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// IPLimiter rate-limits requests per client IP.
type IPLimiter struct {
	mu       sync.Mutex
	limiters map[string]*entry
	r        rate.Limit
	burst    int
}

type entry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// New creates a rate limiter allowing r events/second with the given burst.
func New(r rate.Limit, burst int) *IPLimiter {
	l := &IPLimiter{
		limiters: make(map[string]*entry),
		r:        r,
		burst:    burst,
	}
	go l.cleanup()
	return l
}

func (l *IPLimiter) allow(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	e, ok := l.limiters[ip]
	if !ok {
		e = &entry{limiter: rate.NewLimiter(l.r, l.burst)}
		l.limiters[ip] = e
	}
	e.lastSeen = time.Now()
	return e.limiter.Allow()
}

func (l *IPLimiter) cleanup() {
	for {
		time.Sleep(10 * time.Minute)
		l.mu.Lock()
		for ip, e := range l.limiters {
			if time.Since(e.lastSeen) > 10*time.Minute {
				delete(l.limiters, ip)
			}
		}
		l.mu.Unlock()
	}
}

// Wrap returns middleware that enforces the rate limit.
func (l *IPLimiter) Wrap(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Fly.io sets this header with the real client IP
		ip := r.Header.Get("Fly-Client-IP")
		if ip == "" {
			ip = r.RemoteAddr
		}
		if !l.allow(ip) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error":"rate limit exceeded"}`))
			return
		}
		next(w, r)
	}
}
