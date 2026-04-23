package handlers

import (
	"strings"
	"sync"
	"time"
)

type backchannelLogoutEventStore struct {
	mu     sync.Mutex
	ttl    time.Duration
	events map[string]time.Time
}

func newBackchannelLogoutEventStore(ttl time.Duration) *backchannelLogoutEventStore {
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}

	return &backchannelLogoutEventStore{
		ttl:    ttl,
		events: make(map[string]time.Time),
	}
}

func (store *backchannelLogoutEventStore) Remember(eventID string) bool {
	trimmedEventID := strings.TrimSpace(eventID)
	if trimmedEventID == "" {
		return false
	}

	now := time.Now().UTC()
	store.mu.Lock()
	defer store.mu.Unlock()

	store.cleanupExpiredLocked(now)
	if expiresAt, ok := store.events[trimmedEventID]; ok && expiresAt.After(now) {
		return false
	}

	store.events[trimmedEventID] = now.Add(store.ttl)
	return true
}

func (store *backchannelLogoutEventStore) cleanupExpiredLocked(now time.Time) {
	if store == nil {
		return
	}

	for eventID, expiresAt := range store.events {
		if !expiresAt.After(now) {
			delete(store.events, eventID)
		}
	}
}
