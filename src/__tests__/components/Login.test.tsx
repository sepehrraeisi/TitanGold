import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import Login from '../../../components/Login.tsx';

vi.mock('../../../context/LanguageContext.tsx', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'en',
  }),
}));

vi.mock('../../../services/api-auth.ts', () => ({
  registerWithBackend: vi.fn(),
  getSetting: vi.fn(async () => false),
}));

describe('Login form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with empty username and password fields', () => {
    render(<Login onLogin={vi.fn()} errorKey={null} />);

    expect(screen.getByPlaceholderText('login_username')).toHaveValue('');
    expect(screen.getByPlaceholderText('login_password')).toHaveValue('');
  });

  it('shows invalid credentials message when errorKey is set', () => {
    render(<Login onLogin={vi.fn()} errorKey="invalid_credentials" />);
    expect(screen.getByText('invalid_credentials')).toBeInTheDocument();
  });
});
