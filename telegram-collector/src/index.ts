/**
 * Telegram Collector – entry point.
 * Loads the legacy app bundle (dist/index.legacy.js) and starts the server.
 * See README and TELEGRAM_COLLECTOR_ANALYSIS.md for architecture.
 */
import path from 'path';

const legacyPath = path.join(__dirname, 'index.legacy.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { startServer } = require(legacyPath);

startServer();
