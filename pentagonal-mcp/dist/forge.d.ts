export type SolanaType = 'token' | 'program';
export declare function generateContract(prompt: string, chain: string, useRules?: boolean, solanaType?: SolanaType): Promise<{
    code: string;
    rulesApplied: number;
}>;
export interface AuditFinding {
    agent: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    line?: number;
}
export declare function auditContract(code: string, chain: string, useRules?: boolean): Promise<{
    findings: AuditFinding[];
    rulesApplied: number;
    newRulesLearned: number;
}>;
export declare function fixVulnerability(code: string, findingTitle: string, findingDescription: string): Promise<string>;
//# sourceMappingURL=forge.d.ts.map