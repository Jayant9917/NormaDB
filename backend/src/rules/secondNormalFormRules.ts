import { NormalizationRule } from './ruleEngine';
import { DatabaseSchema, Violation } from '../types/schema';

export class NoPartialDependencyRule extends NormalizationRule {
  readonly normalForm = '2NF' as const;
  readonly name = 'No Partial Dependencies';
  readonly description = 'Non-key attributes must depend on the entire primary key';
  readonly weight = 1.0;
  
  check(schema: DatabaseSchema): Violation[] {
    const violations: Violation[] = [];
    
    for (const [tableName, table] of Object.entries(schema.tables)) {
      if (table.primaryKeys.length <= 1) {
        continue;
      }
      
      const nonKeyColumns = this.getNonKeyColumns(schema, tableName);
      
      for (const column of nonKeyColumns) {
        const confidence = this.assessPartialDependencyConfidence(column, table);
        
        if (confidence > 0.6) {
          violations.push(this.createViolation(
            tableName,
            column.name,
            `Column '${column.name}' may have partial dependency on composite primary key`,
            'Second Normal Form requires that non-key attributes depend on the entire primary key, not just part of it.',
            `Consider moving '${column.name}' to a separate table with the relevant part of the composite key`,
            'WARNING',
            confidence
          ));
        }
      }
    }
    
    return violations;
  }
  
  private assessPartialDependencyConfidence(column: any, table: any): number {
    let confidence = 0.0;
    
    const columnName = column.name.toLowerCase();
    const primaryKeyParts = table.primaryKeys.map((pk: string) => pk.toLowerCase());
    
    const partialIndicators = [
      { pattern: /_id$/, matches: (pk: string) => columnName.includes(pk.replace('_id', '')), weight: 0.8 },
      { pattern: /_code$/, matches: (pk: string) => columnName.includes(pk.replace('_code', '')), weight: 0.8 },
      { pattern: /_type$/, matches: (pk: string) => columnName.includes(pk.replace('_type', '')), weight: 0.7 },
      { pattern: /_name$/, matches: (pk: string) => columnName.includes(pk.replace('_name', '')), weight: 0.6 }
    ];
    
    for (const indicator of partialIndicators) {
      for (const pk of primaryKeyParts) {
        if (indicator.matches(pk)) {
          confidence = Math.max(confidence, indicator.weight);
        }
      }
    }
    
    if (columnName.includes('description') && primaryKeyParts.some((pk: string) => pk.includes('id'))) {
      confidence = Math.max(confidence, 0.5);
    }
    
    return confidence;
  }
}

export class FullFunctionalDependencyRule extends NormalizationRule {
  readonly normalForm = '2NF' as const;
  readonly name = 'Full Functional Dependency';
  readonly description = 'All non-key attributes must fully depend on the primary key';
  readonly weight = 0.8;
  
  check(schema: DatabaseSchema): Violation[] {
    const violations: Violation[] = [];
    
    for (const [tableName, table] of Object.entries(schema.tables)) {
      if (table.primaryKeys.length === 0) {
        continue;
      }
      
      const nonKeyColumns = this.getNonKeyColumns(schema, tableName);
      
      for (const column of nonKeyColumns) {
        if (this.appearsToBeDerivedAttribute(column.name, table)) {
          violations.push(this.createViolation(
            tableName,
            column.name,
            `Column '${column.name}' appears to be a derived attribute`,
            'Second Normal Form requires that all attributes be fully dependent on the primary key.',
            `Consider removing derived attributes or moving them to a view`,
            'WARNING',
            0.6
          ));
        }
      }
    }
    
    return violations;
  }
  
  private appearsToBeDerivedAttribute(columnName: string, table: any): boolean {
    const derivedPatterns = [
      /total_/i,
      /sum_/i,
      /count_/i,
      /avg_/i,
      /average_/i,
      /calc_/i,
      /computed_/i,
      /_total$/i,
      /_sum$/i,
      /_count$/i
    ];
    
    return derivedPatterns.some(pattern => pattern.test(columnName));
  }
}
