import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from '../../App';
import axios from 'axios';
import { AuthProvider } from '../../contexts/AuthContext';

// Jest globals
import '@testing-library/jest-dom';

jest.mock('axios');

// Test wrapper with providers
const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {ui}
      </AuthProvider>
    </BrowserRouter>
  );
};

const mockCategories = [
  { id: 'cat1', name: 'Work' },
  { id: 'cat2', name: 'Personal' }
];
const mockEmails = {
  emails: [
    { id: 'email1', subject: 'Hello', fromEmail: 'a@b.com', toEmail: 'b@a.com', aiSummary: 'Summary', archived: false, unsubscribeLinks: [], createdAt: new Date().toISOString() }
  ],
  total: 1,
  page: 1,
  pageSize: 20
};

describe('Email category flow', () => {
  let categories = [...mockCategories];
  
  beforeEach(() => {
    categories = [...mockCategories]; // Reset categories for each test
    
    (axios.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: { user: { email: 'test@example.com' } } });
      if (url.includes('/api/categories') && !url.includes('/emails')) return Promise.resolve({ data: [...categories] });
      // Match emails endpoint with query parameters (e.g., ?page=1&pageSize=20)
      if (url.includes('/api/categories/cat1/emails')) return Promise.resolve({ data: mockEmails });
      return Promise.resolve({ data: [] });
    });
    (axios.post as jest.Mock).mockImplementation((url: string, body: any) => {
      if (url.includes('/api/categories') && !url.includes('/emails')) {
        const newCat = { ...body, id: 'cat3' };
        categories.push(newCat);
        return Promise.resolve({ data: newCat });
      }
      if (url.includes('/api/emails/email1/unsubscribe')) return Promise.resolve({ data: { skipped: true } });
      if (url.includes('/api/emails/delete')) return Promise.resolve({ data: { message: 'Emails deleted successfully' } });
      return Promise.resolve({ data: {} });
    });
    (axios.delete as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/categories/cat1')) {
        categories = categories.filter(c => c.id !== 'cat1');
        return Promise.resolve({ data: { message: 'Category deleted successfully' } });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it('shows categories and emails after adding', async () => {
    renderWithProviders(<App />);
    // Wait for auth loading to complete and categories to appear in sidebar
    await waitFor(() => {
      const menuItems = screen.getAllByRole('menuitem');
      const workItem = menuItems.find(item => item.textContent?.includes('Work'));
      expect(workItem).toBeInTheDocument();
    });
    // Click on Work category in sidebar
    const menuItems = screen.getAllByRole('menuitem');
    const workMenuItem = menuItems.find(item => item.textContent?.includes('Work') && !item.textContent?.includes('Settings'));
    fireEvent.click(workMenuItem!);
    await waitFor(() => expect(screen.getByText('Hello')).toBeInTheDocument());
    expect(screen.getByText(/Work Emails/)).toBeInTheDocument();
  });

  it('adds a category and updates sidebar', async () => {
    renderWithProviders(<App />);
    // Wait for loading to complete and settings page to render
    await waitFor(() => expect(screen.getByText('Add New Category')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Add New Category'));
    fireEvent.change(screen.getByPlaceholderText(/e.g., Work/), { target: { value: 'NewCat' } });
    fireEvent.change(screen.getByPlaceholderText(/Describe/), { target: { value: 'desc' } });
    fireEvent.click(screen.getByText('OK'));
    await waitFor(() => {
      const menuItems = screen.getAllByRole('menuitem');
      const newCatItem = menuItems.find(item => item.textContent?.includes('NewCat'));
      expect(newCatItem).toBeInTheDocument();
    });
  });

  it('deletes a category and updates sidebar', async () => {
    renderWithProviders(<App />);
    // Wait for settings page to load with categories
    await waitFor(() => expect(screen.getAllByText('Delete').length).toBeGreaterThan(0));
    // Click first delete button
    fireEvent.click(screen.getAllByText('Delete')[0]);
    // Check that Work category is removed from sidebar
    await waitFor(() => {
      const menuItems = screen.getAllByRole('menuitem');
      const workItem = menuItems.find(item => item.textContent === 'Work');
      expect(workItem).toBeUndefined();
    });
  });

  it('shows skipped unsubscribe status', async () => {
    renderWithProviders(<App />);
    // Wait for categories to load
    await waitFor(() => {
      const menuItems = screen.getAllByRole('menuitem');
      const workItem = menuItems.find(item => item.textContent?.includes('Work'));
      expect(workItem).toBeInTheDocument();
    });
    
    // Click Work category in sidebar
    const menuItems = screen.getAllByRole('menuitem');
    const workMenuItem = menuItems.find(item => item.textContent?.includes('Work') && !item.textContent?.includes('Settings'));
    fireEvent.click(workMenuItem!);
    
    // Wait for emails to load
    await waitFor(() => expect(screen.getByText('Hello')).toBeInTheDocument());
    
    // Select the email by clicking its checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // Click first checkbox to select the email
    
    fireEvent.click(screen.getByText('Unsubscribe Selected'));
    await waitFor(() => expect(screen.getAllByText(/no unsubscribe links/i)[0]).toBeInTheDocument());
  });

  it('shows paginated emails', async () => {
    (axios.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve({ data: { user: { email: 'test@example.com' } } });
      if (url.includes('/api/categories') && !url.includes('/emails')) return Promise.resolve({ data: mockCategories });
      if (url.includes('/api/categories/cat1/emails')) return Promise.resolve({ data: { ...mockEmails, total: 40, pageSize: 20 } });
      return Promise.resolve({ data: [] });
    });
    renderWithProviders(<App />);
    
    // Wait for categories to load
    await waitFor(() => {
      const menuItems = screen.getAllByRole('menuitem');
      const workItem = menuItems.find(item => item.textContent?.includes('Work'));
      expect(workItem).toBeInTheDocument();
    });
    
    // Click Work category in sidebar
    const menuItems = screen.getAllByRole('menuitem');
    const workMenuItem = menuItems.find(item => item.textContent?.includes('Work') && !item.textContent?.includes('Settings'));
    fireEvent.click(workMenuItem!);
    
    // Wait for emails to load
    await waitFor(() => expect(screen.getByText('Hello')).toBeInTheDocument());
    expect(screen.getByText('1')).toBeInTheDocument(); // page number
  });
});
