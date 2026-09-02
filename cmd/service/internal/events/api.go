package events

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/jms-guy/timekeep/cmd/service/internal/sessions"
	"github.com/jms-guy/timekeep/internal/config"
	"github.com/jms-guy/timekeep/internal/database"
	"github.com/jms-guy/timekeep/internal/protocol"
	"github.com/jms-guy/timekeep/internal/repository"
)

func (e *EventController) handleAPICommand(
	serviceCtx context.Context,
	logger *log.Logger,
	s *sessions.SessionManager,
	pr repository.ProgramRepository,
	a repository.ActiveRepository,
	h repository.HistoryRepository,
	cmd protocol.Request,
) protocol.Response {
	ctx, cancel := context.WithTimeout(serviceCtx, 5*time.Second)
	defer cancel()

	switch cmd.Action {
	case "service_status":
		return protocol.Success(cmd.RequestID, protocol.ServiceStatus{Running: true, Version: e.version})
	case "get_config":
		if e.Config == nil {
			return protocol.Failure(cmd.RequestID, "service_uninitialized", "service configuration is not loaded")
		}
		return protocol.Success(cmd.RequestID, mapServiceConfig(e.Config))
	case "update_config":
		if cmd.Config == nil {
			return protocol.Failure(cmd.RequestID, "invalid_request", "service configuration is required")
		}
		nextConfig := configFromProtocol(cmd.Config)
		if err := nextConfig.Save(); err != nil {
			return apiFailure(cmd, "config_error", "failed to save service configuration", err)
		}
		e.Config = nextConfig
		e.RefreshProcessMonitor(serviceCtx, logger, s, pr, a, h)
		return protocol.Success(cmd.RequestID, mapServiceConfig(nextConfig))
	case "list_programs":
		programs, err := pr.GetAllPrograms(ctx)
		if err != nil {
			return apiFailure(cmd, "database_error", "failed to load tracked programs", err)
		}
		return protocol.Success(cmd.RequestID, mapTrackedPrograms(programs))
	case "get_program":
		if cmd.ProcessName == "" {
			return protocol.Failure(cmd.RequestID, "invalid_request", "program name is required")
		}
		program, err := pr.GetProgramByName(ctx, strings.ToLower(cmd.ProcessName))
		if err != nil {
			if err == sql.ErrNoRows {
				return apiFailure(cmd, "not_found", "tracked program was not found", err)
			}
			return apiFailure(cmd, "database_error", "failed to load tracked program", err)
		}
		return protocol.Success(cmd.RequestID, mapTrackedProgram(program))
	case "active_sessions":
		sessions, err := a.GetAllActiveSessions(ctx)
		if err != nil {
			return apiFailure(cmd, "database_error", "failed to load active sessions", err)
		}
		return protocol.Success(cmd.RequestID, mapActiveSessions(sessions))
	case "history":
		history, err := loadHistory(ctx, h, cmd)
		if err != nil {
			return apiFailure(cmd, "history_error", "failed to load session history", err)
		}
		return protocol.Success(cmd.RequestID, mapSessionHistory(history))
	case "add_program":
		return e.addProgram(ctx, serviceCtx, logger, s, pr, a, h, cmd)
	case "update_program":
		return e.updateProgram(ctx, serviceCtx, logger, s, pr, a, h, cmd)
	case "remove_program":
		return e.removeProgram(ctx, serviceCtx, logger, s, pr, a, h, cmd)
	case "reset_stats":
		return e.resetStats(ctx, serviceCtx, logger, s, pr, a, h, cmd)
	case "refresh":
		e.RefreshProcessMonitor(serviceCtx, logger, s, pr, a, h)
		return protocol.Success(cmd.RequestID, map[string]bool{"refreshed": true})
	default:
		return protocol.Failure(cmd.RequestID, "unknown_action", fmt.Sprintf("unknown action: %s", cmd.Action))
	}
}

func (e *EventController) addProgram(
	ctx context.Context,
	serviceCtx context.Context,
	logger *log.Logger,
	s *sessions.SessionManager,
	pr repository.ProgramRepository,
	a repository.ActiveRepository,
	h repository.HistoryRepository,
	cmd protocol.Request,
) protocol.Response {
	if cmd.ProcessName == "" {
		return protocol.Failure(cmd.RequestID, "invalid_request", "program name is required")
	}

	err := pr.AddProgram(ctx, database.AddProgramParams{
		Name:     strings.ToLower(cmd.ProcessName),
		Category: sql.NullString{String: cmd.Category, Valid: cmd.Category != ""},
		Project:  sql.NullString{String: cmd.Project, Valid: cmd.Project != ""},
	})
	if err != nil {
		return apiFailure(cmd, "database_error", "failed to add tracked program", err)
	}

	e.RefreshProcessMonitor(serviceCtx, logger, s, pr, a, h)
	return protocol.Success(cmd.RequestID, map[string]string{"name": strings.ToLower(cmd.ProcessName)})
}

