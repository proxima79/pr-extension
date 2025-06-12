# 📖 Smart PR Creator - Complete User Guide

## 🚀 Quick Start

### Installation

1. **Install the extension** from VS Code Marketplace or install the `.vsix` file
2. **Restart VS Code**
3. **Verify installation**: Open Command Palette (`Ctrl+Shift+P`) and type "Smart PR Creator"

### Prerequisites

- **Azure CLI** installed and configured
- **Azure DevOps Extension** for Azure CLI: `az extension add --name azure-devops`
- **Authentication**: `az login` and configure your organization/project
- **Git repository** connected to Azure DevOps

### First PR

1. **Make changes** to your code and commit them
2. **Open Command Palette** (`Ctrl+Shift+P`)
3. **Run**: `Smart PR Creator: Create PR with AI Description`
4. **Follow the guided workflow** and create your first AI-powered PR!

---

## 🎯 Features

### Core Functionality
- ✅ **AI-Powered Descriptions** using GitHub Copilot and multiple AI models
- ✅ **Azure DevOps Integration** via Azure CLI
- ✅ **Smart Branch Analysis** with automatic target branch detection
- ✅ **Work Item Linking** from commit messages
- ✅ **Reviewer Management** with organization user lookup

### Team Collaboration
- ✅ **Webhook Notifications** for Teams, Slack, Discord
- ✅ **Rich Message Cards** with PR details and action buttons
- ✅ **Analytics & History** tracking for webhook success rates
- ✅ **Multi-Platform Support** with customizable payloads

### AI Models Supported
- **GitHub Copilot** (primary)
- **GPT-4o** (OpenAI)
- **Claude Sonnet** (Anthropic)
- **O1-Mini** (OpenAI)
- **Auto-selection** based on availability

---

## ⚙️ Configuration

### Azure CLI Setup

Check your Azure CLI status:
```bash
az --version
az extension list | grep azure-devops
az account show
```

Configure defaults:
```bash
az devops configure --defaults organization=https://dev.azure.com/YourOrg project=YourProject
```

### VS Code Settings

Add to your `settings.json`:

```json
{
  "smartPrCreator.aiModel": "copilot",
  "smartPrCreator.defaultTargetBranch": "main",
  "smartPrCreator.autoLinkWorkItems": true,
  "smartPrCreator.webhooks": {
    "enabled": true,
    "endpoints": [
      {
        "name": "Teams Notifications",
        "url": "https://outlook.office.com/webhook/YOUR_WEBHOOK_URL",
        "events": ["pr_created", "pr_merged"],
        "platform": "teams"
      }
    ]
  }
}
```

---

## 🔗 Webhook Setup (Teams Integration)

### Step 1: Create Teams Webhook

1. **Open Teams channel** where you want notifications
2. **Click ⋯** → **Connectors** → **Incoming Webhook**
3. **Configure webhook**:
   - Name: "Smart PR Creator"
   - Upload icon (optional)
   - **Copy the webhook URL**

### Step 2: Configure in VS Code

**Option A: Command Palette (Recommended)**
1. `Ctrl+Shift+P` → `Smart PR Creator: Configure Webhooks`
2. Choose `Add New Webhook`
3. Enter details:
   - **Name**: `Teams PR Notifications`
   - **URL**: Paste webhook URL
   - **Events**: Select `PR Created` ✅

**Option B: Settings File**
```json
{
  "smartPrCreator.webhooks": {
    "enabled": true,
    "endpoints": [
      {
        "name": "Teams PR Notifications",
        "url": "https://outlook.office.com/webhook/YOUR_WEBHOOK_URL",
        "events": ["pr_created", "pr_merged"],
        "platform": "teams"
      }
    ]
  }
}
```

### Step 3: Test Integration

1. `Ctrl+Shift+P` → `Smart PR Creator: Test Webhook Connection`
2. Select your Teams webhook
3. Check Teams for test message

