# NormaDB - Database Normalization Analyzer

**Version-1.0.0 - Production Ready** 🚀

> Static database normalization analyzer for PostgreSQL with clean architecture and multi-schema support.

---

## 🎯 What It Does

NormaDB analyzes PostgreSQL database schemas for normalization compliance (1NF, 2NF, 3NF) with **deterministic rule-based analysis** - no AI, no ML, no guessing.

### ✅ Key Features
- **🔍 Multi-Schema Support**: Analyze databases with multiple schemas (auth, public, realtime, storage, etc.)
- **📊 Normalization Analysis**: 1NF, 2NF, 3NF compliance with detailed violation reporting
- **🏗️ Clean Architecture**: Single entry point analyzer with parser/analysis separation
- **📄 Multiple Input Formats**: SQL files and PostgreSQL dump files
- **⚡ Real-Time Analysis**: Instant feedback with explainable violations
- **🎯 Production Ready**: Runtime contract enforcement, TypeScript, comprehensive testing

### 🎨 Architecture
```
API Layer → Parser Selection → ExtractedTable Objects → Analyzer → Rule Engine → Scoring → Response
```

**Key Principle**: ❌ Analyzer never parses SQL | ✅ Parser is single source of truth

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- PostgreSQL dump files or SQL schemas

### Installation
```bash
# Clone and install
git clone <repository-url>
cd NormaDB
npm install

# Build for production
npm run build
cd backend && npm run build
```

### Development
```bash
# Start development servers
npm run dev

# Backend API: http://localhost:3001
# Frontend UI: http://localhost:3000
```

### Production
```bash
# Build and start
npm run build
cd backend && npm start
```

---

## 📡 API Endpoints

### Health Check
```http
GET /api/health
```

### Analyze SQL Content
```http
POST /api/analyze
Content-Type: application/json

{
  "sqlContent": "CREATE TABLE users (...)"
}
```

### Analyze PostgreSQL Dump File (Multi-Schema)
```http
POST /api/analyze-dump-schemas
Content-Type: application/json

{
  "dumpContent": "-- PostgreSQL dump file content..."
}
```

### Analyze SQL File
```http
POST /api/analyze-file
Content-Type: multipart/form-data

sqlFile: [file.sql]
```

---

## 📊 Response Format

### Multi-Schema Analysis Response
```json
{
  "success": true,
  "summary": {
    "totalSchemas": 4,
    "totalTables": 65,
    "overallScore": 73.3
  },
  "schemas": [
    {
      "schemaName": "auth",
      "tableCount": 17,
      "normalization": {
        "1NF": { "score": 0.0, "violatedTables": 17 },
        "2NF": { "score": 100.0, "violatedTables": 0 },
        "3NF": { "score": 100.0, "violatedTables": 0 }
      },
      "violations": [...],
      "status": "NEEDS_ATTENTION"
    }
  ],
  "dumpInfo": {
    "format": "binary",
    "tablesExtracted": 65,
    "errors": []
  }
}
```

---

## 🔧 Normalization Rules

### 1NF (First Normal Form)
- **No Repeating Groups**: Detects JSON/JSONB columns, arrays
- **Atomic Values**: Ensures columns contain indivisible values
- **Primary Key Required**: Every table must have a primary key

### 2NF (Second Normal Form)
- **No Partial Dependencies**: Non-key attributes depend on entire composite primary key
- **Full Functional Dependency**: All attributes fully depend on primary key

### 3NF (Third Normal Form)
- **No Transitive Dependencies**: Non-key attributes don't depend on other non-key attributes
- **Boyce-Codd Normal Form**: Every determinant is a candidate key

---

## 🏗️ Project Structure

```
NormaDB/
├── backend/
│   ├── src/
│   │   ├── analyzer/
│   │   │   ├── databaseAnalyzer.ts      # Single entry point analyzer
│   │   │   └── complianceCalculator.ts   # Scoring engine
│   │   ├── parser/
│   │   │   ├── sqlParser.ts             # SQL file parser
│   │   │   └── dumpParser.ts            # PostgreSQL dump parser
│   │   ├── rules/
│   │   │   ├── firstNormalFormRules.ts  # 1NF rule implementations
│   │   │   ├── secondNormalFormRules.ts # 2NF rule implementations
│   │   │   └── thirdNormalFormRules.ts  # 3NF rule implementations
│   │   ├── types/
│   │   │   ├── schema.ts                # Core data structures
│   │   │   ├── dumpParser.ts            # ExtractedTable interface
│   │   │   └── analysis.ts              # Analysis result types
│   │   └── server.ts                    # Express API server
│   ├── dist/                            # Compiled TypeScript
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.js                       # React application
│   │   └── App.css                      # Styling
│   ├── build/                           # Built React app
│   └── package.json
├── .gitignore
├── README.md
└── VERSION_1_FREEZE.md                  # Version-1 scope documentation
```

---

## 🎯 Technical Specifications

- **Language**: TypeScript
- **Backend**: Node.js + Express
- **Frontend**: React 18
- **Database Support**: PostgreSQL (dump files + SQL)
- **Architecture**: Clean separation of concerns
- **Analysis**: Deterministic rule-based (no AI/ML)
- **Processing**: Stateless, no database connections
- **Contracts**: Runtime validation enforced

---

## 🏆 Version-1 Achievements

### ✅ Production Ready Features
- **4+ Schema Detection**: auth, public, realtime, storage, etc.
- **65+ Table Analysis**: Real-world PostgreSQL databases
- **65+ Violation Detection**: Comprehensive normalization analysis
- **Clean Architecture**: Single entry point, no SQL re-parsing
- **Runtime Contracts**: Type safety and validation
- **Multi-Format Support**: SQL files + PostgreSQL dumps

### 🎯 Architecture Highlights
- **API decides parser, not analyzer** - Clean separation
- **Single analyzer entry point** - No guessing, no fallbacks
- **No SQL re-parsing in analyzer** - Only analysis
- **Schema guessing eliminated** - Extracted facts only
- **Production-grade codebase** - TypeScript, testing, clean code

---

## 📈 Example Usage

### Analyzing a Multi-Schema Database
```bash
curl -X POST http://localhost:3001/api/analyze-dump-schemas \
  -H "Content-Type: application/json" \
  -d '{"dumpContent": "$(cat database.dump)"}'
```

### Response
```json
{
  "success": true,
  "summary": {
    "totalSchemas": 4,
    "totalTables": 65,
    "overallScore": 73.3
  },
  "schemas": [
    {"schemaName": "auth", "tableCount": 17, "status": "NEEDS_ATTENTION"},
    {"schemaName": "public", "tableCount": 38, "status": "NEEDS_ATTENTION"},
    {"schemaName": "realtime", "tableCount": 3, "status": "NEEDS_ATTENTION"},
    {"schemaName": "storage", "tableCount": 7, "status": "NEEDS_ATTENTION"}
  ]
}
```

---

## ⚠️ Version-1 Limitations

- **PostgreSQL only**: Single database dialect support
- **Static analysis**: No live database connections
- **Rule-based**: No AI/ML or heuristic learning
- **File-based**: Analyzes SQL/dump files only
- **No persistence**: Stateless processing

---

## 🤝 Contributing

**Version-1 is frozen** - focused on core functionality stability.

Future versions may include:
- Additional SQL dialects (MySQL, SQL Server)
- Advanced visualization features
- Schema comparison tools
- Enterprise integrations

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🏁 Version-1.0.0

**Released**: January 2026  
**Status**: Production Ready  
**Architecture**: Clean, deterministic, rule-based  

**🚀 NormaDB - Static database normalization analysis done right.**
