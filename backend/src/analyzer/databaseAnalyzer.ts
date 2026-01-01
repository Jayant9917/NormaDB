import { DatabaseSchema, AnalysisReport } from '../types/schema';
import { SQLParser } from '../parser/sqlParser';
import { RuleEngine } from '../rules/ruleEngine';
import { ComplianceCalculator } from './complianceCalculator';
import { NoRepeatingGroupsRule, AtomicValuesRule, PrimaryKeyRule } from '../rules/firstNormalFormRules';
import { NoPartialDependencyRule, FullFunctionalDependencyRule } from '../rules/secondNormalFormRules';
import { NoTransitiveDependencyRule, BoyceCoddRule } from '../rules/thirdNormalFormRules';

export class DatabaseAnalyzer {
  private parser: SQLParser;
  private ruleEngine: RuleEngine;
  private complianceCalculator: ComplianceCalculator;
  
  constructor() {
    this.parser = new SQLParser();
    this.ruleEngine = new RuleEngine();
    this.complianceCalculator = new ComplianceCalculator(this.ruleEngine);
    
    this.initializeRules();
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
    
    this.ruleEngine.addRules([
      ...firstNormalFormRules,
      ...secondNormalFormRules,
      ...thirdNormalFormRules
    ]);
  }
  
  analyzeSQL(sqlContent: string): AnalysisReport {
    try {
      const schema = this.parser.parse(sqlContent);
      return this.complianceCalculator.calculateCompliance(schema);
    } catch (error) {
      throw new Error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
