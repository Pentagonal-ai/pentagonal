import { promises as fs } from 'fs';
import path from 'path';

const RULES_PATH = path.join(process.cwd(), 'pentagonal-rules.md');

export async function loadRules(): Promise<string[]> {
  try {
    const content = await fs.readFile(RULES_PATH, 'utf-8');
    const lines = content.split('\n');
    const rules: string[] = [];

    for (const line of lines) {
      const match = line.match(/^\d+\.\s+(.+)$/);
      if (match) {
        rules.push(match[1].trim());
      }
    }

    return rules;
  } catch {
    return [];
  }
}

export async function appendRules(newRules: string[]): Promise<void> {
  const existing = await loadRules();
  const existingSet = new Set(existing.map((r) => r.toLowerCase()));
  const unique = newRules.filter((r) => !existingSet.has(r.toLowerCase()));

  if (unique.length === 0) return;

  let content: string;
  try {
    content = await fs.readFile(RULES_PATH, 'utf-8');
  } catch {
    content = `# Pentagonal Security Rules

_Self-healing rules learned from AI pen testing._
_These rules are injected into contract generation prompts when Learning is ON._

---

`;
  }

  // Find the highest rule number
  const numbers = content.match(/^(\d+)\./gm) || [];
  let nextNum = numbers.length > 0
    ? Math.max(...numbers.map((n) => parseInt(n))) + 1
    : 1;

  // Append new rules
  const newLines = unique.map((r) => `${nextNum++}. ${r}`).join('\n');
  content = content.trimEnd() + '\n' + newLines + '\n';

  // Update timestamp
  content = content.replace(
    /_Last updated:.*_/,
    `_Last updated: ${new Date().toISOString()}_`,
  );

  if (!content.includes('_Last updated:')) {
    content = content.replace(
      '---\n',
      `_Last updated: ${new Date().toISOString()}_\n\n---\n`,
    );
  }

  await fs.writeFile(RULES_PATH, content, 'utf-8');
}

export async function getRuleCount(): Promise<number> {
  const rules = await loadRules();
  return rules.length;
}
