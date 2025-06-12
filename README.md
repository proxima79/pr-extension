# Smart PR Creator

A VS Code extension that automates pull request creation with AI-generated descriptions. This extension integrates with Azure DevOps using Azure CLI and leverages GitHub Copilot for intelligent PR descriptions.

## Features

- **🤖 GitHub Copilot Integration**: Generate intelligent PR descriptions using GitHub Copilot's language models
- **☁️ Azure DevOps Integration**: Full integration with Azure DevOps using Azure CLI
- **📝 Smart Analysis**: Analyze commits, changed files, and work items automatically with AI insights
- **🔗 Webhook Integration**: Send real-time notifications to Microsoft Teams, Slack, Discord, or custom endpoints
- **👥 Reviewer Management**: Add reviewers directly from VS Code
- **🔄 Branch Status**: Check if your branch is up-to-date before creating PRs
- **📋 Work Item Linking**: Automatically detect and link work items from commits
- **⚡ Quick Actions**: Create PRs directly from the Source Control panel
- **🔍 Status Checking**: Monitor Azure CLI setup and authentication status
- **🧠 AI Provider Options**: Choose between GitHub Copilot, OpenAI, Azure OpenAI, or Anthropic
- **📊 Analytics**: Track webhook success rates and PR creation patterns

## Prerequisites

### GitHub Copilot (Recommended)

- **GitHub Copilot Subscription**: Required for AI-powered PR descriptions
- **VS Code Copilot Extension**: Install the GitHub Copilot extension
- **Signed in to GitHub**: Ensure you're authenticated with GitHub Copilot

### Azure CLI Setup

