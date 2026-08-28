.PHONY: build run clean test

build:
	cd services/matching-engine && go build -o bin/matching-engine ./cmd

run:
	cd services/matching-engine && go run ./cmd

test:
	cd services/matching-engine && go test -v -race ./...

clean:
	cd services/matching-engine && rm -rf bin/
