# Security Policy

## Reporting a Vulnerability

Please do not open a public issue for suspected vulnerabilities.

Use GitHub's private vulnerability reporting for this repository if it is available. If private reporting is not enabled, open a minimal public issue that asks for a secure contact path without including exploit details.

## Scope

Security-sensitive areas include:

- Local data import/export
- The optional MCP server
- Desktop auto-update and release workflows
- Mobile build and signing configuration

Taskify is local-first. The desktop MCP server should bind only to `127.0.0.1` and should not be exposed directly to a network.