func (e *EventController) updateProgram(
	ctx context.Context,
	serviceCtx context.Context,
	logger *log.Logger,
	s *sessions.SessionManager,
	pr repository.ProgramRepository,
	a repository.ActiveRepository,
	h repository.HistoryRepository,
	cmd protocol.Request,
) protocol.Response {
	if cmd.ProcessName == "" {
		return protocol.Failure(cmd.RequestID, "invalid_request", "program name is required")
	}

	name := strings.ToLower(cmd.ProcessName)
	if cmd.Category != "" {
		if err := pr.UpdateCategory(ctx, database.UpdateCategoryParams{
			Name:     name,
			Category: sql.NullString{String: cmd.Category, Valid: true},
		}); err != nil {
			return apiFailure(cmd, "database_error", "failed to update program category", err)
		}
	}
	if cmd.Project != "" {
		if err := pr.UpdateProject(ctx, database.UpdateProjectParams{
			Name:    name,
			Project: sql.NullString{String: cmd.Project, Valid: true},
		}); err != nil {
			return apiFailure(cmd, "database_error", "failed to update program project", err)
		}
	}

	e.RefreshProcessMonitor(serviceCtx, logger, s, pr, a, h)
	return protocol.Success(cmd.RequestID, map[string]string{"name": name})
}

func (e *EventController) removeProgram(
	ctx context.Context,
	serviceCtx context.Context,
	logger *log.Logger,
	s *sessions.SessionManager,
	pr repository.ProgramRepository,
	a repository.ActiveRepository,
	h repository.HistoryRepository,
	cmd protocol.Request,
) protocol.Response {
	if cmd.All {
		if err := pr.RemoveAllPrograms(ctx); err != nil {
			return apiFailure(cmd, "database_error", "failed to remove tracked programs", err)
		}
	} else {
		if cmd.ProcessName == "" {
			return protocol.Failure(cmd.RequestID, "invalid_request", "program name is required")
		}
		if err := pr.RemoveProgram(ctx, strings.ToLower(cmd.ProcessName)); err != nil {
			return apiFailure(cmd, "database_error", "failed to remove tracked program", err)
		}
	}

	e.RefreshProcessMonitor(serviceCtx, logger, s, pr, a, h)
	return protocol.Success(cmd.RequestID, map[string]bool{"removed": true})
}

func (e *EventController) resetStats(
	ctx context.Context,
	serviceCtx context.Context,
	logger *log.Logger,
	s *sessions.SessionManager,
	pr repository.ProgramRepository,
	a repository.ActiveRepository,
	h repository.HistoryRepository,
	cmd protocol.Request,
) protocol.Response {
	if cmd.All {
		if err := a.RemoveAllSessions(ctx); err != nil {
			return apiFailure(cmd, "database_error", "failed to remove active sessions", err)
		}
		if err := h.RemoveAllRecords(ctx); err != nil {
			return apiFailure(cmd, "database_error", "failed to remove session history", err)
		}
		if err := pr.ResetAllLifetimes(ctx); err != nil {
			return apiFailure(cmd, "database_error", "failed to reset lifetimes", err)
		}
	} else {
		if cmd.ProcessName == "" {
			return protocol.Failure(cmd.RequestID, "invalid_request", "program name is required")
		}
		name := strings.ToLower(cmd.ProcessName)
		if err := a.RemoveActiveSession(ctx, name); err != nil {
			return apiFailure(cmd, "database_error", "failed to remove active session", err)
		}
		if err := h.RemoveRecordsForProgram(ctx, name); err != nil {
			return apiFailure(cmd, "database_error", "failed to remove session history", err)
		}
		if err := pr.ResetLifetimeForProgram(ctx, name); err != nil {
			return apiFailure(cmd, "database_error", "failed to reset lifetime", err)
		}
	}

	e.RefreshProcessMonitor(serviceCtx, logger, s, pr, a, h)
	return protocol.Success(cmd.RequestID, map[string]bool{"reset": true})
}

