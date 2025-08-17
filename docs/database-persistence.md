# Database Persistence Enhancements

This document describes the enhanced database persistence features implemented for production readiness.

## Key Improvements

### 1. Migration Tracking System
- **Migration Versioning**: All database migrations are now tracked with versions and checksums
- **Integrity Verification**: Migration checksums prevent accidental schema corruption  
- **Applied Migration History**: Complete audit trail of when migrations were applied

### 2. Enhanced Connection Management
- **Health Monitoring**: Periodic health checks with automatic reconnection on failure
- **Connection Reuse**: Efficient connection pooling and reuse patterns
- **Graceful Cleanup**: Proper connection cleanup and resource management

### 3. SQLite Optimization for Production
- **WAL Mode**: Write-Ahead Logging enabled for better concurrency
- **Busy Timeout**: 30-second timeout for handling concurrent access
- **Cache Optimization**: Memory-based temporary storage and optimal cache settings
- **Synchronous Mode**: Balanced durability vs performance settings

### 4. Concurrency Safety
- **Operation Locking**: In-memory locks prevent race conditions for critical operations
- **Transaction Retry**: Automatic retry logic for busy database scenarios  
- **Atomic Operations**: Enhanced transaction management with rollback support

### 5. Backup and Recovery
- **Automated Backups**: `createBackup()` function for consistent database snapshots
- **Recovery Support**: `restoreFromBackup()` for disaster recovery scenarios
- **Backup Verification**: Ensures backup files are valid and accessible

### 6. Monitoring and Diagnostics
- **Database Information**: `getDatabaseInfo()` provides comprehensive database metrics
- **Table Statistics**: Row counts and size information for all tables
- **Migration Status**: Complete history of applied database migrations

## Environment Configuration

The system supports environment variable configuration:

```bash
# Database location (defaults to ../var/icn-mcp.sqlite)
MCP_DB_PATH=/path/to/database.sqlite

# Migration directory (defaults to ../db/migrations)  
MCP_MIGRATIONS_DIR=/path/to/migrations

# Database directory (defaults to ../var)
MCP_DB_DIR=/path/to/db/directory
```

## Usage Examples

### Health Check
```typescript
import { getDb } from './db';

// Database connection with automatic health monitoring
const db = getDb();
```

### Backup Creation
```typescript
import { createBackup } from './db';

// Create timestamped backup
const backupPath = createBackup();
console.log(`Backup created: ${backupPath}`);
```

### Database Information
```typescript
import { getDatabaseInfo } from './db';

const info = getDatabaseInfo();
console.log(`Database size: ${info.size} bytes`);
console.log(`Tables: ${info.tables.length}`);
console.log(`Migrations applied: ${info.migrations.length}`);
```

### Concurrency-Safe Operations
```typescript
import { withLock } from './db';

// Prevent race conditions for critical operations
await withLock('task-processing', async () => {
  // Critical task processing logic here
});
```

## Production Considerations

1. **Database Location**: Ensure the database directory has proper write permissions
2. **Backup Strategy**: Regular automated backups using `createBackup()`
3. **Monitoring**: Use `getDatabaseInfo()` for operational monitoring
4. **Disk Space**: Monitor database size growth and plan for capacity
5. **Connection Limits**: SQLite handles multiple readers but single writer effectively

## Migration Management

Migrations are automatically applied on database initialization:
- Files in `db/migrations/` are processed in sorted order
- Each migration is tracked with version and checksum
- Duplicate applications are prevented automatically
- Failed migrations are logged with detailed error information

The system ensures all agent registrations, tokens, and tasks survive process restarts through this robust persistence layer.