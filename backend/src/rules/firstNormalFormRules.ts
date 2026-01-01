import { NormalizationRule } from './ruleEngine';
import { DatabaseSchema, Violation, Column } from '../types/schema';

export class NoRepeatingGroupsRule extends NormalizationRule {
  readonly normalForm = '1NF' as const;
  readonly name = 'No Repeating Groups';
  readonly description = 'Table must not contain repeating groups or arrays';
  readonly weight = 1.0;
  
  check(schema: DatabaseSchema): Violation[] {
    const violations: Violation[] = [];
    
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
        }
      }
    }
    
    return violations;
  }
  
  private isArrayType(type: string): boolean {
    return type.includes('[]') || type.toUpperCase().includes('ARRAY');
  }
  
  private isJsonType(type: string): boolean {
    return type.toUpperCase().includes('JSON') || type.toUpperCase().includes('JSONB');
  }
}

export class AtomicValuesRule extends NormalizationRule {
  readonly normalForm = '1NF' as const;
  readonly name = 'Atomic Values';
  readonly description = 'All columns must contain atomic values';
  readonly weight = 1.0;
  
  check(schema: DatabaseSchema): Violation[] {
    const violations: Violation[] = [];
    
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
        }
      }
    }
    
    return violations;
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

export class PrimaryKeyRule extends NormalizationRule {
  readonly normalForm = '1NF' as const;
  readonly name = 'Primary Key Required';
  readonly description = 'Every table must have a primary key';
  readonly weight = 1.0;
  
  check(schema: DatabaseSchema): Violation[] {
    const violations: Violation[] = [];
    
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
      }
    }
    
    return violations;
  }
}
