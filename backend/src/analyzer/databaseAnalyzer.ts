import { DatabaseSchema, AnalysisReport, Table } from '../types/schema';
import { DatabaseAnalysisResult, SchemaAnalysisResult, NormalizationViolation } from '../types/analysis';
import { ExtractedTable, DumpParseResult, AnalysisInput } from '../types/dumpParser';
import { SQLParser } from '../parser/sqlParser';
import { DumpParser } from '../parser/dumpParser';
import { ComplianceCalculator } from './complianceCalculator';
import { NoRepeatingGroupsRule, AtomicValuesRule, PrimaryKeyRule } from '../rules/firstNormalFormRules';
import { NoPartialDependencyRule, FullFunctionalDependencyRule } from '../rules/secondNormalFormRules';
import { NoTransitiveDependencyRule, BoyceCoddRule } from '../rules/thirdNormalFormRules';

export class DatabaseAnalyzer {
  private parser: SQLParser;
  private complianceCalculator: ComplianceCalculator;
  
  constructor() {
    this.parser = new SQLParser();
    this.complianceCalculator = new ComplianceCalculator();
    
    this.initializeRules();
  }

  /**
   * Analyze SQL content with multi-schema support
   */
  analyzeSQLWithSchemas(sqlContent: string): DatabaseAnalysisResult {
    try {
      // Check if this is a dump file
      const dumpInfo = DumpParser.getDumpInfo(sqlContent);
      
      let schema: DatabaseSchema;
      let dumpTables: string[] = [];
      
      if (dumpInfo.format !== 'text' && dumpInfo.format !== 'unknown') {
        // This is a dump file, extract schema first
        const dumpResult = DumpParser.parseDumpFile(sqlContent);
        
        if (!dumpResult.success) {
          throw new Error(`Failed to parse dump file: ${dumpResult.errors.join(', ')}`);
        }
        
        // Use new dump parser - extract tables directly
        return this.analyzeExtractedTables(dumpResult.tables);
      } else {
        // Regular SQL file
        schema = this.parser.parse(sqlContent);
        return this.analyzeSchemas(schema, []);
      }
      
    } catch (error) {
      throw new Error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze dump file with multi-schema support
   */
  analyzeDumpFileWithSchemas(dumpContent: string): DatabaseAnalysisResult & {
    dumpParseResult: DumpParseResult;
    analysisNotes: string[];
  } {
    const dumpResult = DumpParser.parseDumpFile(dumpContent);
    
    if (!dumpResult.success) {
      throw new Error(`Failed to parse dump file: ${dumpResult.errors.join(', ')}`);
    }
    
    // Create schema from extracted tables - NO RE-PARSING NEEDED
    const analysisResult = this.analyzeExtractedTables(dumpResult.tables);
    
    return {
      ...analysisResult,
      dumpParseResult: dumpResult,
      analysisNotes: [
        `Analyzed PostgreSQL dump file (${dumpResult.metadata.detectedFormat} format)`,
        `Extracted ${dumpResult.tables.length} tables from dump`,
        `Dump size: ${(dumpResult.metadata.totalSize / 1024).toFixed(2)}KB, Extracted: ${(dumpResult.metadata.extractedSize / 1024).toFixed(2)}KB`,
        ...(dumpResult.errors.length > 0 ? [`Warnings: ${dumpResult.errors.join(', ')}`] : [])
      ]
    };
  }

  /**
   * Core schema analysis logic
   */
  private analyzeSchemas(schema: DatabaseSchema, dumpTables: string[]): DatabaseAnalysisResult {
    // Step A: Group tables by schema
    const tablesBySchema = new Map<string, any[]>();
    
    // Extract schema information from table objects
    for (const [tableName, table] of Object.entries(schema.tables)) {
      let schemaName = table.schemaName || 'public';
      
      // Exclude system schemas
      if (this.isSystemSchema(schemaName)) {
        continue;
      }
      
      // CRITICAL FIX: Use the actual table name, not the key
      // The key should match table.name, but we use table.name to be safe
      const actualTableName = table.name;
      
      if (!tablesBySchema.has(schemaName)) {
        tablesBySchema.set(schemaName, []);
      }
      tablesBySchema.get(schemaName)!.push({ name: actualTableName, ...table });
    }
    
    // Step B: Analyze tables UNCHANGED (use existing rule engine)
    const schemaResults: SchemaAnalysisResult[] = [];
    let totalTables = 0;
    let totalScore = 0;
    
    for (const [schemaName, tables] of tablesBySchema.entries()) {
      const schemaResult = this.analyzeSchema(schemaName, tables);
      schemaResults.push(schemaResult);
      totalTables += tables.length;
      totalScore += schemaResult.overallScore;
    }
    
    // Step C: Calculate overall results
    const overallScore = schemaResults.length > 0 ? totalScore / schemaResults.length : 0;
    
    return {
      totalSchemas: schemaResults.length,
      totalTables,
      overallScore,
      schemas: schemaResults
    };
  }

  /**
   * Analyze a single schema
   */
  private analyzeSchema(schemaName: string, tables: any[]): SchemaAnalysisResult {
    const violations: NormalizationViolation[] = [];
    const tableScores: number[] = [];
    
    // Initialize normalization tracking
    const normalization = {
      "1NF": { score: 0, violatedTables: 0, totalTables: tables.length },
      "2NF": { score: 0, violatedTables: 0, totalTables: tables.length },
      "3NF": { score: 0, violatedTables: 0, totalTables: tables.length }
    };
    
    // Analyze each table using existing rule engine
    for (const table of tables) {
      // Use the original table name without schema prefix for analysis
      const tableName = table.name.includes('.') ? table.name.split('.')[1] : table.name;
      const tableSchema = { tables: { [tableName]: table } };
      const report = this.complianceCalculator.calculateCompliance(tableSchema);
      
      // Track table score
      tableScores.push(report.overallScore);
      
      // Collect violations and normalize table names
      ['1NF', '2NF', '3NF'].forEach(nf => {
        const nfScore = report.compliance[nf as keyof typeof report.compliance];
        if (nfScore.violations.length > 0) {
          normalization[nf as keyof typeof normalization].violatedTables++;
        }
        
        // Convert violations to NormalizationViolation format
        nfScore.violations.forEach(v => {
          violations.push({
            normalForm: nf as '1NF' | '2NF' | '3NF',
            table: table.name,
            column: v.column,
            severity: v.severity,
            message: v.message,
            explanation: v.explanation,
            suggestion: v.suggestion,
            confidence: v.confidence
          });
        });
      });
    }
    
    // Calculate schema scores
    normalization["1NF"].score = normalization["1NF"].violatedTables === 0 ? 100 : 
      (100 - (normalization["1NF"].violatedTables / normalization["1NF"].totalTables) * 100);
    normalization["2NF"].score = normalization["2NF"].violatedTables === 0 ? 100 : 
      (100 - (normalization["2NF"].violatedTables / normalization["2NF"].totalTables) * 100);
    normalization["3NF"].score = normalization["3NF"].violatedTables === 0 ? 100 : 
      (100 - (normalization["3NF"].violatedTables / normalization["3NF"].totalTables) * 100);
    
    // Calculate overall schema score
    const schemaScore = tableScores.length > 0 ? tableScores.reduce((a, b) => a + b, 0) / tableScores.length : 0;
    
    // Step D: Schema status assignment (UX ONLY)
    const status = this.getSchemaStatus(schemaScore, violations);
    
    return {
      schemaName,
      tableCount: tables.length,
      normalization,
      violations,
      overallScore: schemaScore,
      status
    };
  }

  /**
   * SINGLE ENTRY POINT - Analyze extracted tables
   * NO SQL PARSING - ONLY ANALYSIS
   */
  analyze(input: AnalysisInput): DatabaseAnalysisResult {
    return this.analyzeExtractedTables(input.tables);
  }

  /**
   * Analyze extracted tables directly from dump parser
   * NO RE-PARSING - use facts from dump parser
   */
  private analyzeExtractedTables(extractedTables: ExtractedTable[]): DatabaseAnalysisResult {
    // Group tables by schema using dump parser facts
    const tablesBySchema = new Map<string, ExtractedTable[]>();
    
    extractedTables.forEach(table => {
      // RUNTIME ENFORCEMENT: Validate ExtractedTable contract
      if (!table.schema || !table.tableName) {
        throw new Error(`Invalid ExtractedTable: ${JSON.stringify(table)}`);
      }
      
      if (!tablesBySchema.has(table.schema)) {
        tablesBySchema.set(table.schema, []);
      }
      tablesBySchema.get(table.schema)!.push(table);
    });
    
    // Analyze each schema
    const schemaResults: SchemaAnalysisResult[] = [];
    let totalTables = 0;
    let totalScore = 0;
    
    for (const [schemaName, tables] of tablesBySchema.entries()) {
      // Skip system schemas
      if (this.isSystemSchema(schemaName)) {
        continue;
      }
      
      const schemaResult = this.analyzeExtractedSchema(schemaName, tables);
      schemaResults.push(schemaResult);
      totalTables += tables.length;
      totalScore += schemaResult.overallScore;
    }
    
    // Calculate overall results
    const overallScore = schemaResults.length > 0 ? totalScore / schemaResults.length : 0;
    
    return {
      totalSchemas: schemaResults.length,
      totalTables,
      overallScore,
      schemas: schemaResults
    };
  }

  /**
   * Build canonical table directly from ExtractedTable facts (NO SQL PARSING)
   */
  private buildCanonicalTable(extracted: ExtractedTable): Table {
    return {
      name: extracted.tableName,
      schemaName: extracted.schema,
      columns: extracted.columns ? extracted.columns.reduce((acc, col) => {
        acc[col.name] = {
          name: col.name,
          type: col.type,
          nullable: col.nullable,
          primaryKey: col.primaryKey || false,
          unique: col.unique || false,
          foreignKey: col.foreignKey || undefined
        };
        return acc;
      }, {}) : {},
      primaryKeys: extracted.constraints.filter(c => c.type === 'primary_key').flatMap(c => c.columns),
      foreignKeys: extracted.constraints.filter(c => c.type === 'foreign_key').map(c => ({
        column: c.columns[0],
        referencesTable: c.references?.table || '',
        referencesColumn: c.references?.columns[0] || ''
      })),
      uniqueConstraints: extracted.constraints.filter(c => c.type === 'unique').map(c => c.columns)
    };
  }

  /**
   * Analyze a single schema from extracted tables
   */
  private analyzeExtractedSchema(schemaName: string, extractedTables: ExtractedTable[]): SchemaAnalysisResult {
    const violations: NormalizationViolation[] = [];
    const tableScores: number[] = [];
    
    // Initialize normalization tracking
    const normalization = {
      "1NF": { score: 0, violatedTables: 0, totalTables: extractedTables.length },
      "2NF": { score: 0, violatedTables: 0, totalTables: extractedTables.length },
      "3NF": { score: 0, violatedTables: 0, totalTables: extractedTables.length }
    };
    
    // Analyze each table using dump parser facts (NO RE-PARSING!)
    for (const extractedTable of extractedTables) {
      // Build canonical table directly from ExtractedTable facts
      const canonicalTable = this.buildCanonicalTable(extractedTable);
      
      // Create minimal schema for compliance calculator
      const tableSchema = { tables: { [extractedTable.tableName]: canonicalTable } };
      
      const report = this.complianceCalculator.calculateCompliance(tableSchema);
      
      // Track table score
      tableScores.push(report.overallScore);
      
      // Collect violations and normalize table names
      ['1NF', '2NF', '3NF'].forEach(nf => {
        const nfScore = report.compliance[nf as keyof typeof report.compliance];
        if (nfScore.violations.length > 0) {
          normalization[nf as keyof typeof normalization].violatedTables++;
        }
        
        // Convert violations to NormalizationViolation format
        nfScore.violations.forEach(v => {
          violations.push({
            normalForm: nf as '1NF' | '2NF' | '3NF',
            table: extractedTable.tableName,
            column: v.column,
            severity: v.severity,
            message: v.message,
            explanation: v.explanation,
            suggestion: v.suggestion,
            confidence: v.confidence
          });
        });
      });
    }
    
    // Calculate schema scores
    normalization["1NF"].score = normalization["1NF"].violatedTables === 0 ? 100 : 
      (100 - (normalization["1NF"].violatedTables / normalization["1NF"].totalTables) * 100);
    normalization["2NF"].score = normalization["2NF"].violatedTables === 0 ? 100 : 
      (100 - (normalization["2NF"].violatedTables / normalization["2NF"].totalTables) * 100);
    normalization["3NF"].score = normalization["3NF"].violatedTables === 0 ? 100 : 
      (100 - (normalization["3NF"].violatedTables / normalization["3NF"].totalTables) * 100);
    
    // Calculate overall schema score
    const schemaScore = tableScores.length > 0 ? tableScores.reduce((a, b) => a + b, 0) / tableScores.length : 0;
    
    // Schema status assignment (UX ONLY)
    const status = this.getSchemaStatus(schemaScore, violations);
    
    return {
      schemaName,
      tableCount: extractedTables.length,
      normalization,
      violations,
      overallScore: schemaScore,
      status
    };
  }

  /**
   * Schema status assignment (UX ONLY)
   */
  private getSchemaStatus(score: number, violations: NormalizationViolation[]): "PERFECT" | "GOOD" | "NEEDS_ATTENTION" | "CRITICAL" {
    if (violations.length === 0) return "PERFECT";
    if (score >= 90) return "GOOD";
    if (score >= 70) return "NEEDS_ATTENTION";
    return "CRITICAL";
  }

  /**
   * Check if schema is a system schema
   */
  private isSystemSchema(schemaName: string): boolean {
    const systemSchemas = ['pg_catalog', 'information_schema', 'pg_toast'];
    return systemSchemas.includes(schemaName);
  }
  analyzeSQL(sqlContent: string): AnalysisReport {
    try {
      // Check if this is a dump file
      const dumpInfo = DumpParser.getDumpInfo(sqlContent);
      
      let schema: DatabaseSchema;
      let analysisNotes: string[] = [];
      
      if (dumpInfo.format !== 'text' && dumpInfo.format !== 'unknown') {
        // This is a dump file, extract schema first
        const dumpResult = DumpParser.parseDumpFile(sqlContent);
        
        if (!dumpResult.success) {
          throw new Error(`Failed to parse dump file: ${dumpResult.errors.join(', ')}`);
        }
        
        // For legacy compatibility, combine all CREATE statements
        const combinedSQL = dumpResult.tables.map(table => table.createStatement).join('\n\n');
        schema = this.parser.parse(combinedSQL);
        analysisNotes.push(`Analyzed PostgreSQL dump file (${dumpInfo.format} format)`);
        analysisNotes.push(`Extracted ${dumpResult.tables.length} tables from dump`);
        analysisNotes.push(`Dump size: ${(dumpResult.metadata.totalSize / 1024).toFixed(2)}KB, Extracted: ${(dumpResult.metadata.extractedSize / 1024).toFixed(2)}KB`);
        
        if (dumpResult.errors.length > 0) {
          analysisNotes.push(`Warnings: ${dumpResult.errors.join(', ')}`);
        }
      } else {
        // Regular SQL file
        schema = this.parser.parse(sqlContent);
        analysisNotes.push('Analyzed regular SQL file');
      }
      
      const report = this.complianceCalculator.calculateCompliance(schema);
      
      // Add analysis notes to the report
      (report as any).analysisNotes = analysisNotes;
      (report as any).dumpInfo = dumpInfo;
      
      return report;
      
    } catch (error) {
      throw new Error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze dump file specifically
   */
  analyzeDumpFile(dumpContent: string): AnalysisReport & {
    dumpParseResult: DumpParseResult;
    analysisNotes: string[];
  } {
    const dumpResult = DumpParser.parseDumpFile(dumpContent);
    
    if (!dumpResult.success) {
      throw new Error(`Failed to parse dump file: ${dumpResult.errors.join(', ')}`);
    }
    
    // For legacy compatibility, combine all CREATE statements into one SQL string
    const combinedSQL = dumpResult.tables.map(table => table.createStatement).join('\n\n');
    const report = this.analyzeSQL(combinedSQL);
    
    return {
      ...report,
      dumpParseResult: dumpResult,
      analysisNotes: [
        `Analyzed PostgreSQL dump file (${dumpResult.metadata.detectedFormat} format)`,
        `Extracted ${dumpResult.tables.length} tables from dump`,
        `Dump size: ${(dumpResult.metadata.totalSize / 1024).toFixed(2)}KB, Extracted: ${(dumpResult.metadata.extractedSize / 1024).toFixed(2)}KB`,
        ...(dumpResult.errors.length > 0 ? [`Warnings: ${dumpResult.errors.join(', ')}`] : [])
      ]
    };
  }
  
  private initializeRules(): void {
    const firstNormalFormRules = [
      new NoRepeatingGroupsRule(),
      new AtomicValuesRule(),
      new PrimaryKeyRule()
    ];
    
    const secondNormalFormRules = [
      new NoPartialDependencyRule(),
      new FullFunctionalDependencyRule()
    ];
    
    const thirdNormalFormRules = [
      new NoTransitiveDependencyRule(),
      new BoyceCoddRule()
    ];
    
    // Add all rules to the compliance calculator
    firstNormalFormRules.forEach(rule => this.complianceCalculator.addRule(rule));
    secondNormalFormRules.forEach(rule => this.complianceCalculator.addRule(rule));
    thirdNormalFormRules.forEach(rule => this.complianceCalculator.addRule(rule));
  }
  
  getSupportedFeatures(): {
    dialects: string[];
    statements: string[];
    normalForms: string[];
  } {
    return {
      dialects: ['PostgreSQL'],
      statements: ['CREATE TABLE', 'Column definitions', 'PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE'],
      normalForms: ['1NF', '2NF', '3NF']
    };
  }
  
  validateSQL(sqlContent: string): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      const schema = this.parser.parse(sqlContent);
      
      if (Object.keys(schema.tables).length === 0) {
        warnings.push('No CREATE TABLE statements found in the SQL file');
      }
      
      for (const [tableName, table] of Object.entries(schema.tables)) {
        if (table.primaryKeys.length === 0) {
          warnings.push(`Table '${tableName}' has no primary key`);
        }
        
        if (Object.keys(table.columns).length === 0) {
          warnings.push(`Table '${tableName}' has no columns defined`);
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown parsing error');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}
