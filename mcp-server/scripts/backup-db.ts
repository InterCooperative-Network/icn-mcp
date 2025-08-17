#!/usr/bin/env tsx
/**
 * Database backup CLI script
 * Usage: npx tsx scripts/backup-db.ts [backup-path]
 * 
 * Creates an async backup of the ICN MCP database to prevent blocking
 * the main application during backup operations.
 */

import { createBackup } from '../src/db';
import path from 'node:path';

async function main() {
  const backupPath = process.argv[2];
  
  try {
    console.log('Creating database backup...');
    const finalPath = await createBackup(backupPath);
    console.log(`✅ Backup completed successfully: ${finalPath}`);
    
    // Show backup size
    const fs = await import('node:fs');
    const stats = fs.statSync(finalPath);
    console.log(`📁 Backup size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

// Default backup path with timestamp
if (!process.argv[2]) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const defaultPath = path.resolve(__dirname, `../../var/backup-${timestamp}.sqlite`);
  console.log(`No backup path provided, using: ${defaultPath}`);
  process.argv[2] = defaultPath;
}

main().catch(console.error);