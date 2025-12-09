// Package web provides embedded static files for the playground.
package web

import (
	"embed"
	"io/fs"
)

//go:embed index.html embed.html styles.css components/* min/vs fonts/* manifest.json
var staticFS embed.FS

// FS returns the embedded filesystem for static web assets.
func FS() fs.FS {
	return staticFS
}
