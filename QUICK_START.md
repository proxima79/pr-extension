# ⚡ Quick Start Guide - Smart PR Creator

## 🚀 5-Minute Setup

### 1. Prerequisites
```bash
# Install Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Add DevOps extension
az extension add --name azure-devops

# Login and configure
az login
az devops configure --defaults organization=https://dev.azure.com/YourOrg project=YourProject
```

### 2. Create Your First PR
1. **Make changes** to your code and commit them
2. **Open Command Palette**: `Ctrl+Shift+P`
3. **Run**: `Smart PR Creator: Create PR with AI Description`
4. **Follow the wizard** - it's fully guided!

### 3. Optional: Teams Notifications
1. **Teams Channel** → **⋯** → **Connectors** → **Incoming Webhook**
2. **Copy webhook URL**
3. **VS Code**: `Ctrl+Shift+P` → `Smart PR Creator: Configure Webhooks`
4. **Add webhook** with your Teams URL

## 🎯 Key Commands

- `Smart PR Creator: Create PR with AI Description` - Main command
- `Smart PR Creator: Check Azure CLI Status` - Verify setup
- `Smart PR Creator: Configure Webhooks` - Setup Teams notifications

## 🛠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| "Azure CLI not found" | Install Azure CLI (see step 1) |
| "Not authenticated" | Run `az login` |
| "Repository not Azure DevOps" | Check `git remote -v` |
| "No AI models" | Install GitHub Copilot extension |

## 📚 Need More Help?

- **Full Guide**: See `USER_GUIDE.md`
- **Status Check**: Use `Smart PR Creator: Check Azure CLI Status`
- **Logs**: View → Output → "Smart PR Creator"

---

**Start creating AI-powered PRs in minutes!** 🎉
