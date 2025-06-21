import { Logger } from '../logger';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('TestLogger');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should create logger instance', () => {
    expect(logger).toBeInstanceOf(Logger);
  });

  test('should create singleton instance', () => {
    const instance1 = Logger.getInstance();
    const instance2 = Logger.getInstance();
    expect(instance1).toBe(instance2);
  });

  test('should create new logger with context', () => {
    const contextLogger = Logger.createLogger('TestContext');
    expect(contextLogger).toBeInstanceOf(Logger);
  });

  test('should log messages with different levels', () => {
    const logSpy = jest.spyOn(logger['logger'], 'info');
    logger.info('Test message', { data: 'test' });
    expect(logSpy).toHaveBeenCalled();
  });

  test('should handle errors correctly', () => {
    const errorSpy = jest.spyOn(logger['logger'], 'error');
    const testError = new Error('Test error');
    logger.error('Error occurred', testError);
    expect(errorSpy).toHaveBeenCalled();
  });

  test('should create child logger', () => {
    const childLogger = logger.child('Child');
    expect(childLogger).toBeInstanceOf(Logger);
  });

  test('should set log level', () => {
    logger.setLevel('debug');
    expect(logger['logger'].level).toBe('debug');
  });

  test('should log connection events', () => {
    const infoSpy = jest.spyOn(logger, 'info');
    logger.logConnection('device-123', 'connected', { ip: '192.168.1.1' });
    expect(infoSpy).toHaveBeenCalledWith('Device connected', {
      deviceId: 'device-123',
      action: 'connected',
      ip: '192.168.1.1'
    });
  });

  test('should log session events', () => {
    const infoSpy = jest.spyOn(logger, 'info');
    logger.logSession('session-456', 'started', { duration: 0 });
    expect(infoSpy).toHaveBeenCalledWith('Session started', {
      sessionId: 'session-456',
      action: 'started',
      duration: 0
    });
  });

  test('should log authentication events', () => {
    const infoSpy = jest.spyOn(logger, 'info');
    const warnSpy = jest.spyOn(logger, 'warn');
    
    logger.logAuth('user-789', 'login');
    expect(infoSpy).toHaveBeenCalledWith('User login', {
      userId: 'user-789',
      action: 'login'
    });

    logger.logAuth('user-789', 'failed');
    expect(warnSpy).toHaveBeenCalledWith('Authentication failed', {
      userId: 'user-789',
      action: 'failed'
    });
  });

  test('should log performance metrics', () => {
    const debugSpy = jest.spyOn(logger, 'debug');
    logger.logPerformance('database_query', 150, { query: 'SELECT * FROM users' });
    expect(debugSpy).toHaveBeenCalledWith('Performance: database_query took 150ms', {
      operation: 'database_query',
      duration: 150,
      query: 'SELECT * FROM users'
    });
  });
});