func loadHistory(ctx context.Context, h repository.HistoryRepository, cmd protocol.Request) ([]database.SessionHistory, error) {
	limit := cmd.Limit
	if limit <= 0 {
		limit = 25
	}

	if cmd.ProcessName != "" {
		name := strings.ToLower(cmd.ProcessName)
		if cmd.Date != "" {
			start, end, err := dateBounds(cmd.Date)
			if err != nil {
				return nil, err
			}
			return h.GetSessionHistoryByDate(ctx, database.GetSessionHistoryByDateParams{
				ProgramName: name, StartTime: end, EndTime: start, Limit: limit,
			})
		}
		if cmd.Start != "" {
			start, end, err := rangeBounds(cmd.Start, cmd.End)
			if err != nil {
				return nil, err
			}
			return h.GetSessionHistoryByRange(ctx, database.GetSessionHistoryByRangeParams{
				ProgramName: name, StartTime: end, EndTime: start, Limit: limit,
			})
		}
		return h.GetSessionHistory(ctx, database.GetSessionHistoryParams{ProgramName: name, Limit: limit})
	}

	if cmd.Date != "" {
		start, end, err := dateBounds(cmd.Date)
		if err != nil {
			return nil, err
		}
		return h.GetAllSessionHistoryByDate(ctx, database.GetAllSessionHistoryByDateParams{
			StartTime: end, EndTime: start, Limit: limit,
		})
	}
	if cmd.Start != "" {
		start, end, err := rangeBounds(cmd.Start, cmd.End)
		if err != nil {
			return nil, err
		}
		return h.GetAllSessionHistoryByRange(ctx, database.GetAllSessionHistoryByRangeParams{
			StartTime: end, EndTime: start, Limit: limit,
		})
	}
	return h.GetAllSessionHistory(ctx, limit)
}

func dateBounds(value string) (time.Time, time.Time, error) {
	date, err := time.Parse("2006-01-02", value)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	start := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	return start, start.Add(24 * time.Hour), nil
}

func rangeBounds(startValue, endValue string) (time.Time, time.Time, error) {
	startDate, err := time.Parse("2006-01-02", startValue)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	start := time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, startDate.Location())
	end := time.Now()
	if endValue != "" {
		endDate, err := time.Parse("2006-01-02", endValue)
		if err != nil {
			return time.Time{}, time.Time{}, err
		}
		end = time.Date(endDate.Year(), endDate.Month(), endDate.Day(), 23, 59, 59, 999999999, endDate.Location())
	}
	return start, end, nil
}

func apiFailure(cmd protocol.Request, code, message string, err error) protocol.Response {
	if err == nil {
		return protocol.Failure(cmd.RequestID, code, message)
	}
	return protocol.Failure(cmd.RequestID, code, fmt.Sprintf("%s: %v", message, err))
}

func mapServiceConfig(value *config.Config) protocol.ServiceConfig {
	return protocol.ServiceConfig{
		WakaTime: protocol.IntegrationConfig{
			Enabled: value.WakaTime.Enabled, APIKey: value.WakaTime.APIKey,
			CLIPath: value.WakaTime.CLIPath, GlobalProject: value.WakaTime.GlobalProject,
		},
		Wakapi: protocol.IntegrationConfig{
			Enabled: value.Wakapi.Enabled, APIKey: value.Wakapi.APIKey,
			Server: value.Wakapi.Server, GlobalProject: value.Wakapi.GlobalProject,
		},
		PollInterval: value.PollInterval,
		PollGrace:    value.PollGrace,
	}
}

func configFromProtocol(value *protocol.ServiceConfig) *config.Config {
	return &config.Config{
		WakaTime: config.WakaTimeConfig{
			Enabled: value.WakaTime.Enabled, APIKey: value.WakaTime.APIKey,
			CLIPath: value.WakaTime.CLIPath, GlobalProject: value.WakaTime.GlobalProject,
		},
		Wakapi: config.WakapiConfig{
			Enabled: value.Wakapi.Enabled, APIKey: value.Wakapi.APIKey,
			Server: value.Wakapi.Server, GlobalProject: value.Wakapi.GlobalProject,
		},
		PollInterval: value.PollInterval,
		PollGrace:    value.PollGrace,
	}
}

func mapTrackedPrograms(programs []database.TrackedProgram) []protocol.TrackedProgram {
	result := make([]protocol.TrackedProgram, 0, len(programs))
	for _, program := range programs {
		result = append(result, mapTrackedProgram(program))
	}
	return result
}

func mapTrackedProgram(program database.TrackedProgram) protocol.TrackedProgram {
	result := protocol.TrackedProgram{
		ID:              program.ID,
		Name:            program.Name,
		LifetimeSeconds: program.LifetimeSeconds,
	}
	if program.Category.Valid {
		result.Category = program.Category.String
	}
	if program.Project.Valid {
		result.Project = program.Project.String
	}
	return result
}

func mapActiveSessions(items []database.ActiveSession) []protocol.ActiveSession {
	result := make([]protocol.ActiveSession, 0, len(items))
	for _, item := range items {
		result = append(result, protocol.ActiveSession{
			ID: item.ID, ProgramName: item.ProgramName, StartTime: item.StartTime,
		})
	}
	return result
}

func mapSessionHistory(items []database.SessionHistory) []protocol.SessionHistory {
	result := make([]protocol.SessionHistory, 0, len(items))
	for _, item := range items {
		result = append(result, protocol.SessionHistory{
			ID: item.ID, ProgramName: item.ProgramName, StartTime: item.StartTime,
			EndTime: item.EndTime, DurationSeconds: item.DurationSeconds,
		})
	}
	return result
}
