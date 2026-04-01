// ─── Self-Learning Rules Engine ───
// Reads/writes the pentagonal-rules.md file that accumulates security knowledge
import { promises as fs } from 'fs';
import path from 'path';
const DEFAULT_RULES_PATH = path.join(process.cwd(), 'pentagonal-rules.md');
function getRulesPath() {
    return process.env.PENTAGONAL_RULES_PATH || DEFAULT_RULES_PATH;
}
export async function loadRules() {
    try {
        const content = await fs.readFile(getRulesPath(), 'utf-8');
        const lines = content.split('\n');
        const rules = [];
        for (const line of lines) {
            const match = line.match(/^\d+\.\s+(.+)$/);
            if (match) {
                rules.push(match[1].trim());
            }
        }
        return rules;
    }
    catch {
        return [];
    }
}
export async function appendRules(newRules) {
    const existing = await loadRules();
    const existingSet = new Set(existing.map(r => r.toLowerCase()));
    const unique = newRules.filter(r => !existingSet.has(r.toLowerCase()));
    if (unique.length === 0)
        return 0;
    let content;
    try {
        content = await fs.readFile(getRulesPath(), 'utf-8');
    }
    catch {
        content = `# Pentagonal Security Rules

_Self-healing rules learned from AI pen testing._
_These rules are injected into contract generation prompts when Learning is ON._

---

`;
    }
    // Find the highest rule number
    const numbers = content.match(/^(\d+)\./gm) || [];
    let nextNum = numbers.length > 0
        ? Math.max(...numbers.map(n => parseInt(n))) + 1
        : 1;
    const newLines = unique.map(r => `${nextNum++}. ${r}`).join('\n');
    content = content.trimEnd() + '\n' + newLines + '\n';
    // Update timestamp
    content = content.replace(/_Last updated:.*_/, `_Last updated: ${new Date().toISOString()}_`);
    if (!content.includes('_Last updated:')) {
        content = content.replace('---\n', `_Last updated: ${new Date().toISOString()}_\n\n---\n`);
    }
    await fs.writeFile(getRulesPath(), content, 'utf-8');
    return unique.length;
}
export async function getRuleCount() {
    const rules = await loadRules();
    return rules.length;
}
//# sourceMappingURL=rules.js.map