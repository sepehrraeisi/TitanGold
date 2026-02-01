// ============================================================================
// Unit Tests: Correlation Middleware (BACKEND-019)
// ============================================================================

import {
  correlationMiddleware,
  performanceTrackingMiddleware,
  correlationErrorHandler,
  getCorrelationId,
  createCorrelatedLogger,
  withCorrelation
} from '../../middleware/correlation.js';

describe('Correlation Middleware (BACKEND-019)', () => {
  let req, res, next;
  let capturedHeaders = {};
  let responseListeners = {};

  beforeEach(() => {
    capturedHeaders = {};
    responseListeners = {};
    
    // Setup request mock
    req = {
      method: 'GET',
      path: '/api/test',
      headers: {},
      query: {},
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' }
    };
    
    // Setup response mock
    res = {
      setHeader: (name, value) => {
        capturedHeaders[name] = value;
      },
      headersSent: false,
      statusCode: 200,
      on: (event, handler) => {
        responseListeners[event] = handler;
      }
    };
    
    // Setup next mock
    next = () => {};
  });

  // ============================================================================
  // correlationMiddleware Tests
  // ============================================================================

  describe('correlationMiddleware', () => {
    it('should generate correlation ID when not provided', () => {
      correlationMiddleware(req, res, next);
      
      expect(req.correlationId).toBeDefined();
      expect(req.requestId).toBeDefined();
      expect(req.correlationId).toBe(req.requestId);
      expect(typeof req.correlationId).toBe('string');
      expect(req.correlationId.length).toBeGreaterThan(0);
    });

    it('should use existing X-Request-ID header', () => {
      const existingId = 'existing-request-id-123';
      req.headers['x-request-id'] = existingId;
      
      correlationMiddleware(req, res, next);
      
      expect(req.correlationId).toBe(existingId);
      expect(req.requestId).toBe(existingId);
    });

    it('should use X-Correlation-ID as fallback', () => {
      const correlationId = 'correlation-id-456';
      req.headers['x-correlation-id'] = correlationId;
      
      correlationMiddleware(req, res, next);
      
      expect(req.correlationId).toBe(correlationId);
    });

    it('should prefer X-Request-ID over X-Correlation-ID', () => {
      const requestId = 'request-id-789';
      const correlationId = 'correlation-id-abc';
      req.headers['x-request-id'] = requestId;
      req.headers['x-correlation-id'] = correlationId;
      
      correlationMiddleware(req, res, next);
      
      expect(req.correlationId).toBe(requestId);
    });

    it('should set X-Request-ID response header', () => {
      correlationMiddleware(req, res, next);
      
      expect(capturedHeaders['X-Request-ID']).toBeDefined();
      expect(typeof capturedHeaders['X-Request-ID']).toBe('string');
    });

    it('should attach request-scoped logger', () => {
      correlationMiddleware(req, res, next);
      
      expect(req.log).toBeDefined();
      expect(typeof req.log.info).toBe('function');
      expect(typeof req.log.warn).toBe('function');
      expect(typeof req.log.error).toBe('function');
      expect(typeof req.log.debug).toBe('function');
    });

    it('should include query parameters in context', () => {
      req.query = { page: '1', limit: '10' };
      
      correlationMiddleware(req, res, next);
      
      expect(req.log).toBeDefined();
      // Logger is created, actual logging tested elsewhere
    });
  });

  // ============================================================================
  // Request-scoped Logger Tests
  // ============================================================================

  describe('Request-scoped Logger', () => {
    beforeEach(() => {
      correlationMiddleware(req, res, next);
    });

    it('should have all log methods', () => {
      expect(typeof req.log.info).toBe('function');
      expect(typeof req.log.warn).toBe('function');
      expect(typeof req.log.error).toBe('function');
      expect(typeof req.log.debug).toBe('function');
    });

    it('should not throw when logging', () => {
      expect(() => {
        req.log.info('test message');
        req.log.warn('warning message');
        req.log.error('error message');
        req.log.debug('debug message');
      }).not.toThrow();
    });

    it('should accept metadata', () => {
      expect(() => {
        req.log.info('test', { extra: 'data' });
      }).not.toThrow();
    });
  });

  // ============================================================================
  // performanceTrackingMiddleware Tests
  // ============================================================================

  describe('performanceTrackingMiddleware', () => {
    it('should register finish event listener', () => {
      performanceTrackingMiddleware(req, res, next);
      
      expect(responseListeners.finish).toBeDefined();
      expect(typeof responseListeners.finish).toBe('function');
    });

    it('should set X-Response-Time header on finish', () => {
      req.correlationId = 'test-id';
      req.log = {
        info: () => {},
        warn: () => {},
        error: () => {}
      };
      
      performanceTrackingMiddleware(req, res, next);
      
      // Simulate response finish
      responseListeners.finish();
      
      expect(capturedHeaders['X-Response-Time']).toBeDefined();
      expect(capturedHeaders['X-Response-Time']).toMatch(/^\d+\.\d{2}ms$/);
    });

    it('should log completion', () => {
      req.correlationId = 'test-id';
      let loggedMessage = null;
      req.log = {
        info: (msg) => { loggedMessage = msg; },
        warn: (msg) => { loggedMessage = msg; },
        error: (msg) => { loggedMessage = msg; }
      };
      
      performanceTrackingMiddleware(req, res, next);
      responseListeners.finish();
      
      expect(loggedMessage).toBe('request_completed');
    });

    it('should use error log level for 5xx responses', () => {
      req.correlationId = 'test-id';
      let logLevel = null;
      req.log = {
        info: () => { logLevel = 'info'; },
        warn: () => { logLevel = 'warn'; },
        error: () => { logLevel = 'error'; }
      };
      res.statusCode = 500;
      
      performanceTrackingMiddleware(req, res, next);
      responseListeners.finish();
      
      expect(logLevel).toBe('error');
    });

    it('should use warn log level for 4xx responses', () => {
      req.correlationId = 'test-id';
      let logLevel = null;
      req.log = {
        info: () => { logLevel = 'info'; },
        warn: () => { logLevel = 'warn'; },
        error: () => { logLevel = 'error'; }
      };
      res.statusCode = 404;
      
      performanceTrackingMiddleware(req, res, next);
      responseListeners.finish();
      
      expect(logLevel).toBe('warn');
    });
  });

  // ============================================================================
  // correlationErrorHandler Tests
  // ============================================================================

  describe('correlationErrorHandler', () => {
    it('should set X-Request-ID header if not sent', () => {
      const error = new Error('Test error');
      req.correlationId = 'error-id';
      res.headersSent = false;
      
      let nextCalled = false;
      const testNext = () => { nextCalled = true; };
      
      correlationErrorHandler(error, req, res, testNext);
      
      expect(capturedHeaders['X-Request-ID']).toBe('error-id');
      expect(nextCalled).toBe(true);
    });

    it('should not set header if already sent', () => {
      const error = new Error('Test error');
      req.correlationId = 'error-id';
      res.headersSent = true;
      
      correlationErrorHandler(error, req, res, next);
      
      expect(capturedHeaders['X-Request-ID']).toBeUndefined();
    });

    it('should call next with error', () => {
      const error = new Error('Test error');
      req.correlationId = 'error-id';
      
      let passedError = null;
      const testNext = (err) => { passedError = err; };
      
      correlationErrorHandler(error, req, res, testNext);
      
      expect(passedError).toBe(error);
    });
  });

  // ============================================================================
  // Utility Functions Tests
  // ============================================================================

  describe('getCorrelationId', () => {
    it('should return correlation ID from request', () => {
      req.correlationId = 'test-correlation-id';
      
      const id = getCorrelationId(req);
      
      expect(id).toBe('test-correlation-id');
    });

    it('should fallback to requestId', () => {
      req.requestId = 'test-request-id';
      
      const id = getCorrelationId(req);
      
      expect(id).toBe('test-request-id');
    });

    it('should return "unknown" if not present', () => {
      const id = getCorrelationId(req);
      
      expect(id).toBe('unknown');
    });
  });

  describe('createCorrelatedLogger', () => {
    it('should create logger with all methods', () => {
      const log = createCorrelatedLogger('custom-id');
      
      expect(typeof log.info).toBe('function');
      expect(typeof log.warn).toBe('function');
      expect(typeof log.error).toBe('function');
      expect(typeof log.debug).toBe('function');
    });

    it('should not throw when logging', () => {
      const log = createCorrelatedLogger('custom-id', { jobId: 'job-123' });
      
      expect(() => {
        log.info('test message');
        log.warn('warning');
        log.error('error');
        log.debug('debug');
      }).not.toThrow();
    });
  });

  describe('withCorrelation', () => {
    it('should wrap async handler', async () => {
      req.correlationId = 'wrap-test-id';
      let handlerCalled = false;
      
      const handler = async (req, res) => {
        handlerCalled = true;
        return 'success';
      };
      
      const wrapped = withCorrelation(handler);
      await wrapped(req, res, next);
      
      expect(handlerCalled).toBe(true);
    });

    it('should attach correlation ID to errors', async () => {
      req.correlationId = 'error-wrap-id';
      const error = new Error('Handler error');
      
      const handler = async () => {
        throw error;
      };
      
      let caughtError = null;
      const testNext = (err) => { caughtError = err; };
      
      const wrapped = withCorrelation(handler);
      await wrapped(req, res, testNext);
      
      expect(caughtError).toBe(error);
      expect(error.correlationId).toBe('error-wrap-id');
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration: Full Request Lifecycle', () => {
    it('should track correlation ID through entire request', () => {
      // 1. Correlation middleware
      correlationMiddleware(req, res, next);
      const correlationId = req.correlationId;
      
      expect(correlationId).toBeDefined();
      expect(capturedHeaders['X-Request-ID']).toBe(correlationId);
      
      // 2. Performance middleware
      performanceTrackingMiddleware(req, res, next);
      
      // 3. Handler logs with req.log
      expect(() => {
        req.log.info('Processing request');
      }).not.toThrow();
      
      // 4. Simulate response completion
      expect(responseListeners.finish).toBeDefined();
      responseListeners.finish();
      
      // Verify response time header set
      expect(capturedHeaders['X-Response-Time']).toBeDefined();
    });

    it('should preserve client-provided correlation ID', () => {
      const clientId = 'client-provided-id-123';
      req.headers['x-request-id'] = clientId;
      
      correlationMiddleware(req, res, next);
      
      expect(req.correlationId).toBe(clientId);
      expect(capturedHeaders['X-Request-ID']).toBe(clientId);
    });
  });
});
