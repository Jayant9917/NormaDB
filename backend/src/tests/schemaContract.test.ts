import { SQLParser } from '../parser/sqlParser';

describe('Canonical Schema Contract Tests', () => {
  let parser: SQLParser;

  beforeEach(() => {
    parser = new SQLParser();
  });

  describe('Simple Table', () => {
    it('should produce stable canonical schema for simple table', () => {
      const sql = `
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE
        );
      `;

      const schema = parser.parse(sql);
      
      // Contract: Simple table structure
      expect(schema).toEqual({
        tables: {
          users: {
            name: 'users',
            columns: {
              id: {
                name: 'id',
                type: 'SERIAL',
                nullable: true,
                primaryKey: true,
                unique: false
              },
              name: {
                name: 'name',
                type: 'TEXT',
                nullable: false,
                primaryKey: false,
                unique: false
              },
              email: {
                name: 'email',
                type: 'TEXT',
                nullable: true,
                primaryKey: false,
                unique: true
              }
            },
            primaryKeys: ['id'],
            foreignKeys: [],
            uniqueConstraints: [['email']]
          }
        }
      });
    });
  });

  describe('Composite Primary Key', () => {
    it('should produce stable canonical schema for composite PK', () => {
      const sql = `
        CREATE TABLE enrollment (
          student_id INTEGER,
          course_id INTEGER,
          grade TEXT,
          PRIMARY KEY (student_id, course_id)
        );
      `;

      const schema = parser.parse(sql);
      
      // Contract: Composite PK order preserved
      expect(schema).toEqual({
        tables: {
          enrollment: {
            name: 'enrollment',
            columns: {
              student_id: {
                name: 'student_id',
                type: 'INTEGER',
                nullable: true,
                primaryKey: false,
                unique: false
              },
              course_id: {
                name: 'course_id',
                type: 'INTEGER',
                nullable: true,
                primaryKey: false,
                unique: false
              },
              grade: {
                name: 'grade',
                type: 'TEXT',
                nullable: true,
                primaryKey: false,
                unique: false
              }
            },
            primaryKeys: ['student_id', 'course_id'],
            foreignKeys: [],
            uniqueConstraints: []
          }
        }
      });
    });
  });

  describe('Foreign Key + Unique Constraints', () => {
    it('should produce stable canonical schema for FK and UNIQUE', () => {
      const sql = `
        CREATE TABLE orders (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          order_number TEXT UNIQUE,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `;

      const schema = parser.parse(sql);
      
      // Contract: FK references and unique constraints
      expect(schema).toEqual({
        tables: {
          orders: {
            name: 'orders',
            columns: {
              id: {
                name: 'id',
                type: 'SERIAL',
                nullable: true,
                primaryKey: true,
                unique: false
              },
              user_id: {
                name: 'user_id',
                type: 'INTEGER',
                nullable: true,
                primaryKey: false,
                unique: false,
                foreignKey: {
                  table: 'users',
                  column: 'id'
                }
              },
              order_number: {
                name: 'order_number',
                type: 'TEXT',
                nullable: true,
                primaryKey: false,
                unique: true
              }
            },
            primaryKeys: ['id'],
            foreignKeys: [{
              column: 'user_id',
              referencesTable: 'users',
              referencesColumn: 'id'
            }],
            uniqueConstraints: [['order_number']]
          }
        }
      });
    });
  });

  describe('Array + JSON Types', () => {
    it('should produce stable canonical schema for array and JSON types', () => {
      const sql = `
        CREATE TABLE posts (
          id SERIAL PRIMARY KEY,
          title TEXT,
          tags TEXT[],
          metadata JSONB
        );
      `;

      const schema = parser.parse(sql);
      
      // Contract: Array and JSON type handling
      expect(schema).toEqual({
        tables: {
          posts: {
            name: 'posts',
            columns: {
              id: {
                name: 'id',
                type: 'SERIAL',
                nullable: true,
                primaryKey: true,
                unique: false
              },
              title: {
                name: 'title',
                type: 'TEXT',
                nullable: true,
                primaryKey: false,
                unique: false
              },
              tags: {
                name: 'tags',
                type: 'TEXT[]',
                nullable: true,
                primaryKey: false,
                unique: false
              },
              metadata: {
                name: 'metadata',
                type: 'JSONB',
                nullable: true,
                primaryKey: false,
                unique: false
              }
            },
            primaryKeys: ['id'],
            foreignKeys: [],
            uniqueConstraints: []
          }
        }
      });
    });
  });

  describe('Quoted Identifiers', () => {
    it('should produce stable canonical schema for quoted identifiers', () => {
      const sql = `
        CREATE TABLE "User Profiles" (
          "ID" SERIAL PRIMARY KEY,
          "User Name" TEXT NOT NULL,
          "Email Address" TEXT
        );
      `;

      const schema = parser.parse(sql);
      
      // Contract: Quoted identifier normalization
      expect(schema).toEqual({
        tables: {
          'user profiles': {
            name: 'user profiles',
            columns: {
              'ID': {
                name: 'ID',
                type: 'SERIAL',
                nullable: true,
                primaryKey: true,
                unique: false
              },
              'User Name': {
                name: 'User Name',
                type: 'TEXT',
                nullable: false,
                primaryKey: false,
                unique: false
              },
              'Email Address': {
                name: 'Email Address',
                type: 'TEXT',
                nullable: true,
                primaryKey: false,
                unique: false
              }
            },
            primaryKeys: ['ID'],
            foreignKeys: [],
            uniqueConstraints: []
          }
        }
      });
    });
  });
});
