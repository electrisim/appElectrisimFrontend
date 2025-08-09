// auth-handler.js - Handles authentication for app

import config from '../config/environment.js';

const API_BASE_URL = config.apiBaseUrl;

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            // Try to get error details from response
            let errorMessage = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData.message) {
                    errorMessage = errorData.message;
                } else if (errorData.error) {
                    errorMessage = errorData.error;
                }
            } catch (parseError) {
                // If we can't parse the error response, use status-based messages
                switch (response.status) {
                    case 409:
                        errorMessage = 'This email address is already registered. Please use a different email or try logging in.';
                        break;
                    case 400:
                        errorMessage = 'Invalid request. Please check your input and try again.';
                        break;
                    case 401:
                        errorMessage = 'Invalid email or password.';
                        break;
                    case 403:
                        errorMessage = 'Access denied.';
                        break;
                    case 500:
                        errorMessage = 'Server error. Please try again later.';
                        break;
                    default:
                        errorMessage = `Request failed with status ${response.status}`;
                }
            }
            throw new Error(errorMessage);
        }

        return await response.json();
    } catch (error) {
        console.error(`API call failed: ${endpoint}`, error);
        throw error;
    }
}

// Function to handle login
async function login(email, password) {
    try {
        const response = await apiCall('/auth/login', { 
            method: 'POST',
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        if (response.token) {
            localStorage.setItem('token', response.token);
            // Also store user data if available
            if (response.user) {
                localStorage.setItem('user', JSON.stringify(response.user));
            }
            return response;
        } else {
            throw new Error('Invalid response from server');
        }
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

// Function to handle registration
async function register(email, password, name) {
    try {
        const data = await apiCall('/auth/register', {  // Changed from '/routes/register'
            method: 'POST',
            body: JSON.stringify({ email, password, name })
        });

        if (data.token) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            document.dispatchEvent(new CustomEvent('userLoggedIn', { 
                detail: { user: data.user } 
            }));
            
            return data;
        } else {
            throw new Error('Invalid response from server');
        }
    } catch (error) {
        // If the error message is already user-friendly, don't add prefix
        if (error.message.includes('email address is already registered') || 
            error.message.includes('Invalid request') ||
            error.message.includes('Server error')) {
            throw error;
        } else {
            throw new Error('Registration failed: ' + error.message);
        }
    }
}

// Function to handle logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    document.dispatchEvent(new CustomEvent('userLoggedOut'));
}

// Function to check if user is authenticated
const isAuthenticated = () => {
    return !!localStorage.getItem('token');
};

// Function to get current user
function getCurrentUser() { 
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

// Function to get auth token
function getAuthToken() {
    return localStorage.getItem('token');
}

// Create a simple login form with improved error handling
function createLoginForm(container) {
    const form = document.createElement('form');
    form.className = 'login-form';
    form.innerHTML = `
        <h2>Login</h2>
        <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" required>
        </div>
        <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required>
        </div>
        <button type="submit" class="submit-btn">Login</button>
        <p style="text-align:center; margin-top:10px;">
          <a href="/src/main/webapp/forgot-password.html">Forgot Password?</a>
        </p>
        <div class="divider">or</div>
        <button type="button" class="google-btn">
            <img src="https://www.google.com/favicon.ico" alt="Google" />
            Sign in with Google
        </button>
        <button type="button" class="linkedin-btn">
            <img src="https://content.linkedin.com/content/dam/me/business/en-us/amp/brand-site/v2/bg/LI-Bug.svg.original.svg" alt="LinkedIn" />
            Sign in with LinkedIn
        </button>
        <button type="button" class="microsoft-btn">
            <img src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" alt="Microsoft" />
            Sign in with Microsoft
        </button>
        <p>Don't have an account? <a href="#" id="register-link">Register</a></p>
        <div id="login-error" class="error-message"></div>
    `;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('.submit-btn');
        const errorElement = form.querySelector('#login-error');
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';
        errorElement.textContent = '';
        
        try {
            const email = form.querySelector('#email').value;
            const password = form.querySelector('#password').value;
            const response = await login(email, password);
            
            // Dispatch auth state change event
            document.dispatchEvent(new CustomEvent('authStateChanged', {
                detail: {
                    isAuthenticated: true,
                    user: response.user
                }
            }));
            
            const baseUrl = config.isDevelopment 
                ? '/src/main/webapp/index.html'
                : '/index.html';
            window.location.href = baseUrl;
        } catch (error) {
            errorElement.textContent = error.message;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    });

    // Handle Google login
    form.querySelector('.google-btn').addEventListener('click', () => {
        // Use Railway backend URL directly for OAuth
        const backendUrl = config.isDevelopment
            ? 'http://localhost:5502'
            : 'https://customers-production-16f8.up.railway.app';
        window.location.href = `${backendUrl}/api/auth/google`;
    });

    // Handle LinkedIn login
    form.querySelector('.linkedin-btn').addEventListener('click', () => {
        console.log('LinkedIn button clicked!');
        // Use Railway backend URL directly for OAuth
        const backendUrl = config.isDevelopment
            ? 'http://localhost:5502'
            : 'https://customers-production-16f8.up.railway.app';
        const linkedinUrl = `${backendUrl}/api/auth/linkedin`;
        console.log('Redirecting to:', linkedinUrl);
        window.location.href = linkedinUrl;
    });

    // Handle Microsoft login
    form.querySelector('.microsoft-btn').addEventListener('click', () => {
        console.log('Microsoft button clicked!');
        // Use Railway backend URL directly for OAuth
        const backendUrl = config.isDevelopment
            ? 'http://localhost:5502'
            : 'https://customers-production-16f8.up.railway.app';
        const microsoftUrl = `${backendUrl}/api/auth/microsoft`;
        console.log('Redirecting to:', microsoftUrl);
        window.location.href = microsoftUrl;
    });
    
    container.innerHTML = '';
    container.appendChild(form);
    
    form.querySelector('#register-link').addEventListener('click', (e) => {
        e.preventDefault();
        createRegisterForm(container);
    });
}

// Create a simple registration form
function createRegisterForm(container) {
    const form = document.createElement('form');
    form.className = 'register-form';
    form.innerHTML = `
        <h2>Register</h2>
        <div class="form-group">
            <label for="name">Name</label>
            <input type="text" id="name" name="name" required>
        </div>
        <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" required>
        </div>
        <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required>
        </div>
        <button type="submit">Register</button>
        <div class="divider">or</div>
        <button type="button" class="google-btn">
            <img src="https://www.google.com/favicon.ico" alt="Google" />
            Sign up with Google
        </button>
        <button type="button" class="linkedin-btn">
            <img src="https://content.linkedin.com/content/dam/me/business/en-us/amp/brand-site/v2/bg/LI-Bug.svg.original.svg" alt="LinkedIn" />
            Sign up with LinkedIn
        </button>
        <button type="button" class="microsoft-btn">
            <img src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" alt="Microsoft" />
            Sign up with Microsoft
        </button>
        <p>Already have an account? <a href="#" id="login-link">Login</a></p>
        <div id="register-error" class="error-message"></div>
    `;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = form.querySelector('#name').value;
        const email = form.querySelector('#email').value;
        const password = form.querySelector('#password').value;
        
        try {
            const response = await register(email, password, name);
            
            // Dispatch auth state change event
            document.dispatchEvent(new CustomEvent('authStateChanged', {
                detail: {
                    isAuthenticated: true,
                    user: response.user
                }
            }));
            
            window.location.reload(); // Reload page after successful registration
        } catch (error) {
            const errorElement = form.querySelector('#register-error');
            errorElement.textContent = error.message;
        }
    });

    // Handle Google login
    form.querySelector('.google-btn').addEventListener('click', () => {
        // Use Railway backend URL directly for OAuth
        const backendUrl = config.isDevelopment
            ? 'http://localhost:5502'
            : 'https://customers-production-16f8.up.railway.app';
        window.location.href = `${backendUrl}/api/auth/google`;
    });

    // Handle LinkedIn login
    form.querySelector('.linkedin-btn').addEventListener('click', () => {
        console.log('LinkedIn button clicked!');
        // Use Railway backend URL directly for OAuth
        const backendUrl = config.isDevelopment
            ? 'http://localhost:5502'
            : 'https://customers-production-16f8.up.railway.app';
        const linkedinUrl = `${backendUrl}/api/auth/linkedin`;
        console.log('Redirecting to:', linkedinUrl);
        window.location.href = linkedinUrl;
    });

    // Handle Microsoft login
    form.querySelector('.microsoft-btn').addEventListener('click', () => {
        console.log('Microsoft button clicked!');
        // Use Railway backend URL directly for OAuth
        const backendUrl = config.isDevelopment
            ? 'http://localhost:5502'
            : 'https://customers-production-16f8.up.railway.app';
        const microsoftUrl = `${backendUrl}/api/auth/microsoft`;
        console.log('Redirecting to:', microsoftUrl);
        window.location.href = microsoftUrl;
    });
    
    container.innerHTML = '';
    container.appendChild(form);
    
    // Handle login link click
    form.querySelector('#login-link').addEventListener('click', (e) => {
        e.preventDefault();
        createLoginForm(container);
    });
}

