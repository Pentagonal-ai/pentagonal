export interface CompileResult {
    success: boolean;
    contractName?: string;
    abi?: unknown[];
    bytecode?: string;
    constructorArgs?: Array<{
        name: string;
        type: string;
        internalType?: string;
    }>;
    gasEstimates?: {
        codeDeposit?: string;
        execution?: string;
        total?: string;
    } | null;
    warnings?: Array<{
        message: string;
        severity: string;
    }>;
    availableContracts?: string[];
    errors?: Array<{
        message: string;
        severity: string;
    }>;
    pragma?: string;
    solcVersion?: string;
}
export declare function compileSolidity(sourceCode: string, contractName?: string): CompileResult;
//# sourceMappingURL=compiler.d.ts.map