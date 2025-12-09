package main

import (
	"flag"
	"log"
)

func main() {
	addr := flag.String("addr", ":8080", "HTTP listen address")
	dbPath := flag.String("db", "snippets.db", "Database file path")
	flag.Parse()

	if err := run(Config{Addr: *addr, DBPath: *dbPath}); err != nil {
		log.Fatal(err)
	}
}
