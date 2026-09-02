package events

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"log"
	"net"
	"testing"
	"time"

	"github.com/jms-guy/timekeep/cmd/service/internal/sessions"
	"github.com/jms-guy/timekeep/internal/protocol"
)

func TestHistoryDateBoundsMatchCLIQuerySemantics(t *testing.T) {
	start, end, err := dateBounds("2026-09-02")
	if err != nil {
		t.Fatalf("dateBounds returned error: %v", err)
	}
	if start.Format("2006-01-02 15:04:05") != "2026-09-02 00:00:00" {
		t.Fatalf("unexpected start: %v", start)
	}
	if end.Sub(start) != 24*time.Hour {
		t.Fatalf("unexpected day range: %v", end.Sub(start))
	}
}

func TestHistoryRangeBoundsUseNowWhenEndIsMissing(t *testing.T) {
	before := time.Now()
	start, end, err := rangeBounds("2026-09-01", "")
	if err != nil {
		t.Fatalf("rangeBounds returned error: %v", err)
	}
	if start.Format("2006-01-02 15:04:05") != "2026-09-01 00:00:00" {
		t.Fatalf("unexpected start: %v", start)
	}
	if end.Before(before) || end.After(time.Now()) {
		t.Fatalf("range end should be close to now: %v", end)
	}
}

func TestHandleConnectionReturnsStructuredServiceStatus(t *testing.T) {
	server, client := net.Pipe()
	controller := NewEventController()
	logger := log.New(io.Discard, "", 0)

	done := make(chan struct{})
	go func() {
		controller.HandleConnection(
			context.Background(),
			logger,
			sessions.NewSessionManager(),
			nil,
			nil,
			nil,
			server,
		)
		close(done)
	}()

	request := protocol.Request{RequestID: "status-request", Action: "service_status"}
	payload, err := json.Marshal(request)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}
	payload = append(payload, '\n')
	if _, err := client.Write(payload); err != nil {
		t.Fatalf("write request: %v", err)
	}

	var response protocol.Response
	if err := json.NewDecoder(bufio.NewReader(client)).Decode(&response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !response.OK || response.RequestID != request.RequestID || response.Error != nil {
		t.Fatalf("unexpected response: %#v", response)
	}

	if err := client.Close(); err != nil {
		t.Fatalf("close client: %v", err)
	}
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("service connection handler did not stop after client close")
	}
}
