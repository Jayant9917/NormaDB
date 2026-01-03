import { DatabaseSchema, Table, Column, Violation } from '../types/schema';

export interface RuleResult {
  scoreContribution: number; // 0 to 1, where 1 = full compliance
  violations: Violation[];
  confidence: number; // 0 to 1, where 1 = certain
  explanation: string; // Human-readable explanation of the result
}

export interface NormalizationRule {
  // Rule metadata
  readonly normalForm: '1NF' | '2NF' | '3NF';
  readonly name: string;
  readonly description: string;
  readonly weight: number; // Relative weight in scoring (0 to 1)
  
  // Rule evaluation
  evaluate(schema: DatabaseSchema): RuleResult;
  
  // Rule explanation (for UI)
  getExplanation(): {
    whyThisFails: string;
    whatToFixFirst: string;
    exampleFixSQL: string;
    impact: string;
  };
}

export abstract class BaseNormalizationRule implements NormalizationRule {
  abstract readonly normalForm: '1NF' | '2NF' | '3NF';
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly weight: number;
  
  abstract evaluate(schema: DatabaseSchema): RuleResult;
  abstract getExplanation(): {
    whyThisFails: string;
    whatToFixFirst: string;
    exampleFixSQL: string;
    impact: string;
  };
  
  protected createViolation(
    table: string,
    column: string | undefined,
    message: string,
    explanation: string,
    suggestion: string,
    severity: 'ERROR' | 'WARNING' = 'ERROR',
    confidence: number = 1.0
  ): Violation {
    return {
      normalForm: this.normalForm,
      table,
      column,
      severity,
      message,
      explanation,
      suggestion,
      confidence
    };
  }
  
  protected getTable(schema: DatabaseSchema, tableName: string): Table | undefined {
    return schema.tables[tableName];
  }
  
  protected getColumn(schema: DatabaseSchema, tableName: string, columnName: string): Column | undefined {
    const table = this.getTable(schema, tableName);
    return table?.columns[columnName];
  }
  
  protected isPrimaryKey(schema: DatabaseSchema, tableName: string, columnName: string): boolean {
    const table = this.getTable(schema, tableName);
    return table?.primaryKeys.includes(columnName) || false;
  }
  
  protected isForeignKey(schema: DatabaseSchema, tableName: string, columnName: string): boolean {
    const column = this.getColumn(schema, tableName, columnName);
    return !!column?.foreignKey;
  }
  
  protected getNonKeyColumns(schema: DatabaseSchema, tableName: string): Column[] {
    const table = this.getTable(schema, tableName);
    if (!table) return [];
    
    return Object.values(table.columns).filter(col => 
      !table.primaryKeys.includes(col.name)
    );
  }
  
  protected hasCompositePrimaryKey(schema: DatabaseSchema, tableName: string): boolean {
    const table = this.getTable(schema, tableName);
    return (table?.primaryKeys.length || 0) > 1;
  }
}
