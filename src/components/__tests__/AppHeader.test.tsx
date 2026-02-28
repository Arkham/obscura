import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppHeader } from '../AppHeader';

describe('AppHeader', () => {
  it('renders the brand name', () => {
    render(<AppHeader />);
    expect(screen.getByText(/bscura/)).toBeInTheDocument();
  });

  it('renders children in center slot', () => {
    render(<AppHeader>Navigation</AppHeader>);
    expect(screen.getByText('Navigation')).toBeInTheDocument();
  });

  it('renders actions slot', () => {
    render(<AppHeader actions={<button>Export</button>} />);
    expect(screen.getByText('Export')).toBeInTheDocument();
  });
});
