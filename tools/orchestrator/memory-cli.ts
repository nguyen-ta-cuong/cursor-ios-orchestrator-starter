import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { errorMessage } from './files.ts';
import { initMemory, recordMemory, inspectMemory, formatMemory, MEMORY_PATH } from './memory.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const help = `Project memory (paths resolve from the repository root):
  npm run memory -- init --project "My App"
  npm run memory -- record --id fact-id --topic codebase|business-logic|dependencies|decisions --summary "Observed fact" --source relative/path [--source another/path]
  npm run memory -- show
  npm run memory -- check
Record summaries only after reading the evidence. Never store secrets or personal data.
init refuses to overwrite a store. record replaces only the named ID. check exits 1 for missing, empty, or stale memory.`;

try {
  const { values, positionals } = parseArgs({ options: {
    project: { type: 'string' }, id: { type: 'string' }, topic: { type: 'string' }, summary: { type: 'string' },
    source: { type: 'string', multiple: true }, help: { type: 'boolean' },
  }, allowPositionals: true });
  if (values.help || !positionals.length) console.log(help);
  else {
    if (positionals.length !== 1) throw new Error(help);
    const command = positionals[0];
    const allowed: Record<string, string[]> = { init: ['project'], record: ['id', 'topic', 'summary', 'source'], show: [], check: [] };
    if (!(command in allowed) || Object.keys(values).some(key => !allowed[command].includes(key))) throw new Error(help);
    if (command === 'init') {
      if (!values.project) throw new Error('--project is required');
      await initMemory(root, values.project);
      console.log(`Initialized ${MEMORY_PATH}`);
    } else if (command === 'record') {
      if (!values.id || !values.topic || !values.summary || !values.source?.length) throw new Error('record requires --id, --topic, --summary, and --source');
      const entry = await recordMemory(root, { id: values.id, topic: values.topic, summary: values.summary, sources: values.source });
      console.log(`Recorded ${entry.id} with ${entry.sources.length} evidence source(s).`);
    } else {
      const inspection = await inspectMemory(root);
      if (command === 'show') console.log(formatMemory(inspection, Infinity));
      else {
        for (const warning of inspection.warnings) console.error(warning);
        if (inspection.warnings.length) process.exitCode = 1;
        else console.log(`${inspection.observations.length} memory entries: all evidence hashes unchanged. Confirm summaries against source before reuse.`);
      }
    }
  }
} catch (error) { console.error(errorMessage(error)); process.exitCode = 1; }
