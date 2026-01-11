import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

interface User {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
  approved_at?: Date | null;
}

// Simulates the database trigger logic for first user admin assignment
function assignRoleOnSignup(existingUsers: User[], newUser: User) {
  if (existingUsers.length === 0) {
    return { ...newUser, role: 'admin', approved_at: new Date() };
  }
  return { ...newUser, role: 'pending', approved_at: null };
}

// Simulates user approval with profile links
function approveUser(
  userId: string,
  role: 'admin' | 'approved',
  approvedBy: string,
  profileLinks?: Array<{ profileId: string; permission: 'read' | 'edit' }>
) {
  const approvedUser = {
    id: userId,
    role,
    approved_at: new Date(),
    approved_by: approvedBy,
  };

  const createdLinks = profileLinks?.map(link => ({
    user_id: userId,
    profile_id: link.profileId,
    permission: link.permission,
  })) || [];

  return { user: approvedUser, profileLinks: createdLinks };
}

// Simulates user rejection
function rejectUser(userId: string, rejectedBy: string) {
  return {
    id: userId,
    role: 'rejected',
    approved_at: new Date(),
    approved_by: rejectedBy,
  };
}

describe('User Management - Property Tests', () => {
  it('Property 1: First user admin assignment', () => {
    const userArbitrary = fc.record({
      id: fc.uuid(),
      email: fc.emailAddress(),
      name: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
    });

    fc.assert(
      fc.property(userArbitrary, (user) => {
        const existingUsers: User[] = [];
        const result = assignRoleOnSignup(existingUsers, user);
        
        expect(result.role).toBe('admin');
        expect(result.approved_at).toBeTruthy();
      }),
      { numRuns: 100 }
    );
  });

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

describe('User Management - Unit Tests', () => {
  /**
   * Requirements: 2.3, 2.4, 2.7
   * Test user approval with profile links
   */
  describe('User Approval with Profile Links', () => {
    it('should approve user with admin role and no profile links', () => {
      const userId = 'user-123';
      const adminId = 'admin-456';
      
      const result = approveUser(userId, 'admin', adminId);
      
      expect(result.user.id).toBe(userId);
      expect(result.user.role).toBe('admin');
      expect(result.user.approved_by).toBe(adminId);
      expect(result.user.approved_at).toBeTruthy();
      expect(result.profileLinks).toHaveLength(0);
    });

    it('should approve user with approved role and no profile links', () => {
      const userId = 'user-123';
      const adminId = 'admin-456';
      
      const result = approveUser(userId, 'approved', adminId);
      
      expect(result.user.id).toBe(userId);
      expect(result.user.role).toBe('approved');
      expect(result.user.approved_by).toBe(adminId);
      expect(result.user.approved_at).toBeTruthy();
      expect(result.profileLinks).toHaveLength(0);
    });

    it('should approve user with single profile link with read permission', () => {
      const userId = 'user-123';
      const adminId = 'admin-456';
      const profileLinks = [
        { profileId: 'profile-1', permission: 'read' as const }
      ];
      
      const result = approveUser(userId, 'approved', adminId, profileLinks);
      
      expect(result.user.role).toBe('approved');
      expect(result.profileLinks).toHaveLength(1);
      expect(result.profileLinks[0]).toEqual({
        user_id: userId,
        profile_id: 'profile-1',
        permission: 'read',
      });
    });

    it('should approve user with single profile link with edit permission', () => {
      const userId = 'user-123';
      const adminId = 'admin-456';
      const profileLinks = [
        { profileId: 'profile-1', permission: 'edit' as const }
      ];
      
      const result = approveUser(userId, 'approved', adminId, profileLinks);
      
      expect(result.user.role).toBe('approved');
      expect(result.profileLinks).toHaveLength(1);
      expect(result.profileLinks[0]).toEqual({
        user_id: userId,
        profile_id: 'profile-1',
        permission: 'edit',
      });
    });

    it('should approve user with multiple profile links', () => {
      const userId = 'user-123';
      const adminId = 'admin-456';
      const profileLinks = [
        { profileId: 'profile-1', permission: 'read' as const },
        { profileId: 'profile-2', permission: 'edit' as const },
        { profileId: 'profile-3', permission: 'read' as const }
      ];
      
      const result = approveUser(userId, 'approved', adminId, profileLinks);
      
      expect(result.user.role).toBe('approved');
      expect(result.profileLinks).toHaveLength(3);
      expect(result.profileLinks[0]).toEqual({
        user_id: userId,
        profile_id: 'profile-1',
        permission: 'read',
      });
      expect(result.profileLinks[1]).toEqual({
        user_id: userId,
        profile_id: 'profile-2',
        permission: 'edit',
      });
      expect(result.profileLinks[2]).toEqual({
        user_id: userId,
        profile_id: 'profile-3',
        permission: 'read',
      });
    });

    it('should approve user with mixed permissions across multiple profiles', () => {
      const userId = 'user-789';
      const adminId = 'admin-456';
      const profileLinks = [
        { profileId: 'profile-a', permission: 'edit' as const },
        { profileId: 'profile-b', permission: 'edit' as const },
        { profileId: 'profile-c', permission: 'read' as const }
      ];
      
      const result = approveUser(userId, 'approved', adminId, profileLinks);
      
      expect(result.profileLinks).toHaveLength(3);
      expect(result.profileLinks.filter(l => l.permission === 'edit')).toHaveLength(2);
      expect(result.profileLinks.filter(l => l.permission === 'read')).toHaveLength(1);
    });
  });

  /**
   * Requirements: 2.3, 2.4, 2.7
   * Test user rejection
   */
  describe('User Rejection', () => {
    it('should reject user and set rejected role', () => {
      const userId = 'user-123';
      const adminId = 'admin-456';
      
      const result = rejectUser(userId, adminId);
      
      expect(result.id).toBe(userId);
      expect(result.role).toBe('rejected');
      expect(result.approved_by).toBe(adminId);
      expect(result.approved_at).toBeTruthy();
    });

    it('should reject user with different admin', () => {
      const userId = 'user-789';
      const adminId = 'admin-999';
      
      const result = rejectUser(userId, adminId);
      
      expect(result.id).toBe(userId);
      expect(result.role).toBe('rejected');
      expect(result.approved_by).toBe(adminId);
    });

    it('should set approved_at timestamp when rejecting', () => {
      const userId = 'user-123';
      const adminId = 'admin-456';
      const beforeReject = new Date();
      
      const result = rejectUser(userId, adminId);
      const afterReject = new Date();
      
      expect(result.approved_at).toBeTruthy();
      expect(result.approved_at.getTime()).toBeGreaterThanOrEqual(beforeReject.getTime());
      expect(result.approved_at.getTime()).toBeLessThanOrEqual(afterReject.getTime());
    });
  });
});
