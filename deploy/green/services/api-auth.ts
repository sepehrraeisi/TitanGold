// Backend API Configuration
// Use relative path to leverage Nginx proxy and avoid Mixed Content errors
const BACKEND_API_URL = '/api';

export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  role: 'Admin' | 'Trader' | 'Viewer';
}

/**
 * Login user using real backend API
 */
export const loginWithBackend = async (username: string, password: string): Promise<User | null> => {
  try {
    console.log('🔐 Login attempt:', { username, passLength: password.length });
    
    // Call real backend API
    const response = await fetch(`${BACKEND_API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        username: username.trim(), 
        password: password 
      }),
    });

    console.log('📡 Backend response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Login failed:', errorData);
      return null;
    }

    const data = await response.json();
    console.log('✅ Login successful:', data);

    // Extract user data from backend response
    const backendUser = data.user;
    const token = data.token;

    // Map backend role to frontend role
    const roleMap: { [key: string]: 'Admin' | 'Trader' | 'Viewer' } = {
      'admin': 'Admin',
      'trader': 'Trader',
      'user': 'Trader',
      'viewer': 'Viewer',
    };

    const userToStore: User = {
      id: backendUser.id,
      name: backendUser.full_name || backendUser.username,
      email: backendUser.email,
      username: backendUser.username,
      role: roleMap[backendUser.role] || 'Viewer',
    };

    // Store token and user in sessionStorage and localStorage
    sessionStorage.setItem('titan_token', token);
    sessionStorage.setItem('titan_user', JSON.stringify(userToStore));
    localStorage.setItem('titan_token', token);
    localStorage.setItem('titan_user', JSON.stringify(userToStore));

    console.log('💾 User and token stored:', userToStore);

    return userToStore;
  } catch (error) {
    console.error('💥 Login error:', error);
    return null;
  }
};

/**
 * Register new user using real backend API
 */
export const registerWithBackend = async (
  email: string,
  username: string,
  password: string,
  full_name: string
): Promise<User | null> => {
  try {
    console.log('📝 Register attempt:', { email, username, full_name });
    
    const response = await fetch(`${BACKEND_API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        email: email.trim(),
        username: username.trim(),
        password: password,
        full_name: full_name.trim(),
      }),
    });

    console.log('📡 Backend response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Registration failed:', errorData);
      return null;
    }

    const data = await response.json();
    console.log('✅ Registration successful:', data);

    // Extract user data from backend response
    const backendUser = data.user;
    const token = data.token;

    // Map backend role to frontend role
    const roleMap: { [key: string]: 'Admin' | 'Trader' | 'Viewer' } = {
      'admin': 'Admin',
      'trader': 'Trader',
      'user': 'Trader',
      'viewer': 'Viewer',
    };

    const userToStore: User = {
      id: backendUser.id,
      name: backendUser.full_name || backendUser.username,
      email: backendUser.email,
      username: backendUser.username,
      role: roleMap[backendUser.role] || 'Viewer',
    };

    // Store token and user in sessionStorage and localStorage
    sessionStorage.setItem('titan_token', token);
    sessionStorage.setItem('titan_user', JSON.stringify(userToStore));
    localStorage.setItem('titan_token', token);
    localStorage.setItem('titan_user', JSON.stringify(userToStore));

    console.log('💾 User and token stored:', userToStore);

    return userToStore;
  } catch (error) {
    console.error('💥 Registration error:', error);
    return null;
  }
};

/**
 * Check session from localStorage/sessionStorage
 */
export const checkSessionStorage = (): Promise<User | null> => {
  return new Promise(resolve => {
    setTimeout(() => {
      const sessionUser = sessionStorage.getItem('titan_user');
      if (sessionUser) {
        try {
          const user = JSON.parse(sessionUser);
          resolve(user);
        } catch {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    }, 300);
  });
};

/**
 * Logout user and clear session
 */
export const logoutUser = (): void => {
  sessionStorage.removeItem('titan_token');
  sessionStorage.removeItem('titan_user');
  localStorage.removeItem('titan_token');
  localStorage.removeItem('titan_user');
};

/**
 * Get stored authentication token
 */
export const getAuthToken = (): string | null => {
  return sessionStorage.getItem('titan_token') || localStorage.getItem('titan_token');
};

/**
 * Make authenticated API request
 */
export const authenticatedFetch = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(`${BACKEND_API_URL}${endpoint}`, {
    ...options,
    headers,
  });
};

/**
 * Fetch all users from backend (Admin only)
 */
export const fetchAllUsers = async (): Promise<any[]> => {
  try {
    const response = await authenticatedFetch('/users');
    
    if (!response.ok) {
      console.error('❌ Failed to fetch users:', response.status);
      return [];
    }

    const data = await response.json();
    console.log('✅ Fetched users:', data);
    
    return data.users || [];
  } catch (error) {
    console.error('💥 Error fetching users:', error);
    return [];
  }
};

/**
 * Get system settings (public endpoint)
 */
export const getSystemSettings = async (): Promise<any> => {
  try {
    const response = await fetch(`${BACKEND_API_URL}/settings`);
    
    if (!response.ok) {
      console.error('❌ Failed to fetch settings:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('✅ Fetched settings:', data);
    
    return data.settings || {};
  } catch (error) {
    console.error('💥 Error fetching settings:', error);
    return null;
  }
};

/**
 * Get a specific setting value
 */
export const getSetting = async (key: string): Promise<any> => {
  try {
    const response = await fetch(`${BACKEND_API_URL}/settings/${key}`);
    
    if (!response.ok) {
      console.error(`❌ Failed to fetch setting ${key}:`, response.status);
      return null;
    }

    const data = await response.json();
    console.log(`✅ Fetched setting ${key}:`, data.value);
    
    return data.value;
  } catch (error) {
    console.error(`💥 Error fetching setting ${key}:`, error);
    return null;
  }
};

/**
 * Update a setting (Admin only)
 */
export const updateSetting = async (key: string, value: any, description?: string): Promise<boolean> => {
  try {
    const response = await authenticatedFetch(`/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value, description }),
    });
    
    if (!response.ok) {
      console.error(`❌ Failed to update setting ${key}:`, response.status);
      return false;
    }

    const data = await response.json();
    console.log(`✅ Updated setting ${key}:`, data);
    
    return true;
  } catch (error) {
    console.error(`💥 Error updating setting ${key}:`, error);
    return false;
  }
};
