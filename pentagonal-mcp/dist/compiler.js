// ─── Solidity Compiler ───
// Wraps solc for headless compilation — ABI, bytecode, gas estimates
import solc from 'solc';
function findImport(path) {
    if (path.startsWith('@openzeppelin/')) {
        return {
            error: `OpenZeppelin imports are not supported in MCP compilation. Pentagonal's AI generator produces self-contained code by default.`,
        };
    }
    return { error: `Import not found: ${path}` };
}
export function compileSolidity(sourceCode, contractName) {
    if (!sourceCode || !sourceCode.trim()) {
        return { success: false, errors: [{ message: 'No source code provided', severity: 'error' }] };
    }
    // Detect pragma
    const pragmaMatch = sourceCode.match(/pragma\s+solidity\s+[^;]+;/);
    const pragma = pragmaMatch ? pragmaMatch[0] : 'pragma solidity ^0.8.20;';
    const input = {
        language: 'Solidity',
        sources: {
            'Contract.sol': { content: sourceCode },
        },
        settings: {
            optimizer: { enabled: true, runs: 200 },
            outputSelection: {
                '*': { '*': ['abi', 'evm.bytecode', 'evm.gasEstimates'] },
            },
            evmVersion: 'paris',
        },
    };
    const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));
    const errors = (output.errors || []).filter((e) => e.severity === 'error');
    const warnings = (output.errors || []).filter((e) => e.severity === 'warning');
    if (errors.length > 0) {
        return {
            success: false,
            errors: errors.map((e) => ({
                message: e.formattedMessage || e.message,
                severity: e.severity,
            })),
            warnings: warnings.map((w) => ({
                message: w.formattedMessage || w.message,
                severity: w.severity,
            })),
            pragma,
        };
    }
    const contracts = output.contracts?.['Contract.sol'];
    if (!contracts || Object.keys(contracts).length === 0) {
        return { success: false, errors: [{ message: 'Compilation produced no contracts', severity: 'error' }] };
    }
    const targetName = contractName || Object.keys(contracts)[0];
    const compiled = contracts[targetName];
    if (!compiled) {
        return {
            success: false,
            errors: [{ message: `Contract "${targetName}" not found. Available: ${Object.keys(contracts).join(', ')}`, severity: 'error' }],
            availableContracts: Object.keys(contracts),
        };
    }
    const abi = compiled.abi;
    const bytecode = '0x' + compiled.evm.bytecode.object;
    const gasEstimates = compiled.evm.gasEstimates;
    const constructorAbi = abi.find((item) => item.type === 'constructor');
    const constructorArgs = constructorAbi?.inputs?.map((arg) => ({
        name: arg.name,
        type: arg.type,
        internalType: arg.internalType,
    })) || [];
    return {
        success: true,
        contractName: targetName,
        abi,
        bytecode,
        constructorArgs,
        gasEstimates: gasEstimates?.creation ? {
            codeDeposit: gasEstimates.creation.codeDepositCost,
            execution: gasEstimates.creation.executionCost,
            total: gasEstimates.creation.totalCost,
        } : null,
        warnings: warnings.map((w) => ({
            message: w.formattedMessage || w.message,
            severity: w.severity,
        })),
        availableContracts: Object.keys(contracts),
        pragma,
        solcVersion: solc.version?.() || 'unknown',
    };
}
//# sourceMappingURL=compiler.js.map