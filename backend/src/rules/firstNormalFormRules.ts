import { BaseNormalizationRule, RuleResult } from './normalizationRule';
import { DatabaseSchema, Violation, Column } from '../types/schema';

export class NoRepeatingGroupsRule extends BaseNormalizationRule {
  readonly normalForm = '1NF' as const;
  readonly name = 'No Repeating Groups';
  readonly description = 'Table must not contain repeating groups or arrays';
  readonly weight = 0.25; // 25% weight as per specification
  
  evaluate(schema: DatabaseSchema): RuleResult {
    const violations: Violation[] = [];
    let hasViolations = false;
    
    for (const [tableName, table] of Object.entries(schema.tables)) {
      for (const [columnName, column] of Object.entries(table.columns)) {
        if (this.isArrayType(column.type)) {
          violations.push(this.createViolation(
            tableName,
            columnName,
            `Column '${columnName}' has array type which violates 1NF`,
            'First Normal Form requires that each column contains atomic (indivisible) values. Array types store multiple values in a single column.',
            `Consider creating a separate table for '${columnName}' values with a foreign key reference to '${tableName}'`,
            'ERROR',
            1.0
          ));
          hasViolations = true;
        }
        
        if (this.isJsonType(column.type)) {
          violations.push(this.createViolation(
            tableName,
            columnName,
            `Column '${columnName}' has JSON type which may violate 1NF`,
            'First Normal Form requires atomic values. JSON types can contain structured data that may not be atomic.',
            `Consider normalizing the JSON structure into separate tables or ensure JSON contains only atomic values`,
            'WARNING',
            0.8
          ));
          hasViolations = true;
        }
      }
    }
    
    return {
      scoreContribution: hasViolations ? 0 : 1,
      violations,
      confidence: 1.0,
      explanation: hasViolations 
        ? 'Table contains non-atomic data types (arrays/JSON) that violate 1NF'
        : 'Table contains only atomic data types, satisfying 1NF'
    };
  }
  
  getExplanation() {
    return {
      whyThisFails: 'Arrays and JSON columns can store multiple values in a single field, violating the atomic value requirement of 1NF.',
      whatToFixFirst: 'Remove array types and normalize JSON columns into separate tables.',
      exampleFixSQL: `-- Instead of:
CREATE TABLE posts (tags TEXT[]);
-- Use:
CREATE TABLE posts (id SERIAL PRIMARY KEY, title TEXT);
CREATE TABLE post_tags (post_id INTEGER, tag TEXT, FOREIGN KEY (post_id) REFERENCES posts(id));`,
      impact: 'High (25%)'
    };
  }
  
  private isArrayType(type: string): boolean {
    return type.includes('[]') || type.toUpperCase().includes('ARRAY');
  }
  
  private isJsonType(type: string): boolean {
    return type.toUpperCase().includes('JSON') || type.toUpperCase().includes('JSONB');
  }
}

export class AtomicValuesRule extends BaseNormalizationRule {
  readonly normalForm = '1NF' as const;
  readonly name = 'Atomic Values';
  readonly description = 'All columns must contain atomic values';
  readonly weight = 0.1; // 10% weight as per specification (heuristic rule)
  
  evaluate(schema: DatabaseSchema): RuleResult {
    const violations: Violation[] = [];
    let hasViolations = false;
    
    for (const [tableName, table] of Object.entries(schema.tables)) {
      for (const [columnName, column] of Object.entries(table.columns)) {
        if (this.suggestsMultiValue(column.name, column.type)) {
          violations.push(this.createViolation(
            tableName,
            columnName,
            `Column '${columnName}' name suggests multi-value storage`,
            'First Normal Form requires each column to contain a single atomic value.',
            `Consider splitting '${columnName}' into separate columns or a related table`,
            'WARNING',
            0.7
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
        ? 'Column names suggest multi-value storage, potentially violating 1NF atomicity'
        : 'Column names appear to represent atomic values'
    };
  }
  
  getExplanation() {
    return {
      whyThisFails: 'Column names like "phones", "emails", or "tags" suggest multiple values are stored in one column.',
      whatToFixFirst: 'Rename columns to represent single values or create related tables.',
      exampleFixSQL: `-- Instead of:
CREATE TABLE users (phones TEXT[]);
-- Use:
CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);
CREATE TABLE user_phones (user_id INTEGER, phone TEXT, FOREIGN KEY (user_id) REFERENCES users(id));`,
      impact: 'Low (10%)'
    };
  }
  
  private suggestsMultiValue(columnName: string, dataType: string): boolean {
    const multiValuePatterns = [
      /list/i,
      /array/i,
      /items/i,
      /values/i,
      /data/i,
      /info/i,
      /details/i,
      /attributes/i
    ];
    
    return multiValuePatterns.some(pattern => pattern.test(columnName)) && 
           !dataType.toUpperCase().includes('TEXT');
  }
}

export class PrimaryKeyRule extends BaseNormalizationRule {
  readonly normalForm = '1NF' as const;
  readonly name = 'Primary Key Required';
  readonly description = 'Every table must have a primary key';
  readonly weight = 0.4; // 40% weight as per specification
  
  evaluate(schema: DatabaseSchema): RuleResult {
    const violations: Violation[] = [];
    let hasViolations = false;
    
    for (const [tableName, table] of Object.entries(schema.tables)) {
      if (table.primaryKeys.length === 0) {
        violations.push(this.createViolation(
          tableName,
          undefined,
          `Table '${tableName}' has no primary key`,
          'First Normal Form requires that each table has a unique identifier (primary key) to distinguish rows.',
          `Add a primary key to '${tableName}'. Consider adding an 'id' column with SERIAL or BIGINT type.`,
          'ERROR',
          1.0
        ));
        hasViolations = true;
      }
    }
    
    return {
      scoreContribution: hasViolations ? 0 : 1,
      violations,
      confidence: 1.0,
      explanation: hasViolations 
        ? 'One or more tables lack primary keys, violating 1NF uniqueness requirement'
        : 'All tables have primary keys, satisfying 1NF uniqueness requirement'
    };
  }
  
  getExplanation() {
    return {
      whyThisFails: 'Without a primary key, tables cannot uniquely identify rows, leading to potential duplicate data.',
      whatToFixFirst: 'Add a primary key column (typically "id SERIAL PRIMARY KEY") to each table.',
      exampleFixSQL: `-- Instead of:
CREATE TABLE users (name TEXT, email TEXT);
-- Use:
CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT, email TEXT);`,
      impact: 'Critical (40%)'
    };
  }
}
