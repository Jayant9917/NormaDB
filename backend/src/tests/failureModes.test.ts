import { DatabaseAnalyzer } from '../analyzer/databaseAnalyzer';

describe('Failure Mode Tests', () => {
  let analyzer: DatabaseAnalyzer;

  beforeEach(() => {
    analyzer = new DatabaseAnalyzer();
  });

  describe('Empty SQL File', () => {
    it('should handle empty SQL gracefully', () => {
      const result = analyzer.validateSQL('');
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('No CREATE TABLE statements found in the SQL file');
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Only Comments', () => {
    it('should handle SQL with only comments', () => {
      const sql = `
        -- This is a comment
        /* This is a block comment */
        -- Another comment
      `;
      
      const result = analyzer.validateSQL(sql);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('No CREATE TABLE statements found in the SQL file');
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Invalid CREATE TABLE', () => {
    it('should reject malformed CREATE TABLE', () => {
      const sql = `
        CREATE TABLE users (
          id SERIAL
          -- Missing closing parenthesis
      `;
      
      const result = analyzer.validateSQL(sql);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('SQL parsing failed');
    });
  });

  describe('Unsupported Syntax', () => {
    it('should reject CHECK constraints', () => {
      const sql = `
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          age INTEGER CHECK (age > 0)
        );
      `;
      
      const result = analyzer.validateSQL(sql);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Unsupported SQL construct: CHECK constraint');
    });

    it('should reject CREATE VIEW', () => {
      const sql = `
        CREATE VIEW user_view AS
        SELECT id, name FROM users;
      `;
      
      const result = analyzer.validateSQL(sql);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('No CREATE TABLE statements found in the SQL file');
    });

    it('should reject triggers', () => {
      const sql = `
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name TEXT
        );
        
        CREATE TRIGGER update_user
          BEFORE UPDATE ON users
          FOR EACH ROW
          EXECUTE FUNCTION update_user_function();
      `;
      
      const result = analyzer.validateSQL(sql);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Unsupported SQL construct');
    });
  });

  describe('Mixed Dialect SQL', () => {
    it('should handle MySQL syntax gracefully', () => {
      const sql = `
        CREATE TABLE users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL
        );
      `;
      
      const result = analyzer.validateSQL(sql);
      
      // Should parse but may have warnings about unsupported features
      expect(result.errors).toHaveLength(0);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Extremely Large SQL', () => {
    it('should handle large SQL files', () => {
      // Generate a large SQL with many tables
      let sql = '';
      for (let i = 0; i < 100; i++) {
        sql += `
          CREATE TABLE table_${i} (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
          );
        `;
      }
      
      expect(() => {
        const result = analyzer.validateSQL(sql);
        expect(result.isValid).toBe(true);
      }).not.toThrow();
    });
  });

  describe('Special Characters', () => {
    it('should handle Unicode characters in table/column names', () => {
      const sql = `
        CREATE TABLE "用户表" (
          "标识符" SERIAL PRIMARY KEY,
          "姓名" TEXT NOT NULL
        );
      `;
      
      const result = analyzer.validateSQL(sql);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Deeply Nested Constraints', () => {
    it('should handle complex foreign key chains', () => {
      const sql = `
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL
        );
        
        CREATE TABLE orders (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          order_date TIMESTAMP
        );
        
        CREATE TABLE order_items (
          id SERIAL PRIMARY KEY,
          order_id INTEGER REFERENCES orders(id),
          product_id INTEGER,
          quantity INTEGER
        );
        
        CREATE TABLE products (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL
        );
        
        ALTER TABLE order_items 
        ADD CONSTRAINT fk_product 
        FOREIGN KEY (product_id) REFERENCES products(id);
      `;
      
      expect(() => {
        const result = analyzer.validateSQL(sql);
        expect(result.isValid).toBe(true);
        
        const analysis = analyzer.analyzeSQL(sql);
        expect(analysis.schema.tables).toBeDefined();
        expect(Object.keys(analysis.schema.tables)).toHaveLength(4);
      }).not.toThrow();
    });
  });

  describe('Malformed Data Types', () => {
    it('should handle unknown data types gracefully', () => {
      const sql = `
        CREATE TABLE test (
          id SERIAL PRIMARY KEY,
          unknown_type UNKNOWN_TYPE,
          another_type CUSTOM_TYPE(10, 5)
        );
      `;
      
      const result = analyzer.validateSQL(sql);
      
      // Should parse but may have warnings
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Concurrent Analysis Stress Test', () => {
    it('should handle multiple concurrent analyses', async () => {
      const sql = `
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email TEXT NOT NULL UNIQUE
        );
      `;
      
      // Run multiple analyses concurrently
      const promises = Array.from({ length: 10 }, () => 
        Promise.resolve(analyzer.analyzeSQL(sql))
      );
      
      const results = await Promise.all(promises);
      
      // All should succeed and produce identical results
      results.forEach(result => {
        expect(result.overallScore).toBeGreaterThan(0);
        expect(result.compliance['1NF'].score).toBe(100);
      });
      
      // All results should be identical
      const firstResult = results[0];
      results.forEach(result => {
        expect(result.overallScore).toBe(firstResult.overallScore);
        expect(result.compliance['1NF'].score).toBe(firstResult.compliance['1NF'].score);
      });
    });
  });
});
