const { execSync } = require('child_process');

const PORTS = [3000, 3001, 5173];

console.log('🧹 Cleaning up ports:', PORTS.join(', '));

PORTS.forEach(port => {
    try {
        // Find PID occupying the port
        const stdout = execSync(`lsof -ti:${port}`, { encoding: 'utf-8' }).trim();

        if (stdout) {
            const pids = stdout.split('\n');
            pids.forEach(pid => {
                try {
                    process.kill(parseInt(pid), 'SIGKILL');
                    console.log(`✅ Killed process ${pid} on port ${port}`);
                } catch (e) {
                    console.warn(`⚠️ Failed to kill process ${pid}: ${e.message}`);
                }
            });
        }
    } catch (error) {
        // lsof returns status 1 if no process found, which throws an error in execSync
        // We ignore this as it means the port is already free
    }
});

console.log('✨ Ports are clear.');
