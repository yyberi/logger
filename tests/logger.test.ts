import { describe, it, expect, beforeEach, vi } from 'vitest'

// === Mocks ===
const rootMockLogger = {
  fatal: vi.fn(),
  error: vi.fn(),
  warn:  vi.fn(),
  info:  vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
} as any;

const childMockLogger = {
  fatal: vi.fn(),
  error: vi.fn(),
  warn:  vi.fn(),
  info:  vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
} as any;

vi.mock('pino', () => ({
  default: vi.fn(() => rootMockLogger),
}))

vi.mock('pino-pretty', () => ({
  default: vi.fn(() => ({} as any)),
}))

// Helper to clear mocks & module cache
function resetAll() {
  vi.resetModules()
  vi.clearAllMocks()
  delete process.env.NODE_ENV
  delete process.env.LOG_DIR
  delete process.env.npm_package_version
}

// === Tests ===
describe('@yyberi/logger (development)', () => {
  beforeEach(() => {
    resetAll()
    rootMockLogger.child.mockImplementation(() => childMockLogger)
  })

  it('getInstance() returns a singleton', async () => {
    const { default: getLogger } = await import('../dist/index.js')
    const a = getLogger()
    const b = getLogger()
    expect(a).toBe(b)
  })

  it('getInstance(name) yields separate instances per name', async () => {
    const { default: getLogger } = await import('../dist/index.js')
    const d1 = getLogger('foo')
    const d2 = getLogger('bar')
    const d3 = getLogger('foo')
    expect(d1).toBe(d3)
    expect(d1).not.toBe(d2)
  })

  it('wraps pino() in dev mode with pretty stream', async () => {
    const pinoModule = await import('pino')
    const prettyModule = await import('pino-pretty')
    const { default: getLogger } = await import('../dist/index.js')

    const pinoMock = (pinoModule.default as any) as any as any
    const prettyMock = vi.mocked(prettyModule.default)

    getLogger('svcDev')

    expect(pinoMock).toHaveBeenCalledTimes(1)
    const [opts, stream] = pinoMock.mock.calls[0]
    expect(opts).toMatchObject({ base: { service: 'svcDev' }, level: 'debug' })
    expect(prettyMock).toHaveBeenCalledTimes(1)
    expect(stream).toBeDefined()
  })

  it('child() binds module name and preserves other bindings', async () => {
    const { default: getLogger } = await import('../dist/index.js')
    const root = getLogger('svc')
    const child = root.child({ name: 'modA', foo: 'bar' })

    expect(rootMockLogger.child).toHaveBeenCalledWith({ foo: 'bar', module: 'modA' })
    expect((child as any).logger).toBe(childMockLogger)
  })

  it('logging methods forward to underlying logger', async () => {
    const { default: getLogger } = await import('../dist/index.js')
    const root = getLogger()
    root.fatal('fmsg', 1)
    root.error('emsg', 2)
    root.warn ('wmsg', 3)
    root.info ('imsg', 4)
    root.debug('dmsg', 5)

    expect(rootMockLogger.fatal).toHaveBeenCalledWith('fmsg', 1)
    expect(rootMockLogger.error).toHaveBeenCalledWith('emsg', 2)
    expect(rootMockLogger.warn ).toHaveBeenCalledWith('wmsg', 3)
    expect(rootMockLogger.info ).toHaveBeenCalledWith('imsg', 4)
    expect(rootMockLogger.debug).toHaveBeenCalledWith('dmsg', 5)

    const child = root.child({ name: 'modB' })
    child.info('child!')
    expect(childMockLogger.info).toHaveBeenCalledWith('child!')
  })

  it('setLogLevel() updates root and children', async () => {
    const { default: getLogger, LogLevel } = await import('../dist/index.js')
    const root = getLogger()
    root.child({ name: 'm1' })
    root.child({ name: 'm2' })

    root.setLogLevel(LogLevel.WARN)
    expect(rootMockLogger.level).toBe(LogLevel.WARN)
    expect(childMockLogger.level).toBe(LogLevel.WARN)
  })
})

describe('@yyberi/logger (production)', () => {
  beforeEach(() => {
    resetAll()
    process.env.NODE_ENV = 'production'
    process.env.LOG_DIR = '/my/logs'
    process.env.npm_package_version = '9.8.7'
  })

  it('configures pino in production mode with file transport', async () => {
    const pinoModule = await import('pino')
    const { default: getLogger } = await import('../dist/index.js')
    const pinoMock = (pinoModule.default as any)

    getLogger('svcProd')

    expect(pinoMock).toHaveBeenCalledTimes(1)
    const [prodConfig, maybeStream] = pinoMock.mock.calls[0]

    expect(prodConfig.transport).toBeDefined()
    const target = (prodConfig.transport as any).targets[0]

    expect(prodConfig.level).toBe('info')
    expect(typeof prodConfig.timestamp).toBe('function')
    expect(prodConfig.messageKey).toBe('message')
    expect(prodConfig.base).toEqual({ env: 'production', version: '9.8.7', service: 'svcProd' })

    expect(target.target).toBe('pino/file')
    expect(target.options.destination).toMatch(/\/my\/logs\/app\.log$/)

    expect(maybeStream).toBeUndefined()
  })
})
