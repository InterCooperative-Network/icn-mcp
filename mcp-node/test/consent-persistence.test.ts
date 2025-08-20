/**
 * Tests for consent persistence and enforcement
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { ConsentManager } from '../src/consent/manager.js';
import { 
  persistConsentDecision, 
  checkPersistedConsent, 
  revokeConsent, 
  getUserConsentHistory,
  cleanupExpiredConsent 
} from '../src/consent/persistence.js';
import { icnProcessConsent } from '../src/tools/icn_request_consent.js';

// Test database path
const testDbPath = path.join(process.cwd(), 'test.consent.sqlite');

describe('Consent Persistence and Enforcement', () => {
  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    // Set environment variable for test database
    process.env.MCP_DB_PATH = testDbPath;
    
    // Initialize test database with consent table
    const db = new Database(testDbPath);
    db.exec(`
      CREATE TABLE consent_decisions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        resource TEXT,
        approved INTEGER NOT NULL,
        message TEXT,
        risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
        timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
        expires_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(user_id, tool_name, resource)
      );
    `);
    db.close();
  });

  afterEach(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    delete process.env.MCP_DB_PATH;
  });

  describe('ConsentManager Database Integration', () => {
    it('should persist consent decisions to database', () => {
      const manager = new ConsentManager();
      const userId = 'user123';
      const toolName = 'icn_write_patch';
      const resource = 'src/test.ts';
      
      const response = {
        approved: true,
        message: 'Approved for testing',
        timestamp: new Date().toISOString(),
        userId
      };
      
      const persistedDecision = manager.persistConsent(
        userId,
        toolName,
        resource,
        response,
        'high'
      );
      
      expect(persistedDecision).toBeDefined();
      expect(persistedDecision.userId).toBe(userId);
      expect(persistedDecision.toolName).toBe(toolName);
      expect(persistedDecision.resource).toBe(resource);
      expect(persistedDecision.approved).toBe(true);
      expect(persistedDecision.riskLevel).toBe('high');
      expect(persistedDecision.message).toBe('Approved for testing');
    });

    it('should check existing consent decisions', () => {
      const manager = new ConsentManager();
      const userId = 'user123';
      const toolName = 'icn_write_patch';
      const resource = 'src/test.ts';
      
      // First persist a decision
      const response = {
        approved: true,
        message: 'Approved for testing',
        timestamp: new Date().toISOString(),
        userId
      };
      
      manager.persistConsent(userId, toolName, resource, response, 'high');
      
      // Then check if it exists
      const existingConsent = manager.checkConsent(userId, toolName, resource);
      
      expect(existingConsent).toBeDefined();
      expect(existingConsent?.approved).toBe(true);
      expect(existingConsent?.userId).toBe(userId);
      expect(existingConsent?.toolName).toBe(toolName);
      expect(existingConsent?.resource).toBe(resource);
    });

    it('should enforce consent requirements', () => {
      const manager = new ConsentManager({
        alwaysRequireConsent: ['icn_write_patch'],
        neverRequireConsent: ['icn_get_architecture']
      });
      
      // High-risk tool should require consent
      expect(manager.requiresConsentForUser('icn_write_patch', 'user123')).toBe(true);
      
      // Low-risk tool should not require consent
      expect(manager.requiresConsentForUser('icn_get_architecture', 'user123')).toBe(false);
      
      // After granting consent, should not require it again
      const response = {
        approved: true,
        message: 'Approved for testing',
        timestamp: new Date().toISOString(),
        userId: 'user123'
      };
      
      manager.persistConsent('user123', 'icn_write_patch', undefined, response, 'high');
      
      // Should still return true (requires consent) but existing consent should be checked separately
      expect(manager.requiresConsentForUser('icn_write_patch', 'user123')).toBe(true);
      
      // But checkConsent should return the approval
      const existingConsent = manager.checkConsent('user123', 'icn_write_patch');
      expect(existingConsent?.approved).toBe(true);
    });

    it('should revoke consent decisions', () => {
      const manager = new ConsentManager();
      const userId = 'user123';
      const toolName = 'icn_write_patch';
      
      // First grant consent
      const response = {
        approved: true,
        message: 'Initial approval',
        timestamp: new Date().toISOString(),
        userId
      };
      
      manager.persistConsent(userId, toolName, undefined, response, 'high');
      
      // Check consent exists and is approved
      let consent = manager.checkConsent(userId, toolName);
      expect(consent?.approved).toBe(true);
      
      // Revoke consent
      const revoked = manager.revokeConsentDecision(userId, toolName);
      expect(revoked).toBe(true);
      
      // Check consent is now denied
      consent = manager.checkConsent(userId, toolName);
      expect(consent?.approved).toBe(false);
    });

    it('should get user consent history', () => {
      const manager = new ConsentManager();
      const userId = 'user123';
      
      // Add multiple consent decisions
      const decisions = [
        { toolName: 'icn_write_patch', approved: true, message: 'First approval' },
        { toolName: 'icn_run_tests', approved: false, message: 'Denied tests' },
        { toolName: 'icn_generate_pr_patch', approved: true, message: 'PR approved' }
      ];
      
      for (const decision of decisions) {
        const response = {
          approved: decision.approved,
          message: decision.message,
          timestamp: new Date().toISOString(),
          userId
        };
        
        manager.persistConsent(userId, decision.toolName, undefined, response, 'high');
      }
      
      // Get history
      const history = manager.getConsentHistory(userId);
      expect(history).toHaveLength(3);
      
      // Check they're sorted by creation time (newest first)
      expect(history[0].toolName).toBe('icn_generate_pr_patch');
      expect(history[1].toolName).toBe('icn_run_tests');
      expect(history[2].toolName).toBe('icn_write_patch');
      
      // Check approval status
      expect(history[0].approved).toBe(true);
      expect(history[1].approved).toBe(false);
      expect(history[2].approved).toBe(true);
    });
  });

  describe('Consent Expiration', () => {
    it('should handle expired consent', () => {
      const manager = new ConsentManager({
        defaultExpirySeconds: 1 // 1 second expiry for testing
      });
      
      const userId = 'user123';
      const toolName = 'icn_write_patch';
      
      // Grant consent with short expiry
      const response = {
        approved: true,
        message: 'Short-lived approval',
        timestamp: new Date().toISOString(),
        userId
      };
      
      manager.persistConsent(userId, toolName, undefined, response, 'high');
      
      // Should find consent immediately
      let consent = manager.checkConsent(userId, toolName);
      expect(consent?.approved).toBe(true);
      
      // Wait for expiration (1 second + buffer)
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Should not find valid consent after expiry
          consent = manager.checkConsent(userId, toolName);
          expect(consent).toBe(null);
          resolve();
        }, 1100);
      });
    });

    it('should clean up expired consents', () => {
      const manager = new ConsentManager();
      const userId = 'user123';
      
      // Add consent with past expiry
      const pastTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      persistConsentDecision(
        userId,
        'icn_write_patch',
        undefined,
        true,
        'Expired consent',
        'high',
        pastTimestamp // Already expired
      );
      
      // Add current consent
      persistConsentDecision(
        userId,
        'icn_run_tests',
        undefined,
        true,
        'Valid consent',
        'medium'
      );
      
      // Clean up expired consents
      const cleaned = manager.cleanupExpiredConsents();
      expect(cleaned).toBe(1);
      
      // Should not find expired consent
      const expiredConsent = manager.checkConsent(userId, 'icn_write_patch');
      expect(expiredConsent).toBe(null);
      
      // Should still find valid consent
      const validConsent = manager.checkConsent(userId, 'icn_run_tests');
      expect(validConsent?.approved).toBe(true);
    });
  });

  describe('icnProcessConsent Integration', () => {
    it('should persist consent through icnProcessConsent', async () => {
      const userId = 'user123';
      const toolName = 'icn_write_patch';
      const resource = 'src/test.ts';
      
      const result = await icnProcessConsent({
        requestId: 'req123',
        approved: true,
        message: 'User approved via UI',
        userId,
        toolName,
        resource
      });
      
      expect(result.approved).toBe(true);
      expect(result.userId).toBe(userId);
      expect(result.message).toBe('User approved via UI');
      
      // Check that it was persisted
      const manager = new ConsentManager();
      const persistedConsent = manager.checkConsent(userId, toolName, resource);
      
      expect(persistedConsent).toBeDefined();
      expect(persistedConsent?.approved).toBe(true);
      expect(persistedConsent?.message).toBe('User approved via UI');
    });

    it('should handle denied consent through icnProcessConsent', async () => {
      const userId = 'user123';
      const toolName = 'icn_run_tests';
      
      const result = await icnProcessConsent({
        requestId: 'req124',
        approved: false,
        message: 'User denied request',
        userId,
        toolName
      });
      
      expect(result.approved).toBe(false);
      expect(result.message).toBe('User denied request');
      
      // Check that denial was persisted
      const manager = new ConsentManager();
      const persistedConsent = manager.checkConsent(userId, toolName);
      
      expect(persistedConsent).toBeDefined();
      expect(persistedConsent?.approved).toBe(false);
      expect(persistedConsent?.message).toBe('User denied request');
    });
  });

  describe('Risk-Based Consent Requirements', () => {
    it('should require consent based on risk threshold', () => {
      const manager = new ConsentManager({
        riskThreshold: 'medium'
      });
      
      // Low risk should not require consent
      expect(manager.requiresConsentForUser('icn_get_architecture', 'user123')).toBe(false);
      
      // Medium risk should require consent
      expect(manager.requiresConsentForUser('icn_check_policy', 'user123')).toBe(true);
      
      // High risk should require consent
      expect(manager.requiresConsentForUser('icn_write_patch', 'user123')).toBe(true);
    });

    it('should override risk threshold with explicit lists', () => {
      const manager = new ConsentManager({
        riskThreshold: 'high',
        alwaysRequireConsent: ['icn_get_architecture'], // Override low risk
        neverRequireConsent: ['icn_write_patch'] // Override high risk
      });
      
      // Should require consent despite being low risk
      expect(manager.requiresConsentForUser('icn_get_architecture', 'user123')).toBe(true);
      
      // Should not require consent despite being high risk
      expect(manager.requiresConsentForUser('icn_write_patch', 'user123')).toBe(false);
    });
  });

  describe('Direct Persistence Functions', () => {
    it('should persist and retrieve consent decisions', () => {
      const userId = 'user123';
      const toolName = 'icn_write_patch';
      const resource = 'src/test.ts';
      
      // Persist decision
      const decision = persistConsentDecision(
        userId,
        toolName,
        resource,
        true,
        'Direct persistence test',
        'high'
      );
      
      expect(decision.userId).toBe(userId);
      expect(decision.toolName).toBe(toolName);
      expect(decision.approved).toBe(true);
      
      // Retrieve decision
      const retrieved = checkPersistedConsent(userId, toolName, resource);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(decision.id);
      expect(retrieved?.approved).toBe(true);
    });

    it('should handle resource-specific consent', () => {
      const userId = 'user123';
      const toolName = 'icn_write_patch';
      
      // Consent for specific resource
      persistConsentDecision(userId, toolName, 'src/file1.ts', true, 'File 1 approved', 'high');
      
      // Consent for different resource
      persistConsentDecision(userId, toolName, 'src/file2.ts', false, 'File 2 denied', 'high');
      
      // General consent (no resource)
      persistConsentDecision(userId, toolName, undefined, true, 'General approval', 'high');
      
      // Check specific consents
      const file1Consent = checkPersistedConsent(userId, toolName, 'src/file1.ts');
      expect(file1Consent?.approved).toBe(true);
      expect(file1Consent?.message).toBe('File 1 approved');
      
      const file2Consent = checkPersistedConsent(userId, toolName, 'src/file2.ts');
      expect(file2Consent?.approved).toBe(false);
      expect(file2Consent?.message).toBe('File 2 denied');
      
      const generalConsent = checkPersistedConsent(userId, toolName);
      expect(generalConsent?.approved).toBe(true);
      expect(generalConsent?.message).toBe('General approval');
      
      // Non-existent resource should not match specific consents
      const unknownConsent = checkPersistedConsent(userId, toolName, 'src/unknown.ts');
      expect(unknownConsent).toBe(null);
    });
  });
});