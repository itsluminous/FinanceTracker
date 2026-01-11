/**
 * Unit tests for loading skeleton components
 * Tests rendering of various skeleton states
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  ProfileSelectorSkeleton,
  FinancialEntryFormSkeleton,
  ChartSkeleton,
  AdminPanelSkeleton,
  TableSkeleton,
  CardGridSkeleton,
  PageLoadingSkeleton,
} from '@/components/loading-skeletons';

describe('Loading Skeleton Components', () => {
  it('should render ProfileSelectorSkeleton', () => {
    const { container } = render(<ProfileSelectorSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it('should render FinancialEntryFormSkeleton', () => {
    const { container } = render(<FinancialEntryFormSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it('should render ChartSkeleton', () => {
    const { container } = render(<ChartSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it('should render AdminPanelSkeleton', () => {
    const { container } = render(<AdminPanelSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it('should render TableSkeleton with default rows', () => {
    const { container } = render(<TableSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it('should render TableSkeleton with custom rows', () => {
    const { container } = render(<TableSkeleton rows={10} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('should render CardGridSkeleton with default count', () => {
    const { container } = render(<CardGridSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it('should render CardGridSkeleton with custom count', () => {
    const { container } = render(<CardGridSkeleton count={6} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('should render PageLoadingSkeleton with spinner', () => {
    const { getByText } = render(<PageLoadingSkeleton />);
    expect(getByText('Loading...')).toBeInTheDocument();
  });
});
