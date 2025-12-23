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
    // context is now string[]
    const { context, code } = e.data;

    try {
        await init();

        // 1. Ingest Context (Batch Mode)
        let batchIndex = 0;
        for (const batch of context) {
            try {
                // We await each batch to ensure sequentiality
                for await (const _ of pl.query(batch)) { }
            } catch (batchErr) {
                // Log but continue? Or fail?
                // For now, we log specific batch failures but try to proceed.
                // This makes the system resilient to one bad node description.
                console.error(`Context Batch ${batchIndex} Failed:`, batchErr, "\nBatch Content:", batch);
            }
            batchIndex++;
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
                if (result.answer && Object.keys(result.answer).length > 0) {
                    outputs.push(JSON.stringify(result.answer));
                }
            } else if (result.status === 'error') {
                throw new Error(`Query Error: ${result.error}`);
            }
        }

        // 4. Output
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
