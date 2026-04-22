# AI Features Testing Guide

This guide reflects the current AI pipeline and validation flow.

## AI Features

- Conversation summary
- Assistant command execution
- Semantic search
- Smart suggestions
- Web context enrichment

## Provider Behavior

The app uses configured provider detection and fallback behavior through the AI service layer.

## Manual Test Cases

## Summary

1. Open a chat with at least 20 messages.
2. Trigger summary.
3. Verify output appears and UI remains responsive.

## Assistant Command

1. Run a command with @AI syntax.
2. Verify response panel updates.
3. Confirm no crash when provider is unavailable.

## Semantic Search

1. Enter keyword query.
2. Confirm matching messages return.
3. Validate navigation to result positions.

## Failure Handling

- Disable network and re-run summary/assistant.
- Verify fallback messaging and graceful errors.

## Regression Checklist

- No blocking UI freezes
- Errors are surfaced safely
- Existing chat flow unaffected
- Build remains successful
