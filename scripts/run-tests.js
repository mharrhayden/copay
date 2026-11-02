import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
let failed = false;
for (const file of readdirSync('.').filter(name => name.endsWith('.test.js')).sort()) {
  console.log(`\n${file}`);
  const result = spawnSync(process.execPath, [file], { stdio: 'inherit' });
  if (result.error) console.error(result.error);
  if (result.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