### Teams Message Format

```
🚀 New Pull Request Created
myorg/project/repo

Title: Add authentication feature
Author: john.doe@company.com
Branch: feature/auth → main
Files Changed: 8 | Commits: 4
AI Generated: Yes (GPT-4o)

[View Pull Request] ← Clickable link
```

---

## 🎮 Available Commands

| Command | Description |
|---------|-------------|
| `Smart PR Creator: Create Pull Request` | Basic PR creation |
| `Smart PR Creator: Create PR with AI Description` | AI-enhanced PR creation |
| `Smart PR Creator: Analyze Current Branch` | Branch analysis and insights |
| `Smart PR Creator: Check Azure CLI Status` | Verify Azure setup |
| `Smart PR Creator: List Available AI Models` | Browse AI models |
| `Smart PR Creator: Select AI Model` | Change AI model |
| `Smart PR Creator: Configure Webhooks` | Setup team notifications |
| `Smart PR Creator: Test Webhook Connection` | Validate webhooks |
| `Smart PR Creator: View Webhook History` | Monitor webhook activity |

---

## 🔧 Troubleshooting

### Common Issues

#### "Azure CLI not found"
```bash
# Install Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Add DevOps extension
az extension add --name azure-devops
```

#### "Not authenticated"
```bash
# Login and configure
az login
az devops configure --defaults organization=https://dev.azure.com/YourOrg
```

#### "No AI models available"
- Ensure GitHub Copilot extension is installed
- Check VS Code version compatibility (1.100.0+)
- Try restarting VS Code

#### "Webhook test failed"
- Verify webhook URL is correct
- Check Teams channel permissions
- Ensure webhook is still active in Teams

#### "Repository not found"
- Ensure you're in an Azure DevOps Git repository
- Check remote URLs: `git remote -v`
- Verify organization/project access

### Debug Steps

1. **Check Status**: Use `Smart PR Creator: Check Azure CLI Status`
2. **View Logs**: Open Output panel → "Smart PR Creator"
3. **Test Components**:
   - Test webhook connections
   - Check AI model availability
   - Verify Azure CLI authentication

---

## 💡 Best Practices

### For Better AI Descriptions
- **Write clear commit messages** - AI uses these as context
- **Keep commits focused** - One feature/fix per commit
- **Use conventional commit format**: `feat: add user authentication`

### For Team Workflows
- **Configure webhooks** for key events (pr_created, pr_merged)
- **Set up multiple channels** for different teams/purposes
- **Monitor webhook history** to track engagement

### For Large Teams
- **Standardize AI models** across the team
- **Create team-specific webhook configurations**
- **Use work item linking** for better traceability

---

## 🔐 Security & Privacy

- **API Keys**: Stored securely in VS Code's credential storage
- **No Data Sharing**: Only local git data is processed
- **Webhook Security**: Support for secrets and custom headers
- **Azure Authentication**: Uses your existing Azure CLI credentials

---

## 🆘 Support

### Get Help
- **Documentation**: Check this guide and README
- **GitHub Issues**: Report bugs and feature requests
- **VS Code Output**: Check "Smart PR Creator" for detailed logs

### Useful Links
- **Azure CLI Docs**: [Microsoft Docs](https://docs.microsoft.com/cli/azure/)
- **GitHub Copilot**: [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot)
- **Teams Webhooks**: [Microsoft Teams Developer Docs](https://docs.microsoft.com/microsoftteams/platform/webhooks-and-connectors/)

---

## 📊 Analytics & Monitoring

### Webhook Analytics
- Track success rates and response times
- Monitor failed deliveries
- View popular events and usage patterns

### Performance Insights
- AI model response times
- Branch analysis duration
- PR creation success rates

Use `Smart PR Creator: View Webhook History` to access analytics.

---

**Ready to streamline your PR workflow with AI-powered descriptions and team notifications!** 🚀