// Function to handle successful authentication
function handleSuccessfulAuth(userData) {
    // Store auth data
    localStorage.setItem('token', userData.token);
    if (userData.user) {
        localStorage.setItem('user', JSON.stringify(userData.user));
    }
    
    // Get base URL from config
    const baseUrl = config.isDevelopment 
        ? '/src/main/webapp/index.html'  // Development path
        : '/index.html';                 // Production path
    
    // Redirect to main application
    window.location.href = baseUrl;
}

// Create the authHandler object first
const authHandler = {
    login,
    register,
    logout,
    isAuthenticated,
    getCurrentUser,
    getAuthToken,
    createLoginForm,
    createRegisterForm,
    handleSuccessfulAuth
};

// Make functions available globally BEFORE exports
window.isAuthenticated = isAuthenticated;
window.authHandler = authHandler;
window.getCurrentUser = getCurrentUser;  // Make getCurrentUser globally available

// Add fallback functions for app.min.js compatibility
if (!window.isAuthenticated) {
    window.isAuthenticated = () => {
        return !!localStorage.getItem('token');
    };
}

if (!window.getCurrentUser) {
    window.getCurrentUser = () => {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    };
}

// Dispatch events when auth state changes
function dispatchAuthStateChange() {
    document.dispatchEvent(new CustomEvent('authStateChanged', {
        detail: {
            isAuthenticated: isAuthenticated(),
            user: getCurrentUser()
        }
    }));
}

