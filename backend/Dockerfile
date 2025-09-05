# Backend Dockerfile - multi-stage build for small runtime image
# Builds the Go backend located in the backend/ folder

FROM golang:1.24-alpine AS builder
RUN apk add --no-cache git ca-certificates
WORKDIR /app

# Copy go mod files and download dependencies first for caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build static binary
ENV CGO_ENABLED=0
RUN go build -o /app/server

# Final image
FROM alpine:3.18
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /app/server /app/server
# Backend listens on 8080 by default (not published in compose)
EXPOSE 8080

ENV GIN_MODE=release
CMD ["/app/server"]
