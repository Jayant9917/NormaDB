import { DatabaseSchema, Table, Column } from '../types/schema';

export class SQLParser {
  parse(sqlContent: string): DatabaseSchema {
    const schema: DatabaseSchema = { tables: {} };
    
    try {
      const statements = this.splitStatements(sqlContent);
      
      for (const statement of statements) {
        const trimmedStatement = statement.trim();
        if (!trimmedStatement || !trimmedStatement.toUpperCase().startsWith('CREATE TABLE')) {
          continue;
        }
        
        const table = this.parseCreateTable(trimmedStatement);
        if (table) {
          schema.tables[table.name] = table;
        }
      }
    } catch (error) {
      throw new Error(`SQL parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return schema;
  }
  
  private splitStatements(sql: string): string[] {
    const statements: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let parenLevel = 0;
    
    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];
      
      if (!inQuotes && (char === "'" || char === '"')) {
        inQuotes = true;
        quoteChar = char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      } else if (!inQuotes) {
        if (char === '(') parenLevel++;
        else if (char === ')') parenLevel--;
        else if (char === ';' && parenLevel === 0) {
          statements.push(current.trim());
          current = '';
          continue;
        }
      }
      
      current += char;
    }
    
    if (current.trim()) {
      statements.push(current.trim());
    }
    
    return statements;
  }
  
  private parseCreateTable(statement: string): Table | null {
    const tableNameMatch = statement.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["`']?(\w+)["`']?)/i);
    if (!tableNameMatch) return null;
    
    const tableName = tableNameMatch[1];
    const columnsMatch = statement.match(/\((.*)\)/s);
    if (!columnsMatch) return null;
    
    const columnsContent = columnsMatch[1];
    const lines = this.splitColumnDefinitions(columnsContent);
    
    const table: Table = {
      name: tableName,
      columns: {},
      primaryKeys: [],
      foreignKeys: [],
      uniqueConstraints: []
    };
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      if (trimmedLine.toUpperCase().startsWith('PRIMARY KEY')) {
        this.parsePrimaryKey(trimmedLine, table);
      } else if (trimmedLine.toUpperCase().startsWith('FOREIGN KEY')) {
        this.parseForeignKey(trimmedLine, table);
      } else if (trimmedLine.toUpperCase().startsWith('UNIQUE')) {
        this.parseUnique(trimmedLine, table);
      } else if (trimmedLine.toUpperCase().startsWith('CONSTRAINT')) {
        this.parseConstraint(trimmedLine, table);
      } else {
        const column = this.parseColumn(trimmedLine);
        if (column) {
          table.columns[column.name] = column;
          if (column.primaryKey) {
            table.primaryKeys.push(column.name);
          }
        }
      }
    }
    
    return table;
  }
  
  private splitColumnDefinitions(content: string): string[] {
    const lines: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let parenLevel = 0;
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      
      if (!inQuotes && (char === "'" || char === '"')) {
        inQuotes = true;
        quoteChar = char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      } else if (!inQuotes) {
        if (char === '(') parenLevel++;
        else if (char === ')') parenLevel--;
        else if (char === ',' && parenLevel === 0) {
          lines.push(current.trim());
          current = '';
          continue;
        }
      }
      
      current += char;
    }
    
    if (current.trim()) {
      lines.push(current.trim());
    }
    
    return lines;
  }
  
  private parseColumn(line: string): Column | null {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) return null;
    
    const columnName = parts[0].replace(/["`']/g, '');
    const dataType = parts[1].toUpperCase();
    
    const column: Column = {
      name: columnName,
      type: dataType,
      nullable: true,
      primaryKey: false,
      unique: false
    };
    
    const remainingParts = parts.slice(2).join(' ');
    
    column.nullable = !remainingParts.toUpperCase().includes('NOT NULL');
    column.primaryKey = remainingParts.toUpperCase().includes('PRIMARY KEY');
    column.unique = remainingParts.toUpperCase().includes('UNIQUE');
    
    return column;
  }
  
  private parsePrimaryKey(line: string, table: Table): void {
    const match = line.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
    if (match) {
      const columns = match[1].split(',').map(col => col.trim().replace(/["`']/g, ''));
      table.primaryKeys.push(...columns);
    }
  }
  
  private parseForeignKey(line: string, table: Table): void {
    const match = line.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+["`']?(\w+)["`']?\s*\(([^)]+)\)/i);
    if (match) {
      const column = match[1].trim().replace(/["`']/g, '');
      const referencesTable = match[2];
      const referencesColumn = match[3].trim().replace(/["`']/g, '');
      
      table.foreignKeys.push({
        column,
        referencesTable,
        referencesColumn
      });
      
      if (table.columns[column]) {
        table.columns[column].foreignKey = {
          table: referencesTable,
          column: referencesColumn
        };
      }
    }
  }
  
  private parseUnique(line: string, table: Table): void {
    const match = line.match(/UNIQUE\s*\(([^)]+)\)/i);
    if (match) {
      const columns = match[1].split(',').map(col => col.trim().replace(/["`']/g, ''));
      table.uniqueConstraints.push(columns);
    }
  }
  
  private parseConstraint(line: string, table: Table): void {
    const upperLine = line.toUpperCase();
    
    if (upperLine.includes('PRIMARY KEY')) {
      this.parsePrimaryKey(line, table);
    } else if (upperLine.includes('FOREIGN KEY')) {
      this.parseForeignKey(line, table);
    } else if (upperLine.includes('UNIQUE')) {
      this.parseUnique(line, table);
    }
  }
}
