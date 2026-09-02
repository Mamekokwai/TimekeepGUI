// Package protocol defines the JSON messages exchanged with the Timekeep
// service. The protocol is transport-agnostic: Windows uses a named pipe and
// Linux uses a Unix socket.
package protocol

import "time"

type Request struct {
	RequestID   string         `json:"request_id,omitempty"`
	Action      string         `json:"action"`
	ProcessName string         `json:"name,omitempty"`
	ProcessID   int            `json:"pid,omitempty"`
	Category    string         `json:"category,omitempty"`
	Project     string         `json:"project,omitempty"`
	Date        string         `json:"date,omitempty"`
	Start       string         `json:"start,omitempty"`
	End         string         `json:"end,omitempty"`
	Limit       int64          `json:"limit,omitempty"`
	All         bool           `json:"all,omitempty"`
	Config      *ServiceConfig `json:"config,omitempty"`
}

type Response struct {
	RequestID string         `json:"request_id,omitempty"`
	OK        bool           `json:"ok"`
	Data      any            `json:"data,omitempty"`
	Error     *ResponseError `json:"error,omitempty"`
}

type ResponseError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type ServiceStatus struct {
	Running bool   `json:"running"`
	Version string `json:"version"`
}

type ServiceConfig struct {
	WakaTime     IntegrationConfig `json:"wakatime"`
	Wakapi       IntegrationConfig `json:"wakapi"`
	PollInterval string            `json:"poll_interval,omitempty"`
	PollGrace    int               `json:"poll_grace,omitempty"`
}

type IntegrationConfig struct {
	Enabled       bool   `json:"enabled"`
	APIKey        string `json:"api_key,omitempty"`
	CLIPath       string `json:"cli_path,omitempty"`
	Server        string `json:"server,omitempty"`
	GlobalProject string `json:"global_project,omitempty"`
}

type TrackedProgram struct {
	ID              int64  `json:"id"`
	Name            string `json:"name"`
	LifetimeSeconds int64  `json:"lifetime_seconds"`
	Category        string `json:"category,omitempty"`
	Project         string `json:"project,omitempty"`
}

type ActiveSession struct {
	ID          int64     `json:"id"`
	ProgramName string    `json:"program_name"`
	StartTime   time.Time `json:"start_time"`
}

type SessionHistory struct {
	ID              int64     `json:"id"`
	ProgramName     string    `json:"program_name"`
	StartTime       time.Time `json:"start_time"`
	EndTime         time.Time `json:"end_time"`
	DurationSeconds int64     `json:"duration_seconds"`
}

func Success(requestID string, data any) Response {
	return Response{RequestID: requestID, OK: true, Data: data}
}

func Failure(requestID, code, message string) Response {
	return Response{
		RequestID: requestID,
		Error:     &ResponseError{Code: code, Message: message},
	}
}

func IsAPIAction(action string) bool {
	switch action {
	case "service_status", "get_config", "update_config", "list_programs", "get_program", "active_sessions", "history",
		"add_program", "update_program", "remove_program", "reset_stats":
		return true
	default:
		return false
	}
}
