#!/usr/bin/env node

import { Command } from 'commander';
import { readFile, readdir } from 'fs/promises';
import { DatabaseAnalyzer } from '../analyzer/databaseAnalyzer';
import { resolve } from 'path';

const program = new Command();
const analyzer = new DatabaseAnalyzer();

program
  .name('normadb')
  .description('Database Normalization Analyzer CLI')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze SQL schema file(s)')
  .argument('<file>', 'SQL file or directory to analyze')
  .option('-j, --json', 'Output as JSON')
  .option('-v, --verbose', 'Verbose output with explanations')
  .option('-d, --debug', 'Show debug scoring information')
  .action(async (file, options) => {
    try {
      const filePath = resolve(file);
      const isDirectory = await isDirectoryPath(filePath);
      
      if (isDirectory) {
        await analyzeDirectory(filePath, options);
      } else {
        await analyzeFile(filePath, options);
      }
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

async function isDirectoryPath(path: string): Promise<boolean> {
  try {
    const stats = await import('fs').then(fs => fs.promises.stat(path));
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function analyzeDirectory(dirPath: string, options: any) {
  console.log(`🔍 Analyzing directory: ${dirPath}`);
  
  try {
    const files = await readdir(dirPath);
    const sqlFiles = files.filter(file => file.endsWith('.sql'));
    
    if (sqlFiles.length === 0) {
      console.log('⚠️  No SQL files found in directory');
      return;
    }
    
    console.log(`📁 Found ${sqlFiles.length} SQL file(s)\n`);
    
    for (const file of sqlFiles) {
      const filePath = resolve(dirPath, file);
      console.log(`📄 Analyzing: ${file}`);
      await analyzeFile(filePath, options);
      console.log(''); // Add spacing between files
    }
  } catch (error) {
    throw new Error(`Failed to read directory: ${error}`);
  }
}

async function analyzeFile(filePath: string, options: any) {
  try {
    const sqlContent = await readFile(filePath, 'utf-8');
    
    // Validate SQL first
    const validation = analyzer.validateSQL(sqlContent);
    
    if (!validation.isValid) {
      console.error('❌ Invalid SQL:');
      validation.errors.forEach(error => console.error(`   - ${error}`));
      return;
    }
    
    // Analyze schema
    const report = analyzer.analyzeSQL(sqlContent);
    
    if (options.debug) {
      outputDebugInfo(report);
    } else if (options.json) {
      outputJson(report);
    } else if (options.verbose) {
      outputVerbose(report);
    } else {
      outputSummary(report);
    }
    
  } catch (error) {
    throw new Error(`Failed to analyze file: ${error}`);
  }
}

function outputSummary(report: any) {
  console.log(`📊 Overall Compliance: ${report.overallScore.toFixed(2)}%`);
  
  // Status indicators
  const getStatus = (score: number) => {
    if (score >= 90) return '✅ PASS';
    if (score >= 70) return '⚠️  WARNING';
    return '❌ FAIL';
  };
  
  console.log(`\n🔹 1NF: ${report.compliance['1NF'].score.toFixed(2)}% ${getStatus(report.compliance['1NF'].score)}`);
  console.log(`🔹 2NF: ${report.compliance['2NF'].score.toFixed(2)}% ${getStatus(report.compliance['2NF'].score)}`);
  console.log(`🔹 3NF: ${report.compliance['3NF'].score.toFixed(2)}% ${getStatus(report.compliance['3NF'].score)}`);
  
  if (report.summary.totalViolations > 0) {
    console.log(`\n⚠️  ${report.summary.totalViolations} violation(s) found`);
    console.log(`   Critical: ${report.summary.criticalViolations}`);
    console.log(`   Warnings: ${report.summary.warnings}`);
  } else {
    console.log('\n✅ No violations detected');
  }
}

function outputVerbose(report: any) {
  outputSummary(report);
  
  console.log('\n📋 Detailed Analysis:');
  
  // 1NF Details
  console.log('\n1NF Analysis:');
  if (report.compliance['1NF'].violations.length > 0) {
    report.compliance['1NF'].violations.forEach((v: any, i: number) => {
      console.log(`  ${i + 1}. [${v.severity}] ${v.message}`);
      console.log(`     Table: ${v.table}${v.column ? `, Column: ${v.column}` : ''}`);
      console.log(`     Confidence: ${v.confidence}`);
    });
  } else {
    console.log('  ✅ No 1NF violations');
  }
  
  // 2NF Details
  console.log('\n2NF Analysis:');
  if (report.compliance['2NF'].violations.length > 0) {
    report.compliance['2NF'].violations.forEach((v: any, i: number) => {
      console.log(`  ${i + 1}. [${v.severity}] ${v.message}`);
      console.log(`     Table: ${v.table}${v.column ? `, Column: ${v.column}` : ''}`);
      console.log(`     Confidence: ${v.confidence}`);
    });
  } else {
    console.log('  ✅ No 2NF violations');
  }
  
  // 3NF Details
  console.log('\n3NF Analysis:');
  if (report.compliance['3NF'].violations.length > 0) {
    report.compliance['3NF'].violations.forEach((v: any, i: number) => {
      console.log(`  ${i + 1}. [${v.severity}] ${v.message}`);
      console.log(`     Table: ${v.table}${v.column ? `, Column: ${v.column}` : ''}`);
      console.log(`     Confidence: ${v.confidence}`);
    });
  } else {
    console.log('  ✅ No 3NF violations');
  }
}

function outputJson(report: any) {
  console.log(JSON.stringify(report, null, 2));
}

function outputDebugInfo(report: any) {
  console.log('🔬 Debug Scoring Information:');
  
  console.log('\n1NF Scoring:');
  console.log(`  Max Weight: ${report.compliance['1NF'].maxWeight}`);
  console.log(`  Violated Weight: ${report.compliance['1NF'].violatedWeight}`);
  console.log(`  Rules Evaluated: ${report.compliance['1NF'].rulesEvaluated}`);
  console.log(`  Score: ${report.compliance['1NF'].score}%`);
  console.log(`  Calculation: ((${report.compliance['1NF'].maxWeight} - ${report.compliance['1NF'].violatedWeight}) / ${report.compliance['1NF'].maxWeight}) * 100`);
  
  console.log('\n2NF Scoring:');
  console.log(`  Max Weight: ${report.compliance['2NF'].maxWeight}`);
  console.log(`  Violated Weight: ${report.compliance['2NF'].violatedWeight}`);
  console.log(`  Rules Evaluated: ${report.compliance['2NF'].rulesEvaluated}`);
  console.log(`  Score: ${report.compliance['2NF'].score}%`);
  
  console.log('\n3NF Scoring:');
  console.log(`  Max Weight: ${report.compliance['3NF'].maxWeight}`);
  console.log(`  Violated Weight: ${report.compliance['3NF'].violatedWeight}`);
  console.log(`  Rules Evaluated: ${report.compliance['3NF'].rulesEvaluated}`);
  console.log(`  Score: ${report.compliance['3NF'].score}%`);
  
  console.log('\nOverall Calculation:');
  console.log(`  Formula: (1NF * 0.5) + (2NF * 0.3) + (3NF * 0.2)`);
  console.log(`  Result: (${report.compliance['1NF'].score} * 0.5) + (${report.compliance['2NF'].score} * 0.3) + (${report.compliance['3NF'].score} * 0.2) = ${report.overallScore}%`);
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
  process.exit(1);
});

// Run CLI
program.parse(process.argv);