1. **Install Azure CLI**: Download from [Microsoft Docs](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
2. **Install DevOps Extension**:
   ```bash
   az extension add --name azure-devops
   ```
3. **Login to Azure**:
   ```bash
   az login
   ```

### Repository Requirements

- Your repository must be hosted on Azure DevOps
- You must have push access to the repository
- The repository must be a Git repository

## Usage

### Creating Pull Requests

1. **Open Command Palette**: `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. **Choose a command**:
   - `Smart PR Creator: Create Pull Request` - Basic PR creation
   - `Smart PR Creator: Create PR with AI Description` - AI-enhanced PR creation
3. **Follow the guided workflow**:
   - The extension will validate your Azure CLI setup
   - Select target branch (automatically detects default branch)
   - Enter PR title (auto-generated from recent commits)
   - Choose description handling (generated, edited, or custom)
   - Add work items (auto-detected from commit messages)
   - Select reviewers (loaded from your Azure DevOps organization)
   - Choose draft status

### Quick Actions

- **Status Bar**: Click the "Smart PR" button in the status bar for quick access
- **Source Control Panel**: Use the PR button in the Git Source Control panel
- **Command Palette**: Access all commands via `Ctrl+Shift+P`

### Checking Azure CLI Status

Use `Smart PR Creator: Check Azure CLI Status` to verify:

- Azure CLI installation
- DevOps extension status
- Authentication status
- Current organization and project configuration

## Commands

| Command                                | Description                         |
| -------------------------------------- | ----------------------------------- |
| `smart-pr-creator.createPR`            | Create a basic pull request         |
| `smart-pr-creator.createPRWithAI`      | Create PR with AI description       |
| `smart-pr-creator.analyzeBranch`       | Analyze current branch changes      |
| `smart-pr-creator.checkAzureStatus`    | Check Azure CLI status              |
| `smart-pr-creator.listAvailableModels` | List available AI models            |
| `smart-pr-creator.selectAIModel`       | Select AI model for PR descriptions |
| `smart-pr-creator.configureWebhooks`   | Configure webhook notifications     |
| `smart-pr-creator.testWebhook`         | Test webhook connection             |
| `smart-pr-creator.webhookHistory`      | View webhook activity history       |

## Configuration

| Setting                             | Description                         | Default   |
| ----------------------------------- | ----------------------------------- | --------- |
| `smartPrCreator.defaultTarget`      | Default target branch               | `main`    |
| `smartPrCreator.aiProvider`         | AI provider for descriptions        | `copilot` |
| `smartPrCreator.aiModel`            | Specific AI model to use            | `auto`    |
| `smartPrCreator.includeFileChanges` | Include file changes in description | `true`    |
| `smartPrCreator.maxFilesToAnalyze`  | Maximum files to analyze for AI     | `50`      |
| `smartPrCreator.platform`           | Git hosting platform                | `azure`   |

### AI Provider Options

- **`copilot`** (Default): Use GitHub Copilot's language models for intelligent descriptions
- **`openai`**: Use OpenAI's GPT models (requires API key)
- **`azure-openai`**: Use Azure OpenAI Service (requires configuration)
- **`anthropic`**: Use Anthropic's Claude models (requires API key)

### AI Model Selection

The extension supports multiple AI models through VS Code's Language Model API:

#### Available Models

- **`auto`** (Default): Automatically select the best available model
- **`gpt-4o`**: OpenAI's latest GPT-4 Omni model
- **`gpt-4o-mini`**: Lightweight version of GPT-4 Omni
- **`claude-3-5-sonnet`**: Anthropic's Claude 3.5 Sonnet (via Copilot)
- **`claude-sonnet`**: Alias for Claude 3.5 Sonnet
- **`o1-preview`**: OpenAI's O1 reasoning model
- **`o1-mini`**: Lightweight O1 model

#### Model Discovery

Use the `Smart PR Creator: List Available AI Models` command to see what models are currently available in your VS Code installation. Model availability depends on:

- GitHub Copilot extension installation and authentication
- VS Code version (Language Model API support)
- Enabled language model extensions

#### Model Selection

Use the `Smart PR Creator: Select AI Model` command for an interactive model picker, or configure directly in settings:

```json
{
  "smartPrCreator.aiProvider": "copilot",
  "smartPrCreator.aiModel": "claude-3-5-sonnet"
}
```

### GitHub Copilot Configuration

When using the `copilot` AI provider:

- Ensure you have an active GitHub Copilot subscription
- The GitHub Copilot extension must be installed and enabled
- You must be signed in to your GitHub account
- The extension uses GPT-4o model family for optimal code understanding

## Azure CLI Integration Features

### Automatic Detection

- Repository information (organization, project, repo name)
- Current branch and status
- Work items from commit messages (e.g., `#1234`, `AB#1234`)
- Default branch configuration

### Branch Management

- Check if branch is ahead/behind target
- Automatic branch pushing
- Branch status validation

### Work Item Integration

- Auto-detect work item references in commits
- Link work items to pull requests
- Support for various work item ID formats

### Reviewer Management

- Load available reviewers from organization
- Multi-select reviewer interface
- Optional reviewer assignment

## Webhook Integration

### Supported Webhook Services

- **Microsoft Teams**
- **Slack**
- **Discord**
- **Custom Webhook URLs**

### Configuration

Configure webhook settings in `settings.json`:

```json
{
  "smartPrCreator.webhook.enabled": true,
  "smartPrCreator.webhook.url": "https://your-webhook-url",
  "smartPrCreator.webhook.secret": "optional-secret"
}
```

### Features

- **Real-time Notifications**: Get instant updates on PR creation and status changes
- **Customizable Payloads**: Define custom payloads for webhook notifications
- **Retry Mechanism**: Automatic retry for failed webhook deliveries
- **Analytics**: Track webhook success rates and PR creation patterns

## Troubleshooting

### Common Issues

1. **"Azure CLI not found"**

   - Install Azure CLI from [Microsoft Docs](https://docs.microsoft.com/cli/azure/install-azure-cli)
   - Restart VS Code after installation

2. **"DevOps extension not installed"**

   - Run: `az extension add --name azure-devops`
   - The extension can auto-install with permission

3. **"Not logged in"**

   - Run: `az login`
   - Follow the browser authentication flow

4. **"Not an Azure DevOps repository"**

   - Ensure your repository's remote URL points to Azure DevOps
   - Check with: `git remote get-url origin`

5. **"GitHub Copilot not working"**

   - Install the GitHub Copilot extension in VS Code
   - Sign in to GitHub and verify active subscription
   - Check extension status in VS Code

6. **"Webhook notifications not working"**

   - Test webhook connection using Command Palette
   - Verify webhook URL in Teams/Slack configuration
   - Check VS Code Output panel for error messages

## 📚 Documentation

- **[Installation Guide](docs/user-guides/INSTALLATION_GUIDE.md)** - Complete setup instructions
- **[Teams Integration](docs/user-guides/TEAMS_SETUP_GUIDE.md)** - Microsoft Teams webhook setup
- **[Webhook Guide](docs/user-guides/WEBHOOK_INTEGRATION_GUIDE.md)** - Complete webhook documentation
- **[Model Selection](docs/user-guides/MODEL_SELECTION_GUIDE.md)** - AI model configuration
- **[Development Docs](docs/development/DEVELOPMENT.md)** - Technical documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- Microsoft for Azure DevOps CLI and VS Code platform
- GitHub for Copilot integration
- The VS Code extension development community

5. **"Branch not found on remote"**
   - Push your branch first: `git push origin <branch-name>`
   - The extension can auto-push with permission

## Development

### Setup

```bash
npm install
npm run compile
```

### Testing

```bash
npm test
```

### Building

```bash
npm run package
```

## License

This project is licensed under the MIT License.
