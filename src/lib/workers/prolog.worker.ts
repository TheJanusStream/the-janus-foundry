import { load, Prolog } from 'trealla';

let initialized = false;
let pl: Prolog;

async function init() {
    if (!initialized) {
        await load();
        initialized = true;
    }
    pl = new Prolog();
}

self.onmessage = async (e) => {
    const { context, code } = e.data;

    try {
        await init();

        // 1. Ingest Context (Batch Mode)
        for (const batch of context) {
            try {
                for await (const _ of pl.query(batch)) { }
            } catch (batchErr) {
                console.error(`Context Batch Ingestion Failed:`, batchErr);
            }
        }

        // 2. Prepare User Code
        let query = code
            .replace(/%.*/g, '')
            .replace(/\.\s+(?=.+)/gs, ", ")
            .trim();

        if (query && !query.endsWith('.')) query += '.';

        // 3. Execute
        const outputs: string[] = [];
        let hasSucceeded = false;

        for await (const result of pl.query(query)) {
            if (result.stdout) {
                const lines = result.stdout.trim().split('\n');
                lines.forEach(l => { if (l) outputs.push(l); });
            }

            if (result.status === 'success') {
                hasSucceeded = true;
            } else if (result.status === 'error') {
                throw new Error(`Query Error: ${result.error}`);
            }
        }

        // 4. Return Output
        if (!hasSucceeded) {
            self.postMessage({ type: 'RESULT', output: 'false.' });
        } else if (outputs.length === 0) {
            self.postMessage({ type: 'RESULT', output: 'true.' });
        } else {
            self.postMessage({ type: 'RESULT', output: outputs.join('\n') });
        }

    } catch (err) {
        self.postMessage({ type: 'ERROR', message: String(err) });
    }
};