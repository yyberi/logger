import * as pinoModule from 'pino';
import pretty from 'pino-pretty';
import path from 'path';
import { fileURLToPath } from 'url';


// Ensure compatibility between CommonJS and ESM imports
const pinoFactory = ((pinoModule as any).default ?? pinoModule) as (
  opts?: import('pino').LoggerOptions,
  stream?: import('pino').DestinationStream
) => import('pino').Logger;

// const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logDir = process.env.LOG_DIR ?? path.join(process.cwd(), 'logs');
const logFile = path.join(logDir, 'app.log');

export enum LogLevel {
  FATAL = 'fatal',
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

// Default service name from package.json
const DEFAULT_SERVICE_NAME = '@juntu/logger';

// Pretty-print stream for development only
const prettyStream = pretty({
  colorize: true,
  levelFirst: true,
  translateTime: 'SYS:standard',
  singleLine: true,
  // Ignore fields not needed in console output
  ignore: 'service,module',
  messageFormat: (log: Record<string, any>, messageKey: string): string => {
    // (service): [module] message
    const servicePart = log.service ? `${log.service}` : '';
    const modulePart = log.module ? `${log.module}` : '';
    return `[${servicePart}|${modulePart}] ${log[messageKey]}`;
  }
});

export class Logger {
  // Multiple root instances keyed by serviceName
  private static instances: Record<string, Logger> = {};
  private logger: import('pino').Logger;
  private children: Logger[] = [];

  /**
   * Private constructor: param is either a pino.Logger (child) or a serviceName string (root).
   */
  private constructor(param?: string | import('pino').Logger) {
    if (param && typeof param !== 'string') {
      // Child logger
      this.logger = param;
    } else {
      // Root logger
      const serviceName = typeof param === 'string' ? param : DEFAULT_SERVICE_NAME;
      const env = (process.env.NODE_ENV || '').trim().toLowerCase();
      if (env === 'production') {
        // Production: file transport only
        const prodConfig = {
          transport: {
            targets: [{
              target: 'pino/file', level: 'info', options: {
                destination: logFile, mkdir: true, sync: false
              }
            }]
          },
          level: 'info',
          timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
          messageKey: 'message',
          base: { env: process.env.NODE_ENV, version: process.env.npm_package_version, service: serviceName }
        } as import('pino').LoggerOptions;
        this.logger = pinoFactory(prodConfig);
      } else {
        // Development: pretty-print to console
        this.logger = pinoFactory(
          { base: { service: serviceName }, level: 'debug' },
          prettyStream
        );
      }
    }
  }

  /**
   * Return or create a root logger for the given serviceName (or default).
   */
  public static getInstance(serviceName?: string): Logger {
    const name = serviceName || DEFAULT_SERVICE_NAME;
    if (!Logger.instances[name]) {
      Logger.instances[name] = new Logger(name);
    }
    return Logger.instances[name];
  }

  /**
   * Create a child logger: pass { name: 'moduleName' }.
   */
  public child(bindings: import('pino').Bindings): Logger {
    const moduleName = (bindings as any).name;
    const { name, ...rest } = bindings as any;
    const childBindings = { ...rest, module: moduleName };
    const childLogger = this.logger.child(childBindings);
    const childInstance = new Logger(childLogger);
    this.children.push(childInstance);
    return childInstance;
  }

  public setLogLevel(level: LogLevel): void {
    this.logger.level = level;
    this.children.forEach(child => child.setLogLevel(level));
  }

  public fatal(msg: string, ...args: unknown[]): void { this.logger.fatal(msg, ...args); }
  public error(msg: string, ...args: unknown[]): void { this.logger.error(msg, ...args); }
  public warn(msg: string, ...args: unknown[]): void { this.logger.warn(msg, ...args); }
  public info(msg: string, ...args: unknown[]): void { this.logger.info(msg, ...args); }
  public debug(msg: string, ...args: unknown[]): void { this.logger.debug(msg, ...args); }
}

// Default export: function to get a logger for a serviceName
export default (serviceName?: string) => Logger.getInstance(serviceName);
