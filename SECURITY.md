# Security Policy

## Reporting a Vulnerability
Please do not disclose vulnerabilities publicly in issues.

Report privately with:
- affected version/commit
- reproduction steps
- expected vs actual behavior
- impact
- suggested remediation (if available)

If GitHub Security Advisories are enabled for this repository, use that channel.

## Supported Versions
Security fixes are prioritized for the latest default branch.

## Deployment Guidance
- Treat this as a self-hosted application.
- Do not expose the app directly to the internet without protection.
- Place a reverse proxy/tunnel with access control in front of it.
- Keep Docker images, Python runtime, and host OS patched.
- Rotate tokens/secrets if compromise is suspected.
- Do not mount sensitive host paths into the app container.

## Out of Scope
- Issues in third-party infrastructure not controlled by this project.
- Insecure deployments operated without recommended safeguards.
