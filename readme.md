
# cluster-load-runner

A comprehensive Node.js library for building distributed HTTP performance testing frameworks using the cluster module. This library provides the core infrastructure for creating multi-threaded, coordinated load tests with support for data providers, custom workers, and multiple output formats.

## What is this for?

The cluster-load-runner provides a master-worker architecture for performance testing. It handles:

- **Process Management**: Spawns and manages worker threads using Node.js cluster module
- **Inter-Process Communication**: Coordinates message passing between master and worker processes
- **Data Providers**: Built-in providers for file and MySQL data sources that feed test data to workers
- **HTTP Request Utilities**: Simplified HTTP request handling with authentication and timing
- **Result Collection**: Aggregates performance metrics from all workers and outputs results in multiple formats (CSV, JSON, NewRelic, stdout)
- **Ramp-up Strategies**: Gradually increase load over time with configurable thread scheduling
- **Utility Functions**: Random data generation, caching, mathematical operations, and more

## Architecture Overview

The library uses a master-worker pattern:

- **Master Process** (`master.js`): Spawns workers, coordinates data flow between workers, collects and analyzes results
- **Worker Processes** (`worker.js`): Execute the actual load test scenarios, make HTTP requests, report results
- **Providers**: Special workers that supply data to regular workers (e.g., reading lines from CSV files)
- **Custom Worker Types**: Your application-specific test logic that imports this library

## Getting Started

### Option 1: Clone the Performance Framework (Recommended)

