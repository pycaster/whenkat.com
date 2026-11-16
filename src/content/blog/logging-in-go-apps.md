---
title: 'Structured logging in Go with log/slog'
description: 'A practical guide to structured logging with Go 1.21 log/slog. Leveled logging, structured attributes, and context propagation for Grafana tracing.'
pubDate: 'Mar 23 2024'
series: 'Engineering Notes'
seriesOrder: 1
---

Go announced `log/slog` in 1.21, bringing structured logging into the standard library. This isn't a tour of the `slog` package. It's a simple guide on how I chose to log in my Go applications.

## Leveled Logging

When choosing to log a message, always provide a level. Here's my guidance for consistent logging style across microservices:

**`CRITICAL`**: Any error forcing a shutdown to prevent data loss.

**`ERROR`**: Unexpected or fatal errors for the current operation, but not the service itself. Requires immediate attention in monitoring.

**`WARN`**: A potential problem that isn't crippling to the service.

**`INFO`**: General operational information. Helps understand what the application is doing.

**`DEBUG`**: Detailed information for developers and SREs. Can be highly verbose.

## Structured Log Format

The simplest base format I've successfully used:

```json
{
  "time": "2024-03-23T01:52:50.409805437Z",
  "level": "INFO",
  "msg": "hello",
  "source": {
    "function": "LogHello",
    "file": "hello.go",
    "line": 14
  }
}
```

- **`time`**: UTC timestamp. Available by default; choose your format.
- **`level`**: Defaults to ERROR in this package.
- **`msg`**: Lowercase freeform string, no interpolation.
- **`source`**: Function and line. I prefer the shortened form of both fields.

## Separate Attributes From Log Messages

In the past I formatted attributes directly into the message string:

```json
{ "msg": "hello foo=bar" }
```

With `log/slog`, I keep all attributes separate from the message. This makes reading logs easier and makes Grafana monitoring significantly more valuable, especially with RequestID tracing.

```json
{
  "time": "2024-03-23T01:52:50.409805437Z",
  "level": "INFO",
  "msg": "hello",
  "source": { "function": "LogHello", "file": "hello.go", "line": 14 },
  "foo": "bar"
}
```

## Context Logger

If you integrate with tools like OpenTelemetry and export data to Grafana, always log with context. This allows span/trace data to propagate across context boundaries for distributed tracing.

```go
slog.InfoContext(ctx, "hello", "foo", "bar")
```

The context carries the trace and span IDs, so every log line is automatically associated with the active trace in Grafana. No extra work per log call.
