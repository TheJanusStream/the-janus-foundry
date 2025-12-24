self.onmessage = async (e) => {
    const { code } = e.data;
    const logs: string[] = [];

    // 1. Create a proxy console to capture output
    const consoleProxy = {
        log: (...args: any[]) => logs.push(args.map(a => String(a)).join(' ')),
        error: (...args: any[]) => logs.push('ERROR: ' + args.map(a => String(a)).join(' ')),
        warn: (...args: any[]) => logs.push('WARN: ' + args.map(a => String(a)).join(' ')),
        info: (...args: any[]) => logs.push('INFO: ' + args.map(a => String(a)).join(' '))
    };

    try {
        // 2. Wrap code in an Async Function to support top-level await
        // We pass our proxy console and the native fetch
        const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;

        // Construct the function with explicit global overrides for safety/capture
        const func = new AsyncFunction(
            'console',
            'fetch',
            code
        );

        // 3. Execute
        await func(
            consoleProxy,
            self.fetch.bind(self)
        );

        // 4. Return Output
        self.postMessage({ type: 'RESULT', output: logs.join('\n') });

    } catch (err) {
        self.postMessage({ type: 'ERROR', message: String(err) });
    }
};

export { };
