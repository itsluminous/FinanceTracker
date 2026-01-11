import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Simulates the database trigger logic for first user admin assignment
function assignRoleOnSignup(existingUsers: any[], newUser: any) {
  if (existingUsers.length === 0) {
    return { ...newUser, role: 'admin', approved_at: new Date() };
  }
  return { ...newUser, role: 'pending', approved_at: null };
}

describe('User Management - Property Tests', () => {
  /**
   * Feature: personal-finance-tracker, Property 1: First user admin assignment
   * Validates: Requirements 1.3
   * 
   * Property: For any empty user_profiles table, when a new user signs up,
   * that user should be assigned the 'admin' role automatically.
   */
  it('Property 1: First user admin assignment', () => {
    const userArbitrary = fc.record({
      id: fc.uuid(),
      email: fc.emailAddress(),
      name: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
    });

    fc.assert(
      fc.property(userArbitrary, (user) => {
        const existingUsers: any[] = [];
        const result = assignRoleOnSignup(existingUsers, user);
        
        expect(result.role).toBe('admin');
        expect(result.approved_at).toBeTruthy();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: personal-finance-tracker, Property 2: Subsequent users pending status
   * Validates: Requirements 1.4
   * 
   * Property: For any non-empty user_profiles table, when a new user signs up,
   * that user should be assigned the 'pending' role.
   */
  it('Property 2: Subsequent users pending status', () => {
    const userArbitrary = fc.record({
      id: fc.uuid(),
      email: fc.emailAddress(),
      name: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
    });

    const existingUserArbitrary = fc.array(userArbitrary, { minLength: 1, maxLength: 10 });

    fc.assert(
      fc.property(existingUserArbitrary, userArbitrary, (existingUsers, newUser) => {
        const result = assignRoleOnSignup(existingUsers, newUser);
        
        expect(result.role).toBe('pending');
        expect(result.approved_at).toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});
