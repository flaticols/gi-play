// Package store provides key-value storage for code snippets.
package store

import (
	"crypto/rand"
	"errors"
	"strings"
	"time"

	"github.com/oklog/ulid/v2"
	bolt "go.etcd.io/bbolt"
)

var (
	ErrNotFound = errors.New("snippet not found")
	bucketName  = []byte("snippets")
)

// Store manages code snippet persistence.
type Store struct {
	db *bolt.DB
}

// New creates a new Store with the given database path.
func New(path string) (*Store, error) {
	db, err := bolt.Open(path, 0600, &bolt.Options{Timeout: 1 * time.Second})
	if err != nil {
		return nil, err
	}

	// Create bucket if not exists
	err = db.Update(func(tx *bolt.Tx) error {
		_, err := tx.CreateBucketIfNotExists(bucketName)
		return err
	})
	if err != nil {
		db.Close()
		return nil, err
	}

	return &Store{db: db}, nil
}

// Close closes the database.
func (s *Store) Close() error {
	return s.db.Close()
}

// Save stores a snippet and returns its ID.
func (s *Store) Save(code string) (string, error) {
	id := generateID()

	err := s.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(bucketName)
		return b.Put([]byte(id), []byte(code))
	})
	if err != nil {
		return "", err
	}

	return id, nil
}

// Get retrieves a snippet by ID.
func (s *Store) Get(id string) (string, error) {
	var code []byte

	err := s.db.View(func(tx *bolt.Tx) error {
		b := tx.Bucket(bucketName)
		code = b.Get([]byte(id))
		if code == nil {
			return ErrNotFound
		}
		return nil
	})
	if err != nil {
		return "", err
	}

	return string(code), nil
}

// generateID creates a ULID (lowercase for URL friendliness).
func generateID() string {
	entropy := ulid.Monotonic(rand.Reader, 0)
	id := ulid.MustNew(ulid.Timestamp(time.Now()), entropy)
	return strings.ToLower(id.String())
}
