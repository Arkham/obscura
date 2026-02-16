import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PanelSection } from '../PanelSection';

describe('PanelSection', () => {
  it('renders title and children', () => {
    render(
      <PanelSection title="Basic">
        <div data-testid="child">content</div>
      </PanelSection>,
    );
    expect(screen.getByText('Basic')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('collapses and expands on header click', () => {
    render(
      <PanelSection title="Basic">
        <div data-testid="child">content</div>
      </PanelSection>,
    );
    fireEvent.click(screen.getByText('Basic'));
    expect(screen.queryByTestId('child')).not.toBeVisible();
    fireEvent.click(screen.getByText('Basic'));
    expect(screen.getByTestId('child')).toBeVisible();
  });

  it('starts collapsed when defaultOpen is false', () => {
    render(
      <PanelSection title="Detail" defaultOpen={false}>
        <div data-testid="child">content</div>
      </PanelSection>,
    );
    expect(screen.queryByTestId('child')).not.toBeVisible();
  });
});
