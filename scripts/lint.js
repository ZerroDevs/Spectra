/**
 * Cross-platform JavaScript syntax validator
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const targetDirs = [path.join(__dirname, '..', 'assets', 'js'), __dirname];
let totalChecked = 0;
let errors = 0;

for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
    for (const file of files) {
        const fullPath = path.join(dir, file);
        totalChecked++;
        try {
            execFileSync(process.execPath, ['-c', fullPath], { stdio: 'pipe' });
            console.log(`[PASS] ${path.relative(path.join(__dirname, '..'), fullPath)}`);
        } catch (err) {
            console.error(`[FAIL] ${fullPath}:`, err.stderr.toString());
            errors++;
        }
    }
}

console.log(`\nSyntax validation complete. Checked ${totalChecked} files with ${errors} errors.`);
if (errors > 0) process.exit(1);
