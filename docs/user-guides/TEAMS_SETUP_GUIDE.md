# 🚀 Microsoft Teams Integration Guide - Smart PR Creator

## Overview

The Smart PR Creator extension can send automatic notifications to Microsoft Teams channels when pull requests are created. This guide shows you how to set up and use this integration.

## 📋 Prerequisites

- Microsoft Teams access with permission to add connectors to channels
- Smart PR Creator VS Code extension installed
- Access to an Azure DevOps repository

## 🔧 Step 1: Create a Teams Incoming Webhook

### Method 1: Using Teams Desktop/Web App

1. **Open your Teams channel** where you want PR notifications
2. **Click the three dots (⋯)** next to the channel name
3. **Select "Connectors"** from the dropdown menu
4. **Find "Incoming Webhook"** in the connector list
5. **Click "Add"** then **"Configure"**
6. **Provide a name** (e.g., "Smart PR Creator Notifications")
7. **Upload an icon** (optional) or use the default
8. **Click "Create"**
9. **Copy the webhook URL** - you'll need this for VS Code configuration

### Method 2: Using Teams Admin Center (for admins)

1. Go to **Teams Admin Center** → **Teams apps** → **Manage apps**
2. Search for **"Incoming Webhook"**
3. Configure organization-wide settings if needed

## ⚙️ Step 2: Configure in VS Code

### Option A: Using Command Palette (Recommended)

1. **Open VS Code** in your project folder
2. **Press `Ctrl+Shift+P`** (Linux) to open Command Palette
3. **Type and select**: `Smart PR Creator: Configure Webhooks`
4. **Choose**: `Add New Webhook`
5. **Enter webhook details**:
   - **Name**: `Teams PR Notifications`
   - **URL**: Paste the webhook URL from Teams
   - **Platform**: Select `teams`
   - **Events**: Choose which events to monitor:
     - ✅ `PR Created` (recommended)
     - ✅ `PR Merged` (recommended)
     - ⚪ `PR Updated` (optional)
     - ⚪ `PR Closed` (optional)

### Option B: Manual Configuration

Add to your VS Code `settings.json`:

```json
{
  "smartPrCreator.webhooks": {
    "enabled": true,
    "endpoints": [
      {
        "name": "Teams PR Notifications",
        "url": "https://outlook.office.com/webhook/YOUR_WEBHOOK_URL_HERE",
        "enabled": true,
        "events": ["pr_created", "pr_merged"],
        "platform": "teams",
        "retryAttempts": 3,
        "timeout": 10000
      }
    ]
  }
}
```

## 🧪 Step 3: Test the Integration

1. **Open Command Palette** (`Ctrl+Shift+P`)
2. **Run**: `Smart PR Creator: Test Webhook Connection`
3. **Select your Teams webhook** from the list
4. **Check your Teams channel** - you should see a test message like:

```
🧪 Test Webhook from Smart PR Creator
Repository: test/project/repository
Author: Smart PR Creator Extension
Branch: feature/test-webhook → main
Files Changed: 5 | Commits: 3
AI Generated: Yes (GPT-4o)
[View Pull Request]
```

## 🚀 Step 4: Create Your First PR with Notifications

1. **Make some changes** to your code
2. **Open Command Palette** (`Ctrl+Shift+P`)
3. **Run**: `Smart PR Creator: Create Pull Request`
4. **Follow the PR creation wizard**
5. **Watch your Teams channel** - you'll automatically receive a rich notification!

## 📱 What Teams Messages Look Like

When you create a PR, Teams will receive a professional message card with:

### **Message Header**
- 🚀 Event icon and title (e.g., "New Pull Request Created")
- Repository name as subtitle
- Color-coded theme (blue for created, green for merged, etc.)

### **PR Details Section**
- **Title**: Your PR title
- **Author**: Who created the PR
- **Branch**: Source → Target branch
- **Files Changed**: Number of modified files
- **Commits**: Number of commits
- **AI Generated**: Whether AI was used and which model

### **Action Buttons**
- **"View Pull Request"** button that opens the PR directly in Azure DevOps

### **Example Teams Message**
```
🚀 New Pull Request Created
myorg/myproject/myrepo

Title: Add user authentication feature
Author: john.doe@company.com
Branch: feature/auth → main
Files Changed: 8
Commits: 4
AI Generated: Yes (GPT-4o)

[View Pull Request] ← Clickable button
```

## 🔍 Step 5: Monitor and Manage

### View Webhook History
1. **Command Palette** → `Smart PR Creator: View Webhook History`
2. See success rates, response times, and any failures
3. Debug issues if webhooks aren't working

### Manage Multiple Webhooks
- Add webhooks for different channels (e.g., team-specific notifications)
- Configure different events for different channels
- Enable/disable webhooks as needed

## 🛠️ Troubleshooting

### Common Issues

#### **"Webhook test failed"**
- ✅ Verify the webhook URL is correct
- ✅ Check Teams channel permissions
- ✅ Ensure the webhook is still active in Teams

#### **"No notifications in Teams"**
- ✅ Check webhook is enabled in VS Code settings
- ✅ Verify events are selected (pr_created)
- ✅ Check VS Code Output panel for errors

#### **"Webhook appears disabled"**
- ✅ Go to Teams → Channel → Connectors
- ✅ Check if the webhook is still configured
- ✅ Recreate webhook if necessary

### Debug Steps

1. **Check VS Code Output**:
   - View → Output → Select "Smart PR Creator - Webhooks"
   - Look for error messages

2. **Test connectivity**:
   - Use the test webhook command
   - Verify webhook URL format

3. **Verify configuration**:
   - Check VS Code settings for webhook configuration
   - Ensure platform is set to "teams"

## 🎯 Advanced Usage

### Multiple Team Channels
Configure different webhooks for different purposes:

```json
{
  "smartPrCreator.webhooks": {
    "enabled": true,
    "endpoints": [
      {
        "name": "Dev Team - All PRs",
        "url": "https://outlook.office.com/webhook/dev-team-webhook",
        "events": ["pr_created", "pr_updated", "pr_merged", "pr_closed"],
        "platform": "teams"
      },
      {
        "name": "Management - Major PRs Only",
        "url": "https://outlook.office.com/webhook/management-webhook",
        "events": ["pr_merged"],
        "platform": "teams"
      }
    ]
  }
}
```

### Custom Headers (if needed)
Some organizations require custom headers:

```json
{
  "name": "Secure Teams Webhook",
  "url": "https://outlook.office.com/webhook/...",
  "headers": {
    "Authorization": "Bearer YOUR_TOKEN",
    "X-Custom-Header": "value"
  },
  "platform": "teams"
}
```

## 🎉 Benefits

Once set up, your team will get:

- ✅ **Instant notifications** when PRs are created
- ✅ **Rich context** including AI model used, file counts, commit info
- ✅ **Direct links** to review PRs immediately
- ✅ **Professional formatting** that looks great in Teams
- ✅ **Zero manual effort** - completely automated

## 🔗 Next Steps

- Set up additional webhooks for Slack or Discord if needed
- Configure different events for different channels
- Monitor webhook analytics to track team engagement
- Integrate with other tools using generic webhooks

---

**Ready to enhance your team's PR workflow with automatic Teams notifications!** 🚀
