import 'dotenv/config';
import * as pinoModule from 'pino';
import pretty from 'pino-pretty';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from '../package.json' with { type: 'json' };

// Ensure compatibility between CommonJS and ESM imports
const pinoFactory = ((pinoModule as any).default ?? pinoModule) as (
  opts?: import('pino').LoggerOptions,
  stream?: import('pino').DestinationStream
) => import('pino').Logger;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export enum LogLevel {
  FATAL = 'fatal',
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

// Default service name from package.json
const DEFAULT_SERVICE_NAME = pkg.name ?? 'ads-mqtt';

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
  private static instance?: Logger;
  private logger: import('pino').Logger;
  private children: Logger[] = [];

  /**
   * Private constructor: param is either a pino.Logger (child) or a serviceName string (root).
   */
  private constructor(param?: string | import('pino').Logger) {
    
    if (param && typeof param !== 'string') {
      // Child logger, use provided pino.Logger
      this.logger = param;
    } else {
      // Root logger, determine service name
      const serviceName = typeof param === 'string' ? param : DEFAULT_SERVICE_NAME;
      // Normalize NODE_ENV
      const envRaw = process.env.NODE_ENV || '';
      const env = envRaw.trim().toLowerCase();

      if (env === 'production') {
        // Production: use transport config to write JSON logs to file only, no console
        const prodConfig = {
          transport: {
            targets: [
              {
                target: 'pino/file',
                level: 'info',
                options: {
                  destination: path.join(__dirname, '../logs/app.log'),
                  mkdir: true,
                  sync: false,
                }
              }
            ]
          },
          level: 'info',
          timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
          messageKey: 'message',
          base: {
            env: process.env.NODE_ENV,
            version: process.env.npm_package_version,
            service: serviceName,
          }
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
   * Get or create the root singleton logger. First call may provide serviceName.
   */
  public static getInstance(serviceName?: string): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(serviceName);
    } else {
      // console.debug('[Logger] getInstance returning existing instance');
    }
    return Logger.instance;
  }

  /**
   * Create a child logger for a module/component: pass { name: 'moduleName' }.
   */
  public child(bindings: import('pino').Bindings): Logger {
    const moduleName = (bindings as any).name;
    // Remove original name key and replace with module
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

  public fatal(message: string, ...args: unknown[]): void {
    this.logger.fatal(message, ...args);
  }
  public error(message: string, ...args: unknown[]): void {
    this.logger.error(message, ...args);
  }
  public warn(message: string, ...args: unknown[]): void {
    this.logger.warn(message, ...args);
  }
  public info(message: string, ...args: unknown[]): void {
    this.logger.info(message, ...args);
  }
  public debug(message: string, ...args: unknown[]): void {
    this.logger.debug(message, ...args);
  }
}

// Callable default export for ease of use
export type LoggerFunction = ((serviceName?: string) => Logger) & {
  child: (bindings: import('pino').Bindings) => Logger;
  setLogLevel: (level: LogLevel) => void;
};

const LoggerFn = ((serviceName?: string) => Logger.getInstance(serviceName)) as LoggerFunction;
LoggerFn.child = (bindings) => Logger.getInstance().child(bindings);
LoggerFn.setLogLevel = (level) => Logger.getInstance().setLogLevel(level);

export default LoggerFn;
