import { BaseNormalizationRule, RuleResult } from './normalizationRule';
import { DatabaseSchema, Violation } from '../types/schema';

export class NoPartialDependencyRule extends BaseNormalizationRule {
  readonly normalForm = '2NF' as const;
  readonly name = 'No Partial Dependencies';
  readonly description = 'Non-key attributes must depend on the entire primary key';
  readonly weight = 0.6;
  
  evaluate(schema: DatabaseSchema): RuleResult {
    const violations: Violation[] = [];
    let hasViolations = false;
    
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
          hasViolations = true;
        }
      }
    }
    
    return {
      scoreContribution: hasViolations ? 0 : 1,
      violations,
      confidence: 0.7, // This is a heuristic rule
      explanation: hasViolations 
        ? 'Tables with composite primary keys may have partial dependencies'
        : 'No partial dependencies detected'
    };
  }
  
  getExplanation() {
    return {
      whyThisFails: 'In tables with composite primary keys, some columns may depend on only part of the key rather than the entire key.',
      whatToFixFirst: 'Move partially dependent columns to separate tables with the relevant part of the composite key.',
      exampleFixSQL: `-- Instead of:
CREATE TABLE enrollment (student_id INTEGER, course_id INTEGER, grade TEXT, PRIMARY KEY (student_id, course_id));
-- Use:
CREATE TABLE enrollment (student_id INTEGER, course_id INTEGER, PRIMARY KEY (student_id, course_id));
CREATE TABLE student_grades (student_id INTEGER, grade TEXT, PRIMARY KEY (student_id));`,
      impact: 'High (60%)'
    };
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

export class FullFunctionalDependencyRule extends BaseNormalizationRule {
  readonly normalForm = '2NF' as const;
  readonly name = 'Full Functional Dependency';
  readonly description = 'All attributes must fully depend on the primary key';
  readonly weight = 0.4;
  
  evaluate(schema: DatabaseSchema): RuleResult {
    const violations: Violation[] = [];
    let hasViolations = false;
    
    for (const [tableName, table] of Object.entries(schema.tables)) {
      if (table.primaryKeys.length === 0) {
        continue;
      }
      
      const nonKeyColumns = this.getNonKeyColumns(schema, tableName);
      
      for (const column of nonKeyColumns) {
        const confidence = this.assessFunctionalDependencyConfidence(column, table);
        
        if (confidence > 0.5) {
          violations.push(this.createViolation(
            tableName,
            column.name,
            `Column '${column.name}' may not have full functional dependency on primary key`,
            'Second Normal Form requires that all non-key attributes have full functional dependency on the primary key.',
            `Consider reviewing the relationship between '${column.name}' and the primary key`,
            'WARNING',
            confidence
          ));
          hasViolations = true;
        }
      }
    }
    
    return {
      scoreContribution: hasViolations ? 0 : 1,
      violations,
      confidence: 0.6, // This is a heuristic rule
      explanation: hasViolations 
        ? 'Some columns may not have full functional dependency on primary key'
        : 'All columns appear to have full functional dependency'
    };
  }
  
  getExplanation() {
    return {
      whyThisFails: 'Some non-key attributes may not be fully determined by the primary key.',
      whatToFixFirst: 'Review the functional dependencies and ensure all non-key attributes depend fully on the primary key.',
      exampleFixSQL: `-- Review table structure to ensure proper functional dependencies
CREATE TABLE orders (id SERIAL PRIMARY KEY, customer_id INTEGER, order_date TIMESTAMP, total DECIMAL);
-- Ensure total is fully dependent on the order id, not just customer_id`,
      impact: 'Medium (40%)'
    };
  }
  
  private assessFunctionalDependencyConfidence(column: any, table: any): number {
    const columnName = column.name.toLowerCase();
    
    // Look for derived/computed column patterns
    const derivedPatterns = [
      /_total$/i,
      /_sum$/i,
      /_count$/i,
      /_avg$/i,
      /average_/i,
      /calc_/i,
      /computed_/i,
      /count_/i
    ];
    
    return derivedPatterns.some(pattern => pattern.test(columnName)) ? 0.7 : 0.3;
  }
}
