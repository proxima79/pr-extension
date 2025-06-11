# Smart PR Creator

A VS Code extension that automates pull request creation with AI-generated descriptions. This extension integrates with Azure DevOps using Azure CLI to streamline your workflow.

## Features

- **🤖 AI-Powered Descriptions**: Generate intelligent PR descriptions based on your code changes
- **☁️ Azure DevOps Integration**: Full integration with Azure DevOps using Azure CLI
- **📝 Smart Analysis**: Analyze commits, changed files, and work items automatically
- **👥 Reviewer Management**: Add reviewers directly from VS Code
- **🔄 Branch Status**: Check if your branch is up-to-date before creating PRs
- **📋 Work Item Linking**: Automatically detect and link work items from commits
- **⚡ Quick Actions**: Create PRs directly from the Source Control panel
- **🔍 Status Checking**: Monitor Azure CLI setup and authentication status

## Prerequisites

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

| Command                             | Description                    |
| ----------------------------------- | ------------------------------ |
| `smart-pr-creator.createPR`         | Create a basic pull request    |
| `smart-pr-creator.createPRWithAI`   | Create PR with AI description  |
| `smart-pr-creator.analyzeBranch`    | Analyze current branch changes |
| `smart-pr-creator.checkAzureStatus` | Check Azure CLI status         |

## Configuration

| Setting                                  | Description                         | Default |
| ---------------------------------------- | ----------------------------------- | ------- |
| `smartPrCreator.defaultTarget`           | Default target branch               | `main`  |
| `smartPrCreator.aiProvider`              | AI provider for descriptions        | `mock`  |
| `smartPrCreator.includeFileChanges`      | Include file changes in description | `true`  |
| `smartPrCreator.maxCommitsInDescription` | Max commits to include              | `5`     |

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
