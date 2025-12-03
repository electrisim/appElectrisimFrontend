# Deployment Guide - Environment Switching

## What Changed

Your app now automatically detects whether it's running in **development** or **production**:

- **Development**: `http://127.0.0.1:5501` → Uses VSCode dev tunnel backend
- **Production**: `https://app.electrisim.com` → Uses Railway backend

## Configuration Files Updated

### Backend (`appElectrisimBackend`)
- ✅ `app.py` - Reads PORT and CORS from environment
- ✅ `railway.toml` - Railway configuration
- ✅ `.gitignore` - Ignores temp files

### Frontend (`appElectrisim`)  
- ✅ `config/environment.js` - Environment detection
- ✅ `*.backup` files - All simulation files updated to use ENV config

## How to Deploy Changes

### Step 1: Minify Frontend Code

The `.backup` files are your source files. Run this to generate production `.js` files:

```bash
cd C:\Users\DELL\.vscode\appElectrisim\appElectrisim
npm run minify
```

This will minify all `*.backup` files into `*.js` files.

### Step 2: Commit & Push Frontend

```bash
cd C:\Users\DELL\.vscode\appElectrisim\appElectrisim
git add .
git commit -m "Add environment auto-detection for dev/prod"
git push
```

Frontend will auto-deploy from GitHub!

### Step 3: Commit & Push Backend

```bash
cd C:\Users\DELL\.vscode\appElectrisimBackend\appElectrisimBackend
git add .
git commit -m "Configure for Railway deployment with environment support"
git push
```

### Step 4: Deploy Backend to Railway

1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Select `appElectrisimBackend` repository
4. Railway will auto-detect and deploy!
5. Get your Railway URL (e.g., `https://web-production-e2ade.up.railway.app`)

### Step 5: Update Frontend Config (if Railway URL changes)

If your Railway URL is different, update `environment.js`:

```javascript
production: {
  backendUrl: 'https://YOUR-RAILWAY-URL.up.railway.app',
  // ...
}
```

Then run `npm run minify` again and push.

## Testing

### Test Development Mode
1. Open `http://127.0.0.1:5501/src/main/webapp/index.html`
2. Check browser console - should show: "Using API URL: https://03dht3kc-5000.euw.devtunnels.ms"
3. Run a simulation - should hit your dev tunnel

### Test Production Mode
1. Open `https://app.electrisim.com`
2. Check browser console - should show: "Using API URL: https://web-production-e2ade.up.railway.app"
3. Run a simulation - should hit Railway

## Environment Variables (Optional)

You can override CORS origins in Railway:

**Railway Dashboard → Your Service → Variables**:
```
CORS_ORIGINS=https://app.electrisim.com,https://www.electrisim.com
```

## Auto-Deploy Summary

✅ **Backend**: Push to GitHub → Railway auto-deploys  
✅ **Frontend**: Push to GitHub → Your frontend host auto-deploys

No manual switching needed - environment is detected automatically! 🎉

## Useful Commands

```bash
# Minify frontend code
npm run minify

# Restore from backup (if needed)
npm run minify:restore

# Clean backup files
npm run minify:clean
```

## Cost Monitoring

Railway costs ~$5/month for your backend. Monitor usage in Railway dashboard.

