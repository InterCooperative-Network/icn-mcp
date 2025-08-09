import Database from 'better-sqlite3';

export function openDb(path = ':memory:') {
  const db = new Database(path);
  return db;
}

