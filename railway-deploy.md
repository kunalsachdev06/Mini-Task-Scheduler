# Railway Deployment Instructions

## Quick Deploy to Railway

1. **Push to GitHub** (if not already done):
```bash
git add .
git commit -m "Ready for Railway deployment"
git push origin main
```

2. **Deploy to Railway**:
   - Go to [railway.app](https://railway.app)
   - Login with GitHub
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose this repository
   - Railway will automatically detect and deploy!

3. **Set Environment Variables** in Railway dashboard:
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:port/dbname  # Your PostgreSQL connection string
JWT_SECRET=your-secure-random-32-char-string
FRONTEND_URL=https://your-railway-domain.railway.app
```

4. **Generate JWT Secret**:
```bash
# On Windows (PowerShell):
[System.Web.Security.Membership]::GeneratePassword(32, 0)

# On Linux/Mac:
openssl rand -base64 32
```

## What Railway Does Automatically:

✅ Detects Node.js project  
✅ Installs dependencies  
✅ Compiles C backend  
✅ Provides HTTPS domain  
✅ Auto-restart on failure  
✅ Health checks  

## After Deployment:

Your app will be available at: `https://your-app-name.railway.app`

## Environment Variables Needed:

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@host:port/db` |
| `JWT_SECRET` | Secure random string | `abc123...` (32+ chars) |
| `FRONTEND_URL` | Your domain for CORS | `https://your-app.railway.app` |

## Optional Environment Variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `VAPID_PUBLIC_KEY` | Push notifications | Auto-generated |
| `VAPID_PRIVATE_KEY` | Push notifications | Auto-generated |
| `VAPID_EMAIL` | Your email | `your-email@domain.com` |

Railway makes deployment super easy! 🚀