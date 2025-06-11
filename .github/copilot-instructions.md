# Copilot Instructions for Smart PR Creator Extension

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

This is a VS Code extension project. Please use the get_vscode_api with a query as input to fetch the latest VS Code API references.

## Project Context

This VS Code extension creates pull requests automatically with AI-generated descriptions by:

1. **Analyzing Git Changes**: Reading commit history, file changes, and repository state
2. **Generating AI Descriptions**: Using AI to create meaningful PR descriptions based on code changes
3. **Multi-Platform Support**: Supporting Azure DevOps, GitHub, and GitLab
4. **Smart Integration**: Integrating with VS Code's Source Control and Command Palette

## Development Guidelines

- Use TypeScript for type safety
- Follow VS Code extension best practices
- Implement proper error handling and user feedback
- Use VS Code's native UI components (QuickPick, InputBox, etc.)
- Support multiple git hosting platforms
- Implement secure credential management
- Provide comprehensive logging and debugging

## Key Features to Implement

- Command palette integration for PR creation
- Git repository analysis and change detection
- AI-powered description generation
- Support for Azure DevOps, GitHub, and GitLab APIs
- Configuration settings for customization
- Status bar integration for quick access
- Progress indicators for long-running operations
