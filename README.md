# NormaDB - Database Normalization Analyzer

Version-1 (Foundational Engineering Release)

A PostgreSQL database normalization analyzer that checks your SQL schemas for 1NF, 2NF, and 3NF compliance.

## Features

- **PostgreSQL SQL Parsing**: Reliable parsing of CREATE TABLE statements
- **Normalization Analysis**: Detects violations for 1NF, 2NF, and 3NF
- **Compliance Scoring**: Provides percentage-based compliance scores
- **Actionable Recommendations**: Detailed explanations and fix suggestions
- **Modern React UI**: Clean, responsive interface for file upload and results
- **REST API**: Express.js backend with comprehensive endpoints

## Architecture

```
React UI
   ↓
Node.js API (Express)
   ↓
SQL Parser → Canonical Schema Model
   ↓
Normalization Rule Engine
   ↓
Compliance Calculator
   ↓
Report Builder
```

## Supported SQL Constructs

- `CREATE TABLE` statements
- Column definitions with data types
- `PRIMARY KEY` constraints
- `FOREIGN KEY` constraints  
- `UNIQUE` constraints

## Quick Start

### Prerequisites

- Node.js 16+ 
- npm or yarn

### Installation

1. **Install backend dependencies**:
```bash
cd backend && npm install
```

2. **Install frontend dependencies**:
```bash
cd frontend && npm install
```

3. **Build the project**:
```bash
cd backend && npm run build
```

### Development

1. **Start the backend server**:
```bash
cd backend && npm run dev
```
The API will be available at `http://localhost:3001`

2. **Start the frontend development server**:
```bash
cd backend && npm run dev:frontend
```
The UI will be available at `http://localhost:3000`

### Production

1. **Build the frontend**:
```bash
cd backend && npm run build:frontend
```

2. **Start the production server**:
```bash
cd backend && npm start
```

## API Endpoints

### Health Check
```
GET /api/health
```

### Analyze SQL Content
```
POST /api/analyze
Content-Type: application/json

{
  "sqlContent": "CREATE TABLE users (...)"
}
```

### Analyze SQL File
```
POST /api/analyze-file
Content-Type: multipart/form-data

sqlFile: [file.sql]
```

### Validate SQL
```
POST /api/validate
Content-Type: application/json

{
  "sqlContent": "CREATE TABLE users (...)"
}
```

### Get Supported Features
```
GET /api/features
```

## Normalization Rules

### 1NF (First Normal Form)
- **No Repeating Groups**: Detects array types and multi-value columns
- **Atomic Values**: Ensures columns contain indivisible values
- **Primary Key Required**: Every table must have a primary key

### 2NF (Second Normal Form)  
- **No Partial Dependencies**: Non-key attributes must depend on entire composite primary key
- **Full Functional Dependency**: All attributes must fully depend on the primary key

### 3NF (Third Normal Form)
- **No Transitive Dependencies**: Non-key attributes must not depend on other non-key attributes
- **Boyce-Codd Normal Form**: Every determinant must be a candidate key

## Response Format

```json
{
  "success": true,
  "report": {
    "schema": { ... },
    "compliance": {
      "1NF": {
        "score": 95.5,
        "totalRules": 3,
        "passedRules": 2,
        "violations": [ ... ]
      },
      "2NF": { ... },
      "3NF": { ... }
    },
    "overallScore": 87.3,
    "summary": {
      "totalViolations": 3,
      "criticalViolations": 1,
      "warnings": 2
    }
  },
  "warnings": [ ... ]
}
```

## Project Structure

```
NormaDB/
├── backend/
│   ├── src/
│   │   ├── analyzer/
│   │   │   ├── complianceCalculator.ts
│   │   │   └── databaseAnalyzer.ts
│   │   ├── parser/
│   │   │   └── sqlParser.ts
│   │   ├── rules/
│   │   │   ├── ruleEngine.ts
│   │   │   ├── firstNormalFormRules.ts
│   │   │   ├── secondNormalFormRules.ts
│   │   │   └── thirdNormalFormRules.ts
│   │   ├── types/
│   │   │   └── schema.ts
│   │   └── server.ts
│   ├── dist/
│   ├── package.json
│   ├── tsconfig.json
│   ├── test-schema.sql
│   └── test-analysis.js
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── App.css
│   │   └── index.js
│   ├── public/
│   │   └── index.html
│   ├── build/
│   └── package.json
├── .gitignore
└── README.md
```

## Technical Specifications

- **Language**: TypeScript
- **Backend**: Node.js + Express
- **Frontend**: React 18
- **Database Support**: PostgreSQL only
- **No AI/ML**: Pure rule-based analysis
- **No Database Connections**: Analyzes SQL files only
- **No Data Storage**: Stateless processing

## Limitations

- PostgreSQL dialect only
- No ALTER TABLE support
- No CREATE VIEW support
- No stored procedure analysis
- Heuristic-based 2NF/3NF detection (confidence scores provided)

## Contributing

This is Version-1 focused on core functionality. Future versions may include:
- Additional SQL dialects
- Advanced visualization
- Schema comparison tools
- Enterprise features

## License

MIT License
