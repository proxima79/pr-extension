// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Smart PR Creator extension is now active!');

	// Register commands
	const createPRCommand = vscode.commands.registerCommand('smart-pr-creator.createPR', async () => {
		await createPullRequest(false);
	});

	const createPRWithAICommand = vscode.commands.registerCommand('smart-pr-creator.createPRWithAI', async () => {
		await createPullRequest(true);
	});

	const analyzeBranchCommand = vscode.commands.registerCommand('smart-pr-creator.analyzeBranch', async () => {
		await analyzeBranchChanges();
	});

	// Add commands to subscriptions
	context.subscriptions.push(createPRCommand, createPRWithAICommand, analyzeBranchCommand);

	// Register status bar item
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBarItem.command = 'smart-pr-creator.createPRWithAI';
	statusBarItem.text = '$(git-pull-request) Smart PR';
	statusBarItem.tooltip = 'Create PR with AI Description';
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);
}

async function createPullRequest(useAI: boolean) {
	try {
		// Show progress
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Creating ${useAI ? 'AI-powered ' : ''}pull request...`,
			cancellable: true
		}, async (progress, token) => {
			
			progress.report({ increment: 20, message: 'Checking git repository...' });

			// Check if we're in a git repository
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				vscode.window.showErrorMessage('No workspace folder found. Please open a folder with a git repository.');
				return;
			}

			progress.report({ increment: 30, message: 'Analyzing changes...' });

			// Basic implementation for now
			const terminal = vscode.window.createTerminal('Smart PR Creator');
			
			progress.report({ increment: 40, message: 'Opening terminal...' });

			// Show terminal and provide basic git commands
			terminal.show();
			terminal.sendText('echo "Smart PR Creator - Git Repository Analysis"');
			terminal.sendText('git status');
			terminal.sendText('git branch --show-current');
			terminal.sendText('echo "Use the following commands to create a PR:"');
			
			if (useAI) {
				terminal.sendText('echo "With AI: This feature will be enhanced with AI analysis"');
			}
			
			progress.report({ increment: 30, message: 'Complete!' });

			// Get basic user input for now
			const title = await vscode.window.showInputBox({
				prompt: 'Enter PR title',
				placeHolder: 'Your PR title'
			});

			if (title) {
				const platform = await vscode.window.showQuickPick(
					['GitHub', 'Azure DevOps', 'GitLab'],
					{ placeHolder: 'Select your git platform' }
				);

				if (platform) {
					const message = `PR "${title}" ready for ${platform}. Check terminal for git commands.`;
					const result = await vscode.window.showInformationMessage(
						message,
						'Show Commands',
						'Configure Extension'
					);

					if (result === 'Show Commands') {
						terminal.sendText('echo "Manual PR creation commands:"');
						terminal.sendText('echo "1. git push origin $(git branch --show-current)"');
						terminal.sendText('echo "2. Open your git platform web interface"');
						terminal.sendText('echo "3. Create PR with title: ' + title + '"');
					} else if (result === 'Configure Extension') {
						vscode.commands.executeCommand('workbench.action.openSettings', 'smartPrCreator');
					}
				}
			}
		});

	} catch (error) {
		vscode.window.showErrorMessage(`Failed to create pull request: ${error}`);
	}
}

async function analyzeBranchChanges() {
	try {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			vscode.window.showErrorMessage('No workspace folder found.');
			return;
		}

		// Create a webview to show analysis
		const panel = vscode.window.createWebviewPanel(
			'branchAnalysis',
			'Branch Analysis',
			vscode.ViewColumn.One,
			{ enableScripts: true }
		);

		// For now, show a basic analysis interface
		panel.webview.html = `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="UTF-8">
				<title>Branch Analysis</title>
				<style>
					body { 
						font-family: var(--vscode-font-family); 
						padding: 20px; 
						color: var(--vscode-foreground);
						background: var(--vscode-editor-background);
					}
					.header { 
						border-bottom: 1px solid var(--vscode-panel-border); 
						padding-bottom: 10px; 
						margin-bottom: 20px;
					}
					.section { 
						margin: 20px 0; 
						padding: 15px;
						background: var(--vscode-textBlockQuote-background);
						border-radius: 4px;
					}
					.command {
						font-family: monospace;
						background: var(--vscode-textPreformat-background);
						padding: 10px;
						border-radius: 4px;
						margin: 10px 0;
					}
					.feature-coming { 
						color: var(--vscode-textPreformat-foreground);
						font-style: italic;
					}
				</style>
			</head>
			<body>
				<div class="header">
					<h1>🔍 Smart PR Creator - Branch Analysis</h1>
					<p>Analyzing your current git branch and changes</p>
				</div>
				
				<div class="section">
					<h2>📊 Current Status</h2>
					<p>Workspace: <code>${workspaceFolder.name}</code></p>
					<p class="feature-coming">🚀 AI-powered analysis coming soon!</p>
				</div>

				<div class="section">
					<h2>🔧 Quick Commands</h2>
					<p>Use these commands in your terminal:</p>
					<div class="command">git status</div>
					<div class="command">git log --oneline -5</div>
					<div class="command">git diff --stat</div>
				</div>

				<div class="section">
					<h2>⚡ Next Steps</h2>
					<ul>
						<li>Review your changes using the commands above</li>
						<li>Use the "Create PR with AI" command when ready</li>
						<li>Configure your git platform in extension settings</li>
					</ul>
				</div>

				<div class="section">
					<h2>🎯 Features Coming Soon</h2>
					<ul>
						<li>AI-generated PR descriptions</li>
						<li>Automatic change analysis</li>
						<li>Direct integration with GitHub, Azure DevOps, and GitLab</li>
						<li>Smart commit message suggestions</li>
					</ul>
				</div>
			</body>
			</html>
		`;

	} catch (error) {
		vscode.window.showErrorMessage(`Failed to analyze branch: ${error}`);
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}