The easiest way to get started is to clone the [performance-framework](https://github.com/simpletun/performance-framework) repository as a starting point. It already has the correct structure, example scenarios, and worker implementations you can use as templates.

```bash
# Clone the performance-framework
git clone git@github.com:simpletun/performance-framework.git my-performance-tests
cd my-performance-tests

# Install dependencies
npm install

# Review the example scenarios
ls scenarios/

# Review the example workers
ls src/workers/

# Run an example scenario
npm run compile
npm start reference-example
```

From there, you can:
1. Modify the existing scenario files or create new ones in `scenarios/`
2. Modify the existing workers or create new ones in `src/workers/`
3. Update `package.json` with your project details
4. Customize for your specific testing needs

### Option 2: Start from Scratch

If you prefer to build from scratch, here's the basic structure you'll need:

## Quick Start Example

The performance-framework is a reference implementation that shows how to use this library. Here's the basic structure:

### 1. Entry Point (`src/start.js`)

```javascript
import { isMaster } from 'cluster';

if (isMaster) {
    require('cluster-load-runner/build/master');
} else {
    require('cluster-load-runner/build/worker');
}
```

This simple entry point determines whether the process is the master or a worker and loads the appropriate module from cluster-load-runner.

### 2. Project Structure

```
your-performance-project/
├── src/
│   ├── start.js                    # Entry point
│   └── workers/
│       ├── your-worker-type.js     # Custom worker implementations
│       └── another-worker.js
├── scenarios/
│   ├── your-scenario.js            # Test scenario configurations
│   └── another-scenario.js
└── package.json
```

## Defining Scenario Documents

Scenarios are JavaScript files that export configuration for your performance test. They define what workers to run, how many threads to use, and test parameters.

### Basic Scenario Structure

Create a file in your `scenarios/` directory (e.g., `scenarios/my-test.js`):

```javascript
const second = 1000;
const minute = 60 * second;

// Global scenario configuration
const scenario = {
    duration: 5 * minute  // Test runs for 5 minutes
};

const server = {
    ssl: true,
    hostname: 'api.example.com',
    headers: {
        'Content-Type': 'application/json'
    }
};

// Export providers (optional) - workers that supply data to other workers
exports.providers = [
    {
        workerType: 'file-data-provider',     // Built-in provider from cluster-load-runner
        workerGroup: 'dataReader',            // Name used by workers to request data
        threads: 1,                           // Usually 1 thread for providers
        fileName: 'test-data.csv',           // File to read from
        recycleOnEof: true,                   // Loop back to start when file ends
        chunkSize: Infinity,
        bufferSize: 512 * 1024
    }
];

// Export workers - your custom test logic
exports.workers = [
    {
        workerType: 'my-custom-worker',       // Name of your worker file (src/workers/my-custom-worker.js)
        threads: 10,                          // Number of parallel workers
        subThreads: 5,                        // Each worker runs 5 concurrent loops
        thinkFrom: 200,                       // Minimum delay between requests (ms)
        thinkTo: 500,                         // Maximum delay between requests (ms)
        server,                               // Server configuration
        scenario                              // Scenario configuration
    }
];

// You can also use ramp-up for gradual load increase
const rampup = require('cluster-load-runner/build/utils/rampup');

exports.workers = [
    {
        workerType: 'my-custom-worker',
        threads: rampup.evenRampUp(50, 2 * minute),  // Ramp from 0 to 50 threads over 2 minutes
        subThreads: 3,
        server,
        scenario
    }
];
```

### Scenario Configuration Options

#### Providers Configuration

| Option | Type | Description |
|--------|------|-------------|
| `workerType` | string | Type of provider: `'file-data-provider'` or `'mysql-data-provider'` |
| `workerGroup` | string | Unique name workers use to request data from this provider |
| `threads` | number | Number of provider instances (usually 1) |
| `fileName` | string | (File provider) CSV file to read from |
| `recycleOnEof` | boolean | (File provider) Loop back to start when reaching end of file |
| `chunkSize` | number | (File provider) Read chunk size |
| `bufferSize` | number | (File provider) Buffer size for reading |

#### Workers Configuration

| Option | Type | Description |
|--------|------|-------------|
| `workerType` | string | Name of your worker file (without .js extension) |
| `threads` | number/array | Number of workers, or ramp-up array from `rampup.evenRampUp()` |
| `subThreads` | number | How many concurrent loops each worker runs |
| `thinkFrom` | number | Minimum delay between requests (milliseconds) |
| `thinkTo` | number | Maximum delay between requests (milliseconds) |
| `server` | object | Server connection details (hostname, ssl, headers) |
| `scenario` | object | Reference to scenario configuration (duration, etc.) |
| `workerGroup` | string | (Optional) Group name for workers that need to coordinate |
| (custom) | any | Any custom configuration your worker needs |

## Creating a New Worker Type

Workers are the heart of your performance test. They define what requests to make and how to make them.

### Step 1: Create Worker File

Create a new file in `src/workers/` directory. The filename (without extension) becomes your `workerType`.

Example: `src/workers/api-test.js`

```javascript
import {
    config,           // Configuration from scenario
    shutdown,         // Function to stop worker
    onMessage,        // Listen for messages from master
    makeRequest,      // Make HTTP requests with timing
    sleep,            // Sleep utility
    randomNumberFrom, // Random number generator
    logger,           // Logging utility
    getAuthToken,     // Get OAuth token
    FileReadMessenger // Request data from file provider
} from 'cluster-load-runner';

// If using a data provider, create a messenger
const dataMessenger = new FileReadMessenger({
    workerGroup: 'dataReader'  // Must match provider's workerGroup in scenario
});

// Handle stop message from master
onMessage('stop', () => {
    shutdown();
});

// Handle start message - begins the test
onMessage('start', async () => {
    logger.info(`Starting test for ${config.scenario.duration / 1000}s`);

    // Start multiple concurrent loops (subThreads)
    for (let i = 0; i < config.subThreads; i++) {
        startSubThread();
    }
});

// Each subthread runs independently
const startSubThread = async () => {
    // Get authentication token if needed
    const authToken = await getAuthToken();

    // Loop until master sends 'stop' message
    while (true) {
        try {
            await performTest(authToken);
        } catch (error) {
            logger.error(`Test error: ${error.message}`);
        }

        // Random "think time" between requests
        await sleep(randomNumberFrom(config.thinkFrom, config.thinkTo));
    }
};

// Your actual test logic
const performTest = async (authToken) => {
    // Get test data from provider (if using one)
    const testData = await dataMessenger.getLine(config.randomLine);

    // Make HTTP request - automatically times and reports results to master
    await makeRequest({
        transactionName: 'API Test Request',  // Shows up in results
        requestConfig: {
            path: `/api/endpoint/${testData}`,
            method: 'GET',
            headers: {
                'Authorization': authToken
            }
        }
    });
};
```

### Step 2: Use in Scenario

Reference your worker in a scenario file:

```javascript
exports.workers = [
    {
        workerType: 'api-test',  // Matches filename: src/workers/api-test.js
        threads: 10,
        subThreads: 5,
        thinkFrom: 200,
        thinkTo: 500,
        randomLine: true,
        server: {
            ssl: true,
            hostname: 'api.example.com'
        },
        scenario: {
            duration: 5 * 60 * 1000
        }
    }
];
```

### Worker Best Practices

1. **Always handle 'stop' and 'start' messages**: These control your worker's lifecycle
2. **Use subThreads for concurrency**: Each worker can run multiple concurrent test loops
3. **Add think time**: Use `sleep()` between requests to simulate realistic user behavior
4. **Error handling**: Wrap test logic in try-catch to prevent worker crashes
5. **Use makeRequest()**: This utility automatically times requests and reports results to the master
6. **Log appropriately**: Use `logger.debug()`, `logger.info()`, `logger.error()` for different verbosity levels

### Available Utilities from cluster-load-runner

The library exports many utilities for building workers:

```javascript
// Worker lifecycle
config          // Your scenario configuration
shutdown()      // Stop this worker
onMessage()     // Listen for messages from master
sendMessage()   // Send messages to master

// HTTP utilities
makeRequest()   // Make HTTP request with automatic timing and reporting
request()       // Lower-level HTTP request
getAuthToken()  // Get OAuth authentication token

// Data providers
FileReadMessenger    // Request data from file-data-provider
MysqlQueryMessenger  // Request data from mysql-data-provider

// Utilities
sleep()                  // Async sleep
randomNumberFrom()       // Random number in range
randomInt()             // Random integer
randomItem()            // Pick random item from array
coinFlip()              // Random boolean
logger                  // Winston logger instance

// Math utilities
mean()
variance()
standardDeviation()

// Query generation
generateQuery()
generateBaseExportQuery()

// Caching
cache                // Cache utility
cachedFunction()     // Memoization wrapper
```

## Running Tests

After setting up scenarios and workers:

```bash
# Compile your workers
npm run compile

# Run a specific scenario
npm start your-scenario

# The master process will:
# 1. Load the scenario configuration
# 2. Spawn provider workers
# 3. Spawn test workers
# 4. Coordinate data flow
# 5. Collect and report results
# 6. Output results to CSV/JSON/stdout
```

## Advanced: Inter-Worker Communication

Workers can communicate with each other through the master process:

### Broadcast to Worker Group

```javascript
// In scenario, assign workers to a group
exports.workers = [
    {
        workerType: 'receiver-worker',
        workerGroup: 'receivers',  // Group name
        threads: 5
    }
];

// In another worker, broadcast to the group
sendMessage('broadcast', {
    workerGroup: 'receivers',
    messages: [
        { type: 'custom-message', data: 'Hello all receivers!' }
    ]
});
```

### Round-Robin to Worker Group

```javascript
// Send messages in round-robin fashion to group
sendMessage('roundrobin', {
    workerGroup: 'receivers',
    messages: [
        { type: 'task', id: 1 },
        { type: 'task', id: 2 },
        { type: 'task', id: 3 }
    ]
});
```

### Direct Message to Specific Worker

```javascript
// Send to specific worker by PID
sendMessage('direct', {
    to: targetPid,
    message: { type: 'custom', data: 'Hello specific worker!' }
});
```

## Output Formats

Results can be output in multiple formats (configured via command-line flags):

- **CSV**: Detailed per-request results in CSV format
- **JSON**: Results in JSON format
- **NewRelic**: Send metrics to NewRelic APM
- **Stdout**: Print results to console

The master process automatically calculates:
- Average response time
- Min/Max response times
- 95th percentile statistics
- Success/error counts
- Total request count

## Developing / Building cluster-load-runner

The project is setup using Babel for ES6+ transpilation.

### Building

```bash
npm run build
```

This creates transpiled files in the `build/` directory.

### Testing

```bash
npm test           # Run tests
npm run coverage   # Generate coverage report
npm run lint       # Run linter
```

### Project Structure

```
cluster-load-runner/
├── src/
│   ├── index.js           # Main exports
│   ├── master.js          # Master process implementation
│   ├── worker.js          # Worker process base implementation
│   ├── providers/         # Built-in data providers
│   │   ├── file-data-provider.js
│   │   └── mysql-data-provider.js
│   ├── outputs/           # Output formatters
│   │   ├── csv.js
│   │   ├── json.js
│   │   ├── newrelic.js
│   │   └── stdout.js
│   └── utils/             # Utility functions
│       ├── logger.js
│       ├── makeRequest.js
│       ├── fileReadMessenger.js
│       ├── rampup.js
│       ├── random.js
│       └── ...
└── build/                 # Compiled output (generated)
```

The `src/index.js` file defines the library's public API. All exports from this file are available to consumers of the library.
