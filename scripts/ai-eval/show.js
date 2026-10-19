// Prints a run for grading: per case the facts, every attempt with its check results, and
// the final copy.  node scripts/ai-eval/show.js --scratch <dir> --name <run> [--id recap:oct18]
// [--facts] (include the facts block; off by default to keep it short)
import fs from 'fs';
import path from 'path';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : null)).filter(Boolean));
const scratch = path.resolve(String(args.scratch || process.env.AI_EVAL_SCRATCH || ''));
const run = JSON.parse(fs.readFileSync(path.join(scratch, 'results', String(args.name), 'cases.json'), 'utf8'));
const text = r => (typeof r.output === 'string' ? r.output : r.output?.headline ? `${r.output.headline}\n${r.output.body}${r.output.notes ? '\n' + Object.entries(r.output.notes).map(([t, n]) => `${t}: ${n}`).join('\n') : ''}` : JSON.stringify(r.output));
console.log(`# ${run.name} — ${run.setup.providerOrder} / ${run.setup.models || run.setup.geminiModel} — ${run.totalCalls} calls\n`);
for (const r of run.results) {
  if (args.id && !r.id.startsWith(String(args.id))) continue;
  console.log(`## ${r.id}  (status ${r.status}, ${r.calls} calls, models ${r.models.join(', ')})`);
  if (args.facts && r.facts) console.log(`--- facts ---\n${r.facts}`);
  for (const a of r.attempts) {
    console.log(`--- attempt ${a.attempt} ---\n${a.copy}`);
    if (a.problems.length) console.log(`PROBLEMS: ${a.problems.join(' | ')}`);
  }
  console.log(`--- final (${r.final?.problems.length ?? '?'} problems left) ---\n${text(r)}\n`);
}
