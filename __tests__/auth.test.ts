import { describe, it, expect } from 'vitest';
import { signUp, signIn, signOut, getSession, getCurrentUser, getUserProfile, isAdmin } from '../lib/supabase';

describe('Authentication Functions', () => {
  describe('signUp', () => {
    it('should have correct function signature', () => {
      expect(typeof signUp).toBe('function');
      expect(signUp.length).toBe(2); // email and password parameters
    });
  });

  describe('signIn', () => {
    it('should have correct function signature', () => {
      expect(typeof signIn).toBe('function');
      expect(signIn.length).toBe(2); // email and password parameters
    });
  });

  describe('signOut', () => {
    it('should have correct function signature', () => {
      expect(typeof signOut).toBe('function');
      expect(signOut.length).toBe(0); // no parameters
    });
  });

  describe('getSession', () => {
    it('should have correct function signature', () => {
      expect(typeof getSession).toBe('function');
      expect(getSession.length).toBe(0); // no parameters
    });
  });

  describe('getCurrentUser', () => {
    it('should have correct function signature', () => {
      expect(typeof getCurrentUser).toBe('function');
      expect(getCurrentUser.length).toBe(0); // no parameters
    });
  });

  describe('getUserProfile', () => {
    it('should have correct function signature', () => {
      expect(typeof getUserProfile).toBe('function');
      expect(getUserProfile.length).toBe(1); // userId parameter
    });
  });

  describe('isAdmin', () => {
    it('should have correct function signature', () => {
      expect(typeof isAdmin).toBe('function');
      expect(isAdmin.length).toBe(1); // userId parameter
    });
  });
});
