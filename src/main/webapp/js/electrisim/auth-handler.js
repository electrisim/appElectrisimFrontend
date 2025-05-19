// auth-handler.js - Handles authentication for your app

// Base URL for API calls
const API_BASE_URL = 'https://customers-production-16f8.up.railway.app/api';

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
    const defaultOptions = {
        mode: 'cors',
        cache: 'no-cache',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
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
        throw new Error('Registration failed: ' + error.message);
    }
}

// Function to handle logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    document.dispatchEvent(new CustomEvent('userLoggedOut'));
}

// Function to check if user is authenticated
function isAuthenticated() {
    return !!localStorage.getItem('token');
}

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
            await login(email, password);
            window.location.href = '/index.html';
        } catch (error) {
            errorElement.textContent = error.message;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
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
        <p>Already have an account? <a href="#" id="login-link">Login</a></p>
        <div id="register-error" class="error-message"></div>
    `;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = form.querySelector('#name').value;
        const email = form.querySelector('#email').value;
        const password = form.querySelector('#password').value;
        
        try {
            await register(email, password, name);
            window.location.reload(); // Reload page after successful registration
        } catch (error) {
            const errorElement = form.querySelector('#register-error');
            errorElement.textContent = error.message;
        }
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
    
    // Redirect to main application
    window.location.href = '/src/main/webapp/index.html'; //CHANGE IN PRODUCTION
}

// Make functions available globally
window.authHandler = {
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