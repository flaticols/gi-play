package explore

import (
	"encoding/json"
	"net/http"
	"reflect"
	"sync"

	"github.com/emicklei/structexplorer"
	"github.com/flaticols/gi-play/internal/session"
)

// Handler serves structexplorer for sessions.
type Handler struct {
	sessions *session.Store
	services map[string]structexplorer.Service
	mu       sync.Mutex
}

// NewHandler creates a new explore handler.
func NewHandler(sessions *session.Store) *Handler {
	return &Handler{
		sessions: sessions,
		services: make(map[string]structexplorer.Service),
	}
}

// ServeHTTP handles structexplorer requests.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("sessionID")
	if sessionID == "" {
		http.Error(w, "session ID required", http.StatusBadRequest)
		return
	}

	svc, err := h.getOrCreateService(sessionID)
	if err != nil {
		http.Error(w, "session not found", http.StatusNotFound)
		return
	}

	// Extend session TTL on access
	h.sessions.Touch(sessionID)

	svc.ServeHTTP(w, r)
}

func (h *Handler) getOrCreateService(sessionID string) (structexplorer.Service, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if svc, ok := h.services[sessionID]; ok {
		return svc, nil
	}

	sess, ok := h.sessions.Get(sessionID)
	if !ok {
		return nil, http.ErrNoCookie // session not found
	}

	svc := h.createService(sess)
	h.services[sessionID] = svc
	return svc, nil
}

func (h *Handler) createService(sess *session.Session) structexplorer.Service {
	svc := structexplorer.NewService()

	for _, name := range sess.Variables {
		val := sess.Package.Select(name)
		if val.IsValid() {
			var iface any
			if val.CanInterface() {
				iface = val.Interface()
			} else {
				// For unexported fields, create a copy
				newVal := reflect.New(val.Type()).Elem()
				newVal.Set(val)
				if newVal.CanInterface() {
					iface = newVal.Interface()
				}
			}
			if iface != nil {
				svc.Explore(name, iface)
			}
		}
	}

	return svc
}

// Cleanup removes services for expired sessions.
func (h *Handler) Cleanup(sessionID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.services, sessionID)
}

// Variable represents an explorable variable.
type Variable struct {
	Name       string `json:"name"`
	Type       string `json:"type"`
	Explorable bool   `json:"explorable"`
}

// HandleVars returns the list of explorable variables for a session.
func (h *Handler) HandleVars(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("sessionID")
	if sessionID == "" {
		http.Error(w, "session ID required", http.StatusBadRequest)
		return
	}

	sess, ok := h.sessions.Get(sessionID)
	if !ok {
		http.Error(w, "session not found", http.StatusNotFound)
		return
	}

	vars := make([]Variable, 0, len(sess.Variables))
	for _, name := range sess.Variables {
		val := sess.Package.Select(name)
		v := Variable{
			Name:       name,
			Explorable: val.IsValid() && val.CanInterface(),
		}
		if val.IsValid() {
			v.Type = val.Type().String()
		}
		vars = append(vars, v)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"session_id": sessionID,
		"variables":  vars,
	})
}

// isExplorable checks if a value is worth exploring (struct, slice, map, etc.)
func isExplorable(val reflect.Value) bool {
	if !val.IsValid() {
		return false
	}

	kind := val.Kind()
	switch kind {
	case reflect.Struct, reflect.Slice, reflect.Array, reflect.Map, reflect.Ptr:
		return true
	case reflect.Interface:
		if val.IsNil() {
			return false
		}
		return isExplorable(val.Elem())
	}
	return false
}
