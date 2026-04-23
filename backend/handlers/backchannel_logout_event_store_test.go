package handlers

import "testing"

func TestBackchannelLogoutEventStoreRejectsDuplicates(t *testing.T) {
	store := newBackchannelLogoutEventStore(0)

	if !store.Remember("event-1") {
		t.Fatal("expected first event to be remembered")
	}
	if store.Remember("event-1") {
		t.Fatal("expected duplicate event to be rejected")
	}
	if store.Remember(" ") {
		t.Fatal("expected blank event id to be rejected")
	}
}
