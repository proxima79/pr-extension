# 🔧 Quick Setup: Teams Webhook for Smart PR Creator

## 5-Minute Setup Guide

### 1. Get Teams Webhook URL
1. Open your Teams channel
2. Click **⋯** → **Connectors**
3. Add **"Incoming Webhook"**
4. Name it **"Smart PR Creator"**
5. Copy the webhook URL

### 2. Configure in VS Code
1. Press **`Ctrl+Shift+P`**
2. Run **`Smart PR Creator: Configure Webhooks`**
3. Select **`Add New Webhook`**
4. Fill in:
   - **Name**: `Teams Notifications`
   - **URL**: Paste Teams webhook URL
   - **Events**: Select `PR Created` ✅

### 3. Test It
1. **`Ctrl+Shift+P`** → **`Smart PR Creator: Test Webhook Connection`**
2. Check Teams for test message

### 4. Create a PR
1. **`Ctrl+Shift+P`** → **`Smart PR Creator: Create Pull Request`**
2. Watch Teams for automatic notification! 🎉

---

## Example Teams Notification

```
🚀 New Pull Request Created
mycompany/project/repo

Title: Add login feature
Author: john.doe@company.com  
Branch: feature/login → main
Files Changed: 6 | Commits: 3
AI Generated: Yes (GPT-4o)

[View Pull Request] ← Click to open in Azure DevOps
```

## Troubleshooting
- **No notifications?** Check webhook URL and events selection
- **Test fails?** Verify Teams connector is still active
- **Need help?** Check VS Code Output → "Smart PR Creator - Webhooks"

---

**That's it! Your team will now get instant PR notifications in Teams.** ✨
