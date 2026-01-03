/**
 * Single Responsibility: Dump File Table Extraction
 * 
 * The dump parser's ONLY job is to extract CREATE TABLE blocks from dump files.
 * No analysis, no normalization, no scoring.
 */

export interface ColumnDef {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  foreignKey?: {
    column: string;
    referencesTable: string;
    referencesColumn: string;
  };
}

export interface ConstraintDef {
  type: 'primary_key' | 'foreign_key' | 'unique';
  columns: string[];
  references?: {
    table: string;
    columns: string[];
  };
}

export interface ExtractedTable {
  schema: string;        // REQUIRED - no fallbacks
  tableName: string;     // REQUIRED - no fallbacks  
  columns: ColumnDef[];
  constraints: ConstraintDef[];
  source: 'sql' | 'dump';
  createStatement?: string; // Optional for debugging
}

export interface AnalysisInput {
  tables: ExtractedTable[];
  metadata: {
    dialect: 'postgres';
    sourceType: 'sql' | 'dump';
  };
}

export interface ForeignKey {
  column: string;
  referencesTable: string;
  referencesColumn: string;
}

export interface DumpParseResult {
  success: boolean;
  tables: ExtractedTable[];
  errors: string[];
  metadata: {
    totalSize: number;
    extractedSize: number;
    detectedFormat: string;
  };
}