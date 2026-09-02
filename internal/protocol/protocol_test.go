package protocol

import (
	"encoding/json"
	"reflect"
	"testing"
	"time"
)

func TestRequestJSONRoundTrip(t *testing.T) {
	original := Request{
		RequestID:   "request-1",
		Action:      "history",
		ProcessName: "code.exe",
		Date:        "2026-09-02",
		Limit:       25,
	}

	data, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}

	var decoded Request
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal request: %v", err)
	}

	if !reflect.DeepEqual(decoded, original) {
		t.Fatalf("decoded request differs: got %#v, want %#v", decoded, original)
	}
}

func TestResponseJSONRoundTrip(t *testing.T) {
	original := Success("request-2", ServiceStatus{Running: true, Version: "dev"})
	originalData := time.Date(2026, time.September, 2, 12, 0, 0, 0, time.UTC)
	original.Data = SessionHistory{ProgramName: "code.exe", StartTime: originalData}

	data, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("marshal response: %v", err)
	}

	var decoded Response
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}

	if !decoded.OK || decoded.RequestID != "request-2" || decoded.Error != nil {
		t.Fatalf("unexpected decoded response: %#v", decoded)
	}
}

func TestConfigRequestJSONRoundTrip(t *testing.T) {
	original := Request{
		RequestID: "request-config",
		Action:    "update_config",
		Config: &ServiceConfig{
			WakaTime:     IntegrationConfig{Enabled: true, APIKey: "key", CLIPath: "C:/wakatime-cli"},
			Wakapi:       IntegrationConfig{Server: "https://wakapi.example"},
			PollInterval: "750ms",
			PollGrace:    2,
		},
	}

	data, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("marshal config request: %v", err)
	}

	var decoded Request
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal config request: %v", err)
	}
	if !reflect.DeepEqual(decoded, original) {
		t.Fatalf("decoded config request differs: got %#v, want %#v", decoded, original)
	}
}

func TestFailureResponseIsStructured(t *testing.T) {
	response := Failure("request-3", "not_found", "program was not found")

	if response.OK {
		t.Fatal("failure response must not be successful")
	}
	if response.Error == nil || response.Error.Code != "not_found" {
		t.Fatalf("unexpected failure response: %#v", response)
	}
}

func TestAPIActionClassification(t *testing.T) {
	for _, action := range []string{"service_status", "get_config", "update_config", "list_programs", "history", "reset_stats"} {
		if !IsAPIAction(action) {
			t.Fatalf("expected API action: %s", action)
		}
	}

	for _, action := range []string{"refresh", "process_start", "process_stop", "unknown"} {
		if IsAPIAction(action) {
			t.Fatalf("expected legacy/non-API action: %s", action)
		}
	}
}
