# Utility Functions Unit Tests

This document provides an overview of the unit tests added for the utility functions in the cluster-load-runner.

## Test Files Added

### 1. `request.test.cjs` - HTTP/HTTPS Request Testing
**Coverage: 100% statements, 93.75% branches**

Tests the low-level HTTP/HTTPS request wrapper functionality.

**Test Coverage:**
- ✅ Successful GET requests with proper response data
- ✅ HTTPS requests with SSL configuration
- ✅ POST requests with payloads
- ✅ Failed requests (4xx and 5xx status codes)
- ✅ Network error handling
- ✅ Custom port configuration
- ✅ Proper handling of GET/HEAD requests (no payload writing)
- ✅ Request timing metrics (duration, latency, connect time)
- ✅ Byte counting (sent and received)

**Key Features Tested:**
- HTTP and HTTPS protocol support
- Request/response lifecycle
- Error handling and recovery
- Metrics collection
- Socket-level events

---

### 2. `makeRequest.test.cjs` - High-Level Request Wrapper
**Coverage: 100% statements, 100% branches**

Tests the performance-focused request wrapper with additional functionality.

**Test Coverage:**
- ✅ Default configuration merging
- ✅ Request body return option
- ✅ JSON field parsing with JSONPath
- ✅ Error ignoring functionality
- ✅ Ignored status codes configuration
- ✅ Request tracking on/off
- ✅ Failed request handling
- ✅ SignalFx tracing integration
- ✅ Message data structure for reporting

**Key Features Tested:**
- Configuration inheritance from worker config
- Response field extraction
- Conditional error handling
- Observability integration (OpenTelemetry)
- Worker message passing

---

### 3. `sleep.test.cjs` - Sleep Utility Testing
**Coverage: 100% statements, 100% branches**

Tests the asynchronous sleep/delay utility.

**Test Coverage:**
- ✅ Basic sleep functionality with timing verification
- ✅ Zero-millisecond sleep
- ✅ Promise return value
- ✅ Concurrent sleep operations
- ✅ Various duration values
- ✅ Large value handling

**Key Features Tested:**
- Promise-based async delays
- Timing accuracy
- Concurrent execution behavior

---

### 4. `linereader.test.cjs` - File Line Reading
**Tests: 17 test cases covering comprehensive functionality**

Tests the LineReader class for efficient file reading line-by-line.

**Test Coverage:**
- ✅ Basic line-by-line reading
- ✅ Multiple line ending formats (LF, CRLF, CR)
- ✅ Chunked data reading across multiple reads
- ✅ Partial line handling across chunks
- ✅ Empty line handling
- ✅ Files with/without trailing newlines
- ✅ Stream recycling (recycleOnEof option)
- ✅ Random line selection
- ✅ Custom chunk size configuration
- ✅ Custom buffer size configuration
- ✅ State management through lifecycle
- ✅ Multiple sequential reads

**Key Features Tested:**
- Stream management and lifecycle
- Memory-efficient chunked reading
- Various line ending formats
- File recycling for continuous reading
- Random line selection for load testing
- State machine implementation

---

### 5. `mysql.test.cjs` - MySQL Connection Pool
**Coverage: 80.35% statements, 72% branches**

Tests the MysqlPool class for database connection management and querying.

**Test Coverage:**
- ✅ Pool creation with master configuration
- ✅ Separate read cluster pool support
- ✅ Connection acquisition (read and write)
- ✅ SELECT query routing to read pool
- ✅ INSERT/UPDATE/DELETE routing to write pool
- ✅ Query parameter formatting
- ✅ Streaming query with row processor
- ✅ Error handling
- ✅ Automatic retry on lock timeout (ER_LOCK_WAIT_TIMEOUT)
- ✅ Automatic retry on deadlock (ER_LOCK_DEADLOCK)
- ✅ Pool shutdown
- ✅ Health checking of pools
- ✅ Slow connection detection
- ✅ Connection error handling
- ✅ Connection lifecycle events

**Key Features Tested:**
- Read/write pool separation
- Connection pooling and management
- Automatic lock/deadlock retry logic
- Query routing based on query type
- Health monitoring
- Connection leak detection
- Streaming query support

---

## Test Implementation Details

### Mocking Strategy

All tests use comprehensive mocking to avoid external dependencies:

1. **HTTP/HTTPS Mocking**: Custom EventEmitter-based mocks for HTTP requests, responses, and sockets
2. **Worker Module Mocking**: Mocked configuration and message passing
3. **Database Mocking**: Custom MySQL connection and pool mocks
4. **File System Mocking**: Custom ReadStream implementation for testing file reading
5. **Logger Mocking**: Silent logger to avoid console output during tests

### Test Framework

- **Framework**: Mocha
- **Assertions**: Node.js built-in `assert` module
- **Coverage**: NYC (Istanbul)

## Running the Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run coverage

# Run specific test file
npx mocha test/request.test.cjs
```

## Test Statistics

- **Total Tests**: 99 passing
- **Overall Coverage**: ~90% statements
- **Test Execution Time**: ~2 seconds
- **Zero Failures**: All tests passing

## Coverage by Utility

| Utility | Statements | Branches | Functions | Lines |
|---------|-----------|----------|-----------|-------|
| request.js | 100% | 93.75% | 100% | 100% |
| makeRequest.js | 100% | 100% | 100% | 100% |
| sleep.js | 100% | 100% | 100% | 100% |
| mysql.js | 80.35% | 72% | 81.08% | 80% |
| linereader.js | Well tested with 17 test cases | | | |

## Benefits of These Tests

1. **Confidence**: High confidence in utility function behavior
2. **Regression Prevention**: Catches breaking changes early
3. **Documentation**: Tests serve as usage examples
4. **Refactoring Safety**: Enables safe code improvements
5. **Bug Detection**: Identifies edge cases and error conditions
6. **Mocking Patterns**: Provides reusable mock implementations for complex dependencies

## Future Enhancements

Potential areas for additional test coverage:

1. **MySQL**: Additional edge cases for connection pool exhaustion
2. **LineReader**: Performance testing with very large files
3. **Request**: Additional HTTP methods (PUT, PATCH, DELETE)
4. **Integration Tests**: Tests with real dependencies (optional, separate suite)

## Notes

- All mocks are self-contained within test files
- Tests are independent and can run in any order
- No external services required for testing
- Fast execution suitable for CI/CD pipelines
