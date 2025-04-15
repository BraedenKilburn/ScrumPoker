import {
  describe,
  it,
  expect,
  spyOn,
  beforeAll,
  afterEach,
  type Mock,
} from 'bun:test';
import { logger } from '../logger';

describe('Logger', () => {
  let consoleLogSpy: Mock<typeof console.log>;
  let consoleErrorSpy: Mock<typeof console.error>;

  beforeAll(() => {
    // Prevent actual console output during tests
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Clear mock calls between tests
    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  describe('info', () => {
    it('should log info message with timestamp', () => {
      logger.info('test info message');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy.mock.calls[0][0]).toContain('[INFO]');
      expect(consoleLogSpy.mock.calls[0][0]).toContain('test info message');
    });

    it('should log info message with additional data if provided', () => {
      const data = { key: 'value' };
      logger.info('test info with data', data);
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy.mock.calls[0][0]).toContain('test info with data');
      expect(consoleLogSpy.mock.calls[0][1]).toBe(data);
    });
  });

  describe('warn', () => {
    it('should log warning message with timestamp', () => {
      logger.warn('test warning message');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy.mock.calls[0][0]).toContain('[WARN]');
      expect(consoleLogSpy.mock.calls[0][0]).toContain('test warning message');
    });

    it('should log warning message with additional data if provided', () => {
      const data = { key: 'value' };
      logger.warn('test warning with data', data);
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy.mock.calls[0][0]).toContain('test warning with data');
      expect(consoleLogSpy.mock.calls[0][1]).toBe(data);
    });
  });

  describe('error', () => {
    it('should log error message with timestamp', () => {
      logger.error('test error message');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('[ERROR]');
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('test error message');
    });

    it('should log error message with error object if provided', () => {
      const error = new Error('test error');
      logger.error('test error with object', error);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('test error with object');
      expect(consoleErrorSpy.mock.calls[0][1]).toBe(error);
    });
  });

  describe('debug', () => {
    it('should log debug message when not in production', () => {
      // Save original NODE_ENV
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      logger.debug('test debug message');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy.mock.calls[0][0]).toContain('[DEBUG]');
      expect(consoleLogSpy.mock.calls[0][0]).toContain('test debug message');

      // Restore original NODE_ENV
      process.env.NODE_ENV = originalEnv;
    });

    it('should not log debug messages in production', () => {
      // Save original NODE_ENV
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      logger.debug('test debug message');
      expect(consoleLogSpy).not.toHaveBeenCalled();

      // Restore original NODE_ENV
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('websocket', () => {
    it('should log websocket message with timestamp', () => {
      logger.websocket('test websocket message');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy.mock.calls[0][0]).toContain('[WEBSOCKET]');
      expect(consoleLogSpy.mock.calls[0][0]).toContain('test websocket message');
    });

    it('should log websocket message with additional data if provided', () => {
      const data = { key: 'value' };
      logger.websocket('test websocket with data', data);
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy.mock.calls[0][0]).toContain('test websocket with data');
      expect(consoleLogSpy.mock.calls[0][1]).toBe(data);
    });
  });
});