// Override the original functions to dispatch events
const originalIsAuthenticated = isAuthenticated;
window.isAuthenticated = () => {
    const result = originalIsAuthenticated();
    // Dispatch event when called
    setTimeout(dispatchAuthStateChange, 0);
    return result;
};

// Override logout to dispatch event
const originalLogout = logout;
window.logout = () => {
    originalLogout();
    dispatchAuthStateChange();
};

// Add debug function to check user data
function debugUserData() {
    console.log('=== Debug User Data ===');
    console.log('localStorage user:', localStorage.getItem('user'));
    console.log('localStorage token:', localStorage.getItem('token'));
    
    try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            console.log('Parsed user object:', user);
            console.log('User email:', user ? user.email : 'No email');
            console.log('User name:', user ? user.name : 'No name');
            console.log('User ID:', user ? user.id : 'No ID');
        } else {
            console.log('❌ No user data found in localStorage');
        }
    } catch (error) {
        console.error('Error parsing user data:', error);
    }
    
    console.log('getCurrentUser function available:', typeof getCurrentUser === 'function');
    console.log('window.getCurrentUser available:', typeof window.getCurrentUser === 'function');
    console.log('window.authHandler available:', !!window.authHandler);
    
    // Test the getUserEmail function
    console.log('--- Testing getUserEmail function ---');
    try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            if (user && user.email) {
                console.log('✅ getUserEmail would return:', user.email);
            } else {
                console.log('❌ User object has no email property');
            }
        } else {
            console.log('❌ No user data in localStorage');
        }
    } catch (error) {
        console.error('❌ Error testing getUserEmail:', error);
    }
    
    console.log('========================');
}

window.debugUserData = debugUserData;  // Make debug function globally available

// Export all functions
export { authHandler };

// Also export individual functions for direct import
export {
    login,
    register,
    logout,
    isAuthenticated,
    getCurrentUser,
    getAuthToken,
    createLoginForm,
    createRegisterForm,
    handleSuccessfulAuth
};