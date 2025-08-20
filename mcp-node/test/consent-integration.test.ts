/**
 * Simple integration test to demonstrate consent system working
 */

import { describe, it, expect } from 'vitest';
import { ConsentManager } from '../src/consent/manager.js';
import { icnProcessConsent } from '../src/tools/icn_request_consent.js';

describe('Consent System Integration', () => {
  it('should demonstrate end-to-end consent flow', async () => {
    const manager = new ConsentManager({
      alwaysRequireConsent: ['icn_write_patch']
    });
    
    // 1. Check if tool requires consent
    const requiresConsent = manager.requiresConsentForUser('icn_write_patch', 'testuser');
    expect(requiresConsent).toBe(true);
    
    // 2. No existing consent should be found
    const existingConsent = manager.checkConsent('testuser', 'icn_write_patch');
    expect(existingConsent).toBe(null);
    
    // 3. Process user consent
    const consentResponse = await icnProcessConsent({
      requestId: 'test-req-123',
      approved: true,
      message: 'Approved for testing',
      userId: 'testuser',
      toolName: 'icn_write_patch',
      resource: 'src/test.ts'
    });
    
    expect(consentResponse.approved).toBe(true);
    expect(consentResponse.userId).toBe('testuser');
    
    // 4. Now consent should be found
    const newConsent = manager.checkConsent('testuser', 'icn_write_patch', 'src/test.ts');
    expect(newConsent).toBeDefined();
    expect(newConsent?.approved).toBe(true);
    expect(newConsent?.message).toBe('Approved for testing');
    
    // 5. Revoke consent
    const revoked = manager.revokeConsentDecision('testuser', 'icn_write_patch', 'src/test.ts');
    expect(revoked).toBe(true);
    
    // 6. Consent should now be denied
    const revokedConsent = manager.checkConsent('testuser', 'icn_write_patch', 'src/test.ts');
    expect(revokedConsent?.approved).toBe(false);
    
    console.log('✅ Consent system integration test passed!');
  });

  it('should demonstrate risk-based consent requirements', () => {
    const manager = new ConsentManager({
      riskThreshold: 'medium'
    });
    
    // Low risk tools should not require consent
    expect(manager.requiresConsentForUser('icn_get_architecture')).toBe(false);
    
    // Medium and high risk tools should require consent
    expect(manager.requiresConsentForUser('icn_check_policy')).toBe(true);
    expect(manager.requiresConsentForUser('icn_write_patch')).toBe(true);
    
    console.log('✅ Risk-based consent requirements working!');
  });

  it('should demonstrate environment configuration', () => {
    // Set environment variables
    process.env.ICN_CONSENT_REQUIRE_ALL = 'true';
    process.env.ICN_CONSENT_RISK_THRESHOLD = 'low';
    process.env.ICN_CONSENT_DEFAULT_EXPIRY = '3600';
    
    const manager = new ConsentManager();
    
    // All tools should require consent when ICN_CONSENT_REQUIRE_ALL is true
    expect(manager.requiresConsentForUser('icn_get_architecture')).toBe(true);
    
    // Clean up environment
    delete process.env.ICN_CONSENT_REQUIRE_ALL;
    delete process.env.ICN_CONSENT_RISK_THRESHOLD;
    delete process.env.ICN_CONSENT_DEFAULT_EXPIRY;
    
    console.log('✅ Environment configuration working!');
  });
});