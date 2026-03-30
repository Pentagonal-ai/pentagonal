import { NextRequest, NextResponse } from 'next/server';
import solc from 'solc';

interface CompileRequest {
  sourceCode: string;
  contractName?: string;
}

interface SolcOutput {
  contracts?: {
    [fileName: string]: {
      [contractName: string]: {
        abi: unknown[];
        evm: {
          bytecode: { object: string };
          gasEstimates?: {
            creation?: { codeDepositCost?: string; executionCost?: string; totalCost?: string };
          };
        };
      };
    };
  };
  errors?: Array<{
    type: string;
    component: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    formattedMessage?: string;
    sourceLocation?: {
      file: string;
      start: number;
      end: number;
    };
  }>;
}

// OpenZeppelin import resolver — provides common OZ contracts
function findImport(path: string): { contents: string } | { error: string } {
  // For now, return an error for imports — users should use flattened contracts
  // Future: fetch from npm/GitHub or bundle common OZ contracts
  if (path.startsWith('@openzeppelin/')) {
    return {
      error: `OpenZeppelin imports are not yet supported in browser compilation. Please use flattened contract code (combine all imports into one file). Pentagonal's AI generator produces self-contained code by default.`,
    };
  }
  return { error: `Import not found: ${path}` };
}

export async function POST(request: NextRequest) {
  try {
    const body: CompileRequest = await request.json();
    const { sourceCode, contractName } = body;

    if (!sourceCode || !sourceCode.trim()) {
      return NextResponse.json(
        { error: 'No source code provided' },
        { status: 400 }
      );
    }

    // Detect Solidity version from pragma
    const pragmaMatch = sourceCode.match(/pragma\s+solidity\s+[^;]+;/);
    const pragma = pragmaMatch ? pragmaMatch[0] : 'pragma solidity ^0.8.20;';

    // Build Standard JSON Input
    const input = {
      language: 'Solidity',
      sources: {
        'Contract.sol': {
          content: sourceCode,
        },
      },
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
        outputSelection: {
          '*': {
            '*': ['abi', 'evm.bytecode', 'evm.gasEstimates'],
          },
        },
        evmVersion: 'paris',
      },
    };

    // Compile
    const output: SolcOutput = JSON.parse(
      solc.compile(JSON.stringify(input), { import: findImport })
    );

    // Collect errors and warnings
    const errors = (output.errors || []).filter(e => e.severity === 'error');
    const warnings = (output.errors || []).filter(e => e.severity === 'warning');

    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        errors: errors.map(e => ({
          message: e.formattedMessage || e.message,
          severity: e.severity,
          location: e.sourceLocation,
        })),
        warnings: warnings.map(w => ({
          message: w.formattedMessage || w.message,
          severity: w.severity,
        })),
        pragma,
      });
    }

    // Find the target contract
    const contracts = output.contracts?.['Contract.sol'];
    if (!contracts || Object.keys(contracts).length === 0) {
      return NextResponse.json(
        { error: 'Compilation produced no contracts', success: false },
        { status: 400 }
      );
    }

    // Use specified contract name or pick the first one
    const targetName = contractName || Object.keys(contracts)[0];
    const compiledContract = contracts[targetName];

    if (!compiledContract) {
      return NextResponse.json({
        error: `Contract "${targetName}" not found. Available: ${Object.keys(contracts).join(', ')}`,
        success: false,
        availableContracts: Object.keys(contracts),
      });
    }

    const abi = compiledContract.abi;
    const bytecode = '0x' + compiledContract.evm.bytecode.object;
    const gasEstimates = compiledContract.evm.gasEstimates;

    // Extract constructor from ABI
    const constructorAbi = abi.find(
      (item: unknown) => (item as { type: string }).type === 'constructor'
    ) as { inputs?: Array<{ name: string; type: string; internalType?: string }> } | undefined;

    const constructorArgs = constructorAbi?.inputs || [];

    return NextResponse.json({
      success: true,
      contractName: targetName,
      abi,
      bytecode,
      abiSize: JSON.stringify(abi).length,
      bytecodeSize: bytecode.length,
      constructorArgs: constructorArgs.map(arg => ({
        name: arg.name,
        type: arg.type,
        internalType: arg.internalType,
      })),
      gasEstimates: gasEstimates?.creation ? {
        codeDeposit: gasEstimates.creation.codeDepositCost,
        execution: gasEstimates.creation.executionCost,
        total: gasEstimates.creation.totalCost,
      } : null,
      warnings: warnings.map(w => ({
        message: w.formattedMessage || w.message,
        severity: w.severity,
      })),
      availableContracts: Object.keys(contracts),
      pragma,
      solcVersion: (solc as unknown as { version: () => string }).version?.() || 'unknown',
    });
  } catch (err) {
    console.error('Compilation error:', err);
    return NextResponse.json(
      { error: 'Internal compilation error', details: String(err), success: false },
      { status: 500 }
    );
  }
}
