const readline = require('readline');

function askHiddenPassword(prompt = '') {
    return new Promise((resolve) => {
        const stdin = process.stdin;
        const stdout = process.stdout;
        
        // Show prompt if provided
        if (prompt) {
            stdout.write(prompt);
        }
        
        // Set raw mode to capture each keystroke
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');
        
        let password = '';
        
        const onData = (char) => {
            // Convert buffer to string if needed
            const key = typeof char === 'string' ? char : char.toString();
            
            // Enter key - finish input
            if (key === '\n' || key === '\r') {
                stdin.setRawMode(false);
                stdin.pause();
                stdin.removeListener('data', onData);
                stdout.write('\n');
                resolve(password);
                return;
            }
            
            // Backspace or Delete
            if (key === '\b' || key === '\x7f') {
                if (password.length > 0) {
                    password = password.slice(0, -1);
                    stdout.write('\b \b');
                }
                return;
            }
            
            // Ctrl+C - exit
            if (key === '\x03') {
                stdin.setRawMode(false);
                stdin.pause();
                stdin.removeListener('data', onData);
                stdout.write('\n');
                process.exit(0);
                return;
            }
            
            // Any other character - add to password
            // Only accept printable characters (ASCII 32-126)
            if (key.length === 1 && key.charCodeAt(0) >= 32 && key.charCodeAt(0) <= 126) {
                password += key;
                stdout.write('*');
            }
        };
        
        stdin.on('data', onData);
    });
}

async function askPassword(prompt = '?? Enter password: ') {
    return askHiddenPassword(prompt);
}

module.exports = { askHiddenPassword, askPassword };
