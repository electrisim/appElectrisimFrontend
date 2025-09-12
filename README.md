# Electrisim Frontend

## About

This repository contains the frontend code for **[Electrisim](https://app.electrisim.com/)** - an open-source web-based application for comprehensive power system modeling, simulation, and analysis. Electrisim provides powerful tools for electrical engineers and power system professionals to perform:

🌐 **Online Application**: [app.electrisim.com](https://app.electrisim.com/)  
📁 **Backend Repository**: [Backend Code](https://github.com/electrisim/appElectrisimBackend)

- **Power Flow Analysis** 
- **Optimal Power Flow (OPF)** 
- **Short-Circuit Analysis** 
- **Contingency Analysis** 
- **Controller Simulation** 
- **Time Series Simulation** 

🌐 **Live Application**: [app.electrisim.com](https://app.electrisim.com/)

> **Note**: Currently optimized for desktop web browsers. No Mobile support

## Features

- **Intuitive Graphical Interface** - Drag-and-drop power system modeling
- **Industry-Standard Components** - Generators, transformers, transmission lines, loads, and more
- **Advanced Analysis Tools** - Comprehensive simulation capabilities
- **Real-time Collaboration** - Cloud-based with multi-user support
- **Export/Import** - Multiple file formats supported
- **Open Source** - Transparent and extensible codebase

## Technology Stack

- **Frontend Framework**: Custom JavaScript with mxGraph library
- **Graphics Engine**: mxGraph for diagramming capabilities
- **Build System**: Node.js with custom deployment scripts
- **Authentication**: OAuth integration
- **Cloud Storage**: Integration with Google Drive, OneDrive, Dropbox
- **Mathematical Engine**: Integration with pandapower for calculations

## Prerequisites

Before deploying Electrisim, ensure you have the following installed:

- **Node.js** (version 14.0 or higher)
- **npm** (Node Package Manager)
- **Git** (for version control)
- **Web Server** (Apache, Nginx, or similar for production deployment)

## Step-by-Step Deployment Guide

### 1. Clone the Repository

```bash
git clone <repository-url>
cd appElectrisim
```

### 2. Install Dependencies

```bash
npm install
```

This will install the required Node.js dependencies including:
- `nodemailer` for email functionality
- `cross-env` for environment variable management

### 3. Environment Configuration

#### For Development Environment:
```bash
npm run deploy:dev
```

#### For Production Environment:
```bash
npm run deploy:prod
```

The deployment script will automatically:
- Copy the appropriate route configuration (`_routes.dev.json` for dev, `_routes.json` for prod)
- Set up environment-specific settings

### 4. Web Server Setup

#### Option A: Simple Local Development Server

For quick testing, you can use any static file server:

```bash
# Using Python (if installed)
cd src/main/webapp
python -m http.server 8080

# Using Node.js serve package
npx serve src/main/webapp -p 8080
```

#### Option B: Apache Web Server

1. Copy the contents of `src/main/webapp/` to your Apache document root (e.g., `/var/www/html/` or `C:\xampp\htdocs\`)

2. Configure Apache virtual host:
```apache
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /path/to/webapp
    
    # Enable compression
    LoadModule deflate_module modules/mod_deflate.so
    <Location />
        SetOutputFilter DEFLATE
    </Location>
    
    # Set cache headers
    <FilesMatch "\.(js|css|png|jpg|gif|ico)$">
        ExpiresActive On
        ExpiresDefault "access plus 1 month"
    </FilesMatch>
</VirtualHost>
```

#### Option C: Nginx Web Server

1. Copy webapp files to Nginx document root

2. Configure Nginx:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/webapp;
    index index.html;
    
    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|gif|ico)$ {
        expires 1M;
        add_header Cache-Control "public, immutable";
    }
    
    # Handle SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 5. SSL/HTTPS Configuration (Production)

For production deployments, configure SSL:

#### Using Certbot (Let's Encrypt):
```bash
sudo certbot --nginx -d your-domain.com
```

#### Or configure SSL manually in your web server configuration.

### 6. Backend Integration

Electrisim requires a backend service for:
- User authentication
- File storage/management  
- Simulation calculations
- Real-time collaboration

Ensure your backend is deployed and update the API endpoints in:
- `src/main/webapp/js/electrisim/config/environment.js`
- Route configuration files (`_routes.json`, `_routes.dev.json`)

### 7. Testing the Deployment

1. Navigate to your deployed URL
2. Verify the application loads correctly
3. Test core functionality:
   - Creating new diagrams
   - Adding power system components
   - Running basic simulations
   - Saving/loading files

### 8. Monitoring and Maintenance

#### Enable Application Monitoring:
- Configure Smartlook analytics (already integrated)
- Set up error tracking and logging
- Monitor performance metrics

#### Regular Updates:
```bash
git pull origin main
npm install  # Install any new dependencies
npm run deploy:prod  # Rebuild for production
# Copy updated files to web server
```

## Development Setup

### For Contributors and Developers:

1. **Fork and Clone**:
```bash
git clone <your-fork-url>
cd appElectrisim
```

2. **Install Development Dependencies**:
```bash
npm install
```

3. **Run Development Server**:
```bash
npm run deploy:dev
cd src/main/webapp
python -m http.server 8000
```

4. **Development Workflow**:
   - Main application code is in `src/main/webapp/js/electrisim/`
   - Modify components and test locally
   - Use browser developer tools for debugging
   - Submit pull requests for contributions

## Configuration Files

- `package.json` - Node.js dependencies and scripts
- `_routes.dev.json` - Development environment routes
- `_routes.json` - Production environment routes  
- `src/main/webapp/js/electrisim/config/environment.js` - Environment configuration

## Troubleshooting

### Common Issues:

1. **Application won't load**:
   - Check browser console for JavaScript errors
   - Verify all static files are accessible
   - Ensure web server configuration is correct

2. **Authentication problems**:
   - Verify backend API endpoints
   - Check OAuth configuration
   - Ensure HTTPS is configured for production

3. **Performance issues**:
   - Enable gzip compression
   - Configure proper caching headers
   - Consider using a CDN for static assets

4. **Mobile compatibility**:
   - Current version is optimized for desktop browsers
   - Mobile support is under active development

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

### Development Areas:
- UI/UX improvements
- Mobile responsiveness
- New analysis features
- Performance optimizations
- Testing and documentation

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [GitHub Wiki](../../wiki)
- **Issues**: [GitHub Issues](../../issues)
- **Discussions**: [GitHub Discussions](../../discussions)
- **Stack Overflow**: Use the `electrisim` tag

## Roadmap

🚧 **Active Development Areas**:
- Extended simulation capabilities by introducing other open-source projects (currently focused on pandapower and OpenDSS)
- Advanced visualization features
- Improving performance optimization
- Integrating AI

---

**Electrisim** - Empowering electrical engineers with modern, accessible power system analysis tools.

For backend repository and API documentation, visit: [Backend Repository](../appElectrisimBackend/)