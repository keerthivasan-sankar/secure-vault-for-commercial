const readline = require('readline');

// Non-secret masked prompt (used for y/n confirmations like "Proceed? (y/n)").
// Returns a plain string - fine since these aren't sensitive values.
function askHiddenPassword(prompt = '') {
    return new Promise((resolve) => {
        const stdin = process.stdin;
        const stdout = process.stdout;

        if (prompt) {
            stdout.write(prompt);
        }

        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');

        let value = '';

        const onData = (char) => {
            const key = typeof char === 'string' ? char : char.toString();

            if (key === '\n' || key === '\r') {
                stdin.setRawMode(false);
                stdin.pause();
                stdin.removeListener('data', onData);
                stdout.write('\n');
                resolve(value);
                return;
            }

            if (key === '\b' || key === '\x7f') {
                if (value.length > 0) {
                    value = value.slice(0, -1);
                    stdout.write('\b \b');
                }
                return;
            }

            if (key === '\x03') {
                stdin.setRawMode(false);
                stdin.pause();
                stdin.removeListener('data', onData);
                stdout.write('\n');
                process.exit(0);
                return;
            }

            if (key.length === 1 && key.charCodeAt(0) >= 32 && key.charCodeAt(0) <= 126) {
                value += key;
                stdout.write('*');
            }
        };

        stdin.on('data', onData);
    });
}

// Secret prompt for actual passwords/passphrases. Returns a Buffer instead
// of a string. JS strings are immutable and cannot be reliably zeroed from
// memory; a Buffer can be explicitly overwritten with crypto.wipe() once
// the caller is done with it, shrinking the window the plaintext password
// sits in memory. This is still not an absolute guarantee (see the note in
// crypto.js), but it's a real improvement over holding it as a string.
function askSecret(prompt = '') {
    return new Promise((resolve) => {
        const stdin = process.stdin;
        const stdout = process.stdout;

        if (prompt) {
            stdout.write(prompt);
        }

        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');

        let chars = []; // array of single-character Buffers

        const onData = (char) => {
            const key = typeof char === 'string' ? char : char.toString();

            if (key === '\n' || key === '\r') {
                stdin.setRawMode(false);
                stdin.pause();
                stdin.removeListener('data', onData);
                stdout.write('\n');
                const result = Buffer.concat(chars);
                for (const c of chars) c.fill(0);
                chars = [];
                resolve(result);
                return;
            }

            if (key === '\b' || key === '\x7f') {
                if (chars.length > 0) {
                    const last = chars.pop();
                    last.fill(0);
                    stdout.write('\b \b');
                }
                return;
            }

            if (key === '\x03') {
                stdin.setRawMode(false);
                stdin.pause();
                stdin.removeListener('data', onData);
                stdout.write('\n');
                for (const c of chars) c.fill(0);
                process.exit(0);
                return;
            }

            if (key.length === 1 && key.charCodeAt(0) >= 32 && key.charCodeAt(0) <= 126) {
                chars.push(Buffer.from(key, 'utf8'));
                stdout.write('*');
            }
        };

        stdin.on('data', onData);
    });
}

async function askPassword(prompt = 'Enter password: ') {
    return askHiddenPassword(prompt);
}

module.exports = { askHiddenPassword, askSecret, askPassword };
