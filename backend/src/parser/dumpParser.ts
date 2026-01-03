/**
 * PostgreSQL Dump File Parser - V1
 * 
 * SINGLE RESPONSIBILITY: Extract CREATE TABLE blocks from dump files
 * 
 * Key Principles:
 * 1. Handle both text and binary dumps
 * 2. Extract readable CREATE TABLE statements
 * 3. Parse schema + table once
 * 4. Pass forward as facts
 * 
 * NO: Analysis, normalization, scoring, heuristics
 */

import { ExtractedTable, DumpParseResult, ColumnDef, ConstraintDef } from '../types/dumpParser';

export class DumpParser {
  /**
   * Parse a PostgreSQL dump file and extract CREATE TABLE statements
   * 
   * Strategy: Extract readable CREATE TABLE blocks from both text and binary dumps
   */
  static parseDumpFile(dumpContent: string): DumpParseResult {
    const result: DumpParseResult = {
      success: false,
      tables: [],
      errors: [],
      metadata: {
        totalSize: dumpContent.length,
        extractedSize: 0,
        detectedFormat: 'text'
      }
    };

    try {
      // Detect if this is a binary dump (starts with PGDMP)
      if (dumpContent.startsWith('PGDMP')) {
        result.metadata.detectedFormat = 'binary';
        return this.parseBinaryDump(dumpContent, result);
      } else {
        result.metadata.detectedFormat = 'text';
        return this.parseTextDump(dumpContent, result);
      }
    } catch (error) {
      result.errors.push(`Parser error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Parse binary PostgreSQL dump file
   * Extract readable CREATE TABLE statements embedded in binary data
   */
  private static parseBinaryDump(dumpContent: string, result: DumpParseResult): DumpParseResult {
    // Split by lines and look for CREATE TABLE patterns
    const lines = dumpContent.split('\n');
    let currentTable: ExtractedTable | null = null;
    let createStatement = '';
    let braceCount = 0;
    let inCreateStatement = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and comments
      if (!line || line.startsWith('--') || line.startsWith('/*')) {
        continue;
      }

      // Look for CREATE TABLE in binary dump (may have binary chars before)
      const createTableMatch = line.match(/.*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?\s*([a-zA-Z_][a-zA-Z0-9_]*)(?:.*?\.([a-zA-Z_][a-zA-Z0-9_]*))?\s*\(/i);
      if (createTableMatch) {
        if (currentTable) {
          // Previous table wasn't properly closed
          result.errors.push(`Unclosed CREATE TABLE at line ${i}`);
        }

        // Direct extraction from the CREATE TABLE match
        const hasSchema = createTableMatch[2] !== undefined;
        
        currentTable = {
          schema: hasSchema ? createTableMatch[1].toLowerCase() : 'public',
          tableName: hasSchema ? createTableMatch[2].toLowerCase() : createTableMatch[1].toLowerCase(),
          columns: [],
          constraints: [],
          source: 'dump',
          createStatement: ''
        };
        
        createStatement = line;
        braceCount = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
        inCreateStatement = true;
        
        continue;
      }

      // Continue collecting CREATE TABLE statement
      if (inCreateStatement && currentTable) {
        createStatement += '\n' + line;
        
        // Count braces to track statement end
        braceCount += (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
        
        // Statement ends when we find a semicolon and braces are balanced
        if (line.includes(';') && braceCount <= 0) {
          currentTable.createStatement = createStatement.trim();
        
          // RUNTIME ENFORCEMENT: Validate ExtractedTable contract
          if (!currentTable.schema || !currentTable.tableName) {
            throw new Error(`Invalid ExtractedTable: ${JSON.stringify(currentTable)}`);
          }
        
          result.tables.push(currentTable);
          
          currentTable = null;
          createStatement = '';
          braceCount = 0;
          inCreateStatement = false;
        }
      }
    }

    // Handle unclosed statement at end of file
    if (currentTable) {
      result.errors.push('Unclosed CREATE TABLE at end of file');
    }

    // Calculate extracted size
    result.metadata.extractedSize = result.tables.reduce((sum, table) => sum + table.createStatement.length, 0);

    // Success if we found at least one table or no errors
    result.success = result.tables.length > 0 || result.errors.length === 0;

    return result;
  }

  /**
   * Parse text PostgreSQL dump file
   * Standard line-by-line parsing for text dumps
   */
  private static parseTextDump(dumpContent: string, result: DumpParseResult): DumpParseResult {
    const lines = dumpContent.split('\n');
    let currentTable: ExtractedTable | null = null;
    let createStatement = '';
    let braceCount = 0;
    let inCreateStatement = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and comments
      if (!line || line.startsWith('--') || line.startsWith('/*')) {
        continue;
      }

      // Detect CREATE TABLE start
      if (line.startsWith('CREATE TABLE') || line.startsWith('CREATE TABLE IF NOT EXISTS')) {
        if (currentTable) {
          // Previous table wasn't properly closed
          result.errors.push(`Unclosed CREATE TABLE at line ${i}`);
        }

        // Use the same regex as binary dump parser
        const createTableMatch = line.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?\s*([a-zA-Z_][a-zA-Z0-9_]*)(?:.*?\.([a-zA-Z_][a-zA-Z0-9_]*))?\s*\(/i);
        if (createTableMatch) {
          const hasSchema = createTableMatch[2] !== undefined;
          
          currentTable = {
            schema: hasSchema ? createTableMatch[1].toLowerCase() : 'public',
            tableName: hasSchema ? createTableMatch[2].toLowerCase() : createTableMatch[1].toLowerCase(),
            columns: [],
            constraints: [],
            source: 'dump',
            createStatement: ''
          };
        } else {
          // Fallback for simple table names
          const tableMatch = line.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]+)\s*\(/);
          if (tableMatch) {
            currentTable = {
              schema: 'public',
              tableName: tableMatch[1].toLowerCase(),
              columns: [],
              constraints: [],
              source: 'dump',
              createStatement: ''
            };
          }
        }
        
        createStatement = line;
        braceCount = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
        inCreateStatement = true;
        
        continue;
      }

      // Continue collecting CREATE TABLE statement
      if (inCreateStatement && currentTable) {
        createStatement += '\n' + line;
        
        // Count braces to track statement end
        braceCount += (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
        
        // Statement ends when we find a semicolon and braces are balanced
        if (line.includes(';') && braceCount <= 0) {
          currentTable.createStatement = createStatement.trim();
        
          // RUNTIME ENFORCEMENT: Validate ExtractedTable contract
          if (!currentTable.schema || !currentTable.tableName) {
            throw new Error(`Invalid ExtractedTable: ${JSON.stringify(currentTable)}`);
          }
        
          result.tables.push(currentTable);
          
          currentTable = null;
          createStatement = '';
          braceCount = 0;
          inCreateStatement = false;
        }
      }
    }

    // Handle unclosed statement at end of file
    if (currentTable) {
      result.errors.push('Unclosed CREATE TABLE at end of file');
    }

    // Calculate extracted size
    result.metadata.extractedSize = result.tables.reduce((sum, table) => sum + table.createStatement.length, 0);

    // Success if we found at least one table or no errors
    result.success = result.tables.length > 0 || result.errors.length === 0;

    return result;
  }

  /**
   * Parse schema and table name from CREATE TABLE line
   * 
   * Handles:
   * - CREATE TABLE table_name
   * - CREATE TABLE schema.table_name
   * - CREATE TABLE "table_name"
   * - CREATE TABLE "schema"."table_name"
   * - CREATE TABLE IF NOT EXISTS variants
   * - Binary dump format with binary characters
   */
  private static parseTableInfo(line: string): { schema: string; table: string } | null {
    // Find CREATE TABLE pattern first (handle binary characters)
    const createTableMatch = line.match(/.*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?\s*(.+)/i);
    if (!createTableMatch) {
      return null;
    }
    
    const afterCreateTable = createTableMatch[1].trim();
    
    // Handle quoted names: "schema"."table" or "table"
    const quotedMatch = afterCreateTable.match(/^"?([^"]+)"?(?:\."?([^"]+)"?)?\s*\(/);
    if (quotedMatch) {
      const hasSchema = quotedMatch[2] !== undefined;
      
      return {
        schema: hasSchema ? quotedMatch[1].toLowerCase() : 'public',
        table: hasSchema ? quotedMatch[2].toLowerCase() : quotedMatch[1].toLowerCase()
      };
    }

    // Handle unquoted names: schema.table or table (more permissive for binary dumps)
    const unquotedMatch = afterCreateTable.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(?:.*?\.([a-zA-Z_][a-zA-Z0-9_]*))?\s*\(/);
    if (unquotedMatch) {
      const hasSchema = unquotedMatch[2] !== undefined;
      
      return {
        schema: hasSchema ? unquotedMatch[1].toLowerCase() : 'public',
        table: hasSchema ? unquotedMatch[2].toLowerCase() : unquotedMatch[1].toLowerCase()
      };
    }

    return null;
  }

  /**
   * Get basic dump file info (legacy compatibility)
   */
  static getDumpInfo(dumpContent: string): { format: string } {        
    // Detect binary vs text format
    return { format: dumpContent.startsWith('PGDMP') ? 'binary' : 'text' };
  }
}
