# @yyberi/logger

A lightweight wrapper around [pino](https://www.npmjs.com/package/pino) for structured, level-based logging in both development and production environments.

## Installation

```bash
npm install @yyberi/logger
```

## Features

* **Root & child loggers** keyed by service or module name
* **Automatic environment detection** (`NODE_ENV`) for console pretty-printing in development and file-based logging in production
* **Customizable log levels** via the `LogLevel` enum
* **ISO timestamps** in production logs
* **Configurable log directory** via the `LOG_DIR` environment variable

## Usage

```ts
import getLogger, { LogLevel } from '@juntu/logger';

// Root logger (defaults to service name '@juntu/logger')
const logger = getLogger();

// Optionally set a specific service name:
const customLogger = getLogger('my-service');

// Set global log level
logger.setLogLevel(LogLevel.INFO);

logger.info('Application started');

// Create a module-specific child logger
const authLogger = logger.child({ name: 'auth' });
authLogger.debug('Checking user credentials');
```

### Configuration

* `NODE_ENV=production`

  * Logs to file at `$LOG_DIR/app.log` (defaults to `./logs/app.log`) with level `info` and above
  * Outputs JSON with fields: `timestamp`, `env`, `version`, `service`, plus the log `message`

* `NODE_ENV` not set or anything else

  * Logs to console with colors and single-line pretty printing
  * Ignores `service` and `module` fields in pretty output (shown as prefix)

### API Reference

| Method                                        | Description                         |
| --------------------------------------------- | ----------------------------------- |
| `getLogger(serviceName?)`                     | Get or create a root logger         |
| `logger.child(bindings)`                      | Create a child logger with metadata |
| `logger.setLogLevel(lvl)`                     | Dynamically adjust log level        |
| `logger.fatal(...), error, warn, info, debug` | Log at the specified level          |

### Environment Variables

* `LOG_DIR` — Directory where `app.log` will be stored (defaults to `./logs`)
* `NODE_ENV` — Determines production vs development behavior
* `npm_package_version` — Automatically picked up from your `package.json` for metadata

### Tips & Caveats

* The `logs` directory will be created automatically if it does not exist.
* Production logs are written asynchronously; buffered logs may be lost if the process exits abruptly.
* The timestamp override yields ISO-formatted strings; no further configuration needed.

