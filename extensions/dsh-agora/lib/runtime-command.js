import { spawn } from 'node:child_process';
export const runRuntimeCommand = request => new Promise((resolve, reject) => {
    if (request.signal.aborted) {
        reject(request.signal.reason);
        return;
    }
    const child = spawn(request.command, [...request.args], {
        shell: false,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        ...(request.cwd === undefined ? {} : { cwd: request.cwd }),
        env: { ...process.env, ...request.env },
    });
    let stdout = '';
    let stderr = '';
    const maxBytes = 16 * 1024 * 1024;
    const append = (current, chunk) => {
        const next = current + chunk.toString('utf8');
        if (Buffer.byteLength(next) > maxBytes) {
            child.kill('SIGTERM');
            throw new Error(`runtime command output exceeded ${maxBytes} bytes`);
        }
        return next;
    };
    child.stdout.on('data', chunk => {
        try {
            stdout = append(stdout, chunk);
        }
        catch (error) {
            reject(error);
        }
    });
    child.stderr.on('data', chunk => {
        try {
            stderr = append(stderr, chunk);
        }
        catch (error) {
            reject(error);
        }
    });
    const onAbort = () => { child.kill('SIGTERM'); };
    request.signal.addEventListener('abort', onAbort, { once: true });
    child.once('error', error => {
        request.signal.removeEventListener('abort', onAbort);
        reject(error);
    });
    child.once('close', exitCode => {
        request.signal.removeEventListener('abort', onAbort);
        if (request.signal.aborted)
            reject(request.signal.reason);
        else
            resolve({ exitCode, stdout, stderr });
    });
    child.stdin.end(request.input ?? '');
});
//# sourceMappingURL=runtime-command.js.map