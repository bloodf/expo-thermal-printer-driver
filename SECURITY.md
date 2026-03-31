# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within this library, please send a private vulnerability report via **GitHub Security Advisories**.

Do **not** create a public GitHub issue for security vulnerabilities.

Please include as much of the following information as possible:

- Type of issue (e.g., buffer overflow, improper input validation, data leakage, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker could exploit it

The library maintainer will:

1. Acknowledge receipt of the vulnerability report within **48 hours**
2. Provide an estimated timeline for a fix within **7 days**
3. Credit the reporter in the security advisory (unless anonymity is requested)
4. Issue a patched release and public CVE (if applicable)

## Security Best Practices for Integrators

When using this library in your application:

- Always validate printer addresses before connecting — never trust user-supplied addresses without validation
- Printer connections should be scoped to the minimum necessary permissions
- Do not log printer addresses or connection metadata in production
- On Android 12+, Bluetooth permissions are requested at runtime; ensure your app explains why to users
- For BLE printers, ensure the physical device is paired before attempting connection in production flows
