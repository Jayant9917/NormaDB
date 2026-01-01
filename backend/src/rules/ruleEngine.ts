import { DatabaseSchema, Violation, Table, Column } from '../types/schema';

export abstract class NormalizationRule {
  abstract readonly normalForm: '1NF' | '2NF' | '3NF';
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly weight: number;
  
  abstract check(schema: DatabaseSchema): Violation[];
  
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

export class RuleEngine {
  private rules: NormalizationRule[] = [];
  
  addRule(rule: NormalizationRule): void {
    this.rules.push(rule);
  }
  
  addRules(rules: NormalizationRule[]): void {
    this.rules.push(...rules);
  }
  
  analyzeSchema(schema: DatabaseSchema): {
    '1NF': Violation[];
    '2NF': Violation[];
    '3NF': Violation[];
  } {
    const result = {
      '1NF': [] as Violation[],
      '2NF': [] as Violation[],
      '3NF': [] as Violation[]
    };
    
    for (const rule of this.rules) {
      try {
        const violations = rule.check(schema);
        result[rule.normalForm].push(...violations);
      } catch (error) {
        console.error(`Error in rule ${rule.name}:`, error);
      }
    }
    
    return result;
  }
  
  getRulesByNormalForm(normalForm: '1NF' | '2NF' | '3NF'): NormalizationRule[] {
    return this.rules.filter(rule => rule.normalForm === normalForm);
  }
  
  getTotalRules(normalForm: '1NF' | '2NF' | '3NF'): number {
    return this.getRulesByNormalForm(normalForm).length;
  }
}
