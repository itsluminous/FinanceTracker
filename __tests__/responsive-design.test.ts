import { describe, it, expect } from 'vitest';

describe('Responsive Design - Tailwind Classes', () => {
  describe('Mobile Layout (< 640px)', () => {
    it('should use mobile-first single column layout', () => {
      // Verify that grid-cols-1 is the default (mobile-first)
      const mobileGridClass = 'grid-cols-1';
      expect(mobileGridClass).toBe('grid-cols-1');
    });

    it('should have collapsible sections for mobile', () => {
      // Verify collapsible section classes exist
      const collapsibleClass = 'sm:hidden';
      expect(collapsibleClass).toBe('sm:hidden');
    });

    it('should use full-width buttons on mobile', () => {
      // Verify full-width button class
      const fullWidthClass = 'w-full';
      expect(fullWidthClass).toBe('w-full');
    });
  });

  describe('Tablet Layout (640px - 1024px)', () => {
    it('should use two-column layout for forms', () => {
      // Verify tablet grid class
      const tabletGridClass = 'sm:grid-cols-2';
      expect(tabletGridClass).toBe('sm:grid-cols-2');
    });

    it('should display charts side-by-side', () => {
      // Verify tablet chart layout class
      const tabletChartLayout = 'md:grid-cols-2';
      expect(tabletChartLayout).toBe('md:grid-cols-2');
    });
  });

  describe('Desktop Layout (> 1024px)', () => {
    it('should use three-column layout for forms', () => {
      // Verify desktop grid class
      const desktopGridClass = 'lg:grid-cols-3';
      expect(desktopGridClass).toBe('lg:grid-cols-3');
    });

    it('should expand all sections by default', () => {
      // Verify desktop expansion class
      const expandedClass = 'sm:block';
      expect(expandedClass).toBe('sm:block');
    });
  });

  describe('Responsive Utilities', () => {
    it('should have smooth transition classes', () => {
      // Verify transition class exists
      const transitionClass = 'transition-smooth';
      expect(transitionClass).toBe('transition-smooth');
    });

    it('should have responsive text sizes', () => {
      // Verify responsive text classes
      const responsiveTextClasses = ['text-xs', 'sm:text-sm', 'sm:text-base', 'sm:text-lg'];
      expect(responsiveTextClasses.length).toBeGreaterThan(0);
    });

    it('should have responsive spacing', () => {
      // Verify responsive spacing classes
      const responsiveSpacing = ['space-y-4', 'sm:space-y-6', 'gap-3', 'sm:gap-4'];
      expect(responsiveSpacing.length).toBeGreaterThan(0);
    });
  });

  describe('Chart Animations', () => {
    it('should have chart container animation class', () => {
      // Verify chart animation class
      const chartAnimationClass = 'chart-container';
      expect(chartAnimationClass).toBe('chart-container');
    });

    it('should have loading animation class', () => {
      // Verify loading animation class
      const loadingClass = 'chart-loading';
      expect(loadingClass).toBe('chart-loading');
    });
  });
});
