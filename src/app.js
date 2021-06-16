import './config/dotenv.js';
import postgres from './config/postgres.js';
import initPostgres from './lib/database/utils/init.js';
import convertKey from './main/convert-key.js';
import insertIntoDatabase from './main/insert-database.js';
import keys from './config/keys.js';

/**
 * Check arguments and run converter
 */
const startConvert = () => {
    const args = [...process.argv];
    if (args < 3) {
        console.error('Invalid arguments');
    } else {
        try {
            const action = args[2];
            if (action === 'convert') {
                keys.forEach((key) => convertKey(key));
            } else if (action === 'insert') {
                keys.forEach((key) => insertIntoDatabase(key.keyWeb));
            } else console.error('Invalid arguments');
        } catch (err) {
            console.error(err);
        }
    }
};

/**
 * Check database connection and start application
 */
const run = async () => {
    try {
        await postgres.authenticate();
        await initPostgres();
        startConvert();
    } catch (err) {
        console.error(err);
    }
};

run();
