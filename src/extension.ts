// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { AzureCliService } from './services/azureCliService';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Smart PR Creator extension is now active!');

	// Initialize Azure CLI service
	const azureCliService = new AzureCliService();

	// Register commands
	const createPRCommand = vscode.commands.registerCommand('smart-pr-creator.createPR', async () => {
		await createPullRequest(false, azureCliService);
	});

	const createPRWithAICommand = vscode.commands.registerCommand('smart-pr-creator.createPRWithAI', async () => {
		await createPullRequest(true, azureCliService);
	});

	const analyzeBranchCommand = vscode.commands.registerCommand('smart-pr-creator.analyzeBranch', async () => {
		await analyzeBranchChanges(azureCliService);
	});

	const checkStatusCommand = vscode.commands.registerCommand('smart-pr-creator.checkAzureStatus', async () => {
		await checkAzureCliStatus(azureCliService);
	});

	const listModelsCommand = vscode.commands.registerCommand('smart-pr-creator.listAvailableModels', async () => {
		await listAvailableAIModels();
	});

	const selectModelCommand = vscode.commands.registerCommand('smart-pr-creator.selectAIModel', async () => {
		await selectAIModel();
	});

	const configureWebhooksCommand = vscode.commands.registerCommand('smart-pr-creator.configureWebhooks', async () => {
		await configureWebhooks();
	});

	const testWebhookCommand = vscode.commands.registerCommand('smart-pr-creator.testWebhook', async () => {
		await testWebhookConnection();
	});

	const webhookHistoryCommand = vscode.commands.registerCommand('smart-pr-creator.webhookHistory', async () => {
		await viewWebhookHistory();
	});

	// Add commands to subscriptions
	context.subscriptions.push(
		createPRCommand,
		createPRWithAICommand,
		analyzeBranchCommand,
		checkStatusCommand,
		listModelsCommand,
		selectModelCommand,
		configureWebhooksCommand,
		testWebhookCommand,
		webhookHistoryCommand
	);

	// Register status bar item
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBarItem.command = 'smart-pr-creator.createPRWithAI';
	statusBarItem.text = '$(git-pull-request) Smart PR';
	statusBarItem.tooltip = 'Create PR with AI Description';
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);
}

async function createPullRequest(useAI: boolean, azureCliService: AzureCliService) {
	try {
		// Show progress
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Creating ${useAI ? 'AI-powered ' : ''}pull request...`,
			cancellable: true
		}, async (progress, token) => {
			
			progress.report({ increment: 10, message: 'Checking prerequisites...' });

			// Check if we're in a git repository
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				vscode.window.showErrorMessage('No workspace folder found. Please open a folder with a git repository.');
				return;
			}

			const workspacePath = workspaceFolder.uri.fsPath;

			// Validate Azure CLI prerequisites
			const validation = await azureCliService.validatePrerequisites();
			if (!validation.success) {
				vscode.window.showErrorMessage(validation.message);
				return;
			}

			progress.report({ increment: 10, message: 'Analyzing repository...' });

			// Parse Azure DevOps repository information
			const repoInfo = await azureCliService.parseAzureRepoInfo(workspacePath);
			if (!repoInfo) {
				vscode.window.showErrorMessage('This does not appear to be an Azure DevOps repository. Please ensure you are in an Azure DevOps git repository.');
				return;
			}

			progress.report({ increment: 15, message: 'Getting current branch...' });

			// Get current branch
			const currentBranch = await azureCliService.getCurrentBranch(workspacePath);
			if (currentBranch === 'main' || currentBranch === 'master') {
				const proceed = await vscode.window.showWarningMessage(
					`You are on the ${currentBranch} branch. Are you sure you want to create a PR from this branch?`,
					'Yes, Continue',
					'Cancel'
				);
				if (proceed !== 'Yes, Continue') {
					return;
				}
			}

			progress.report({ increment: 15, message: 'Checking git status...' });

			// Check if there are uncommitted changes
			const gitStatus = await azureCliService.getGitStatus(workspacePath);
			if (gitStatus.length > 0) {
				const proceed = await vscode.window.showWarningMessage(
					'You have uncommitted changes. Please commit your changes before creating a PR.',
					'Show Status',
					'Continue Anyway'
				);
				
				if (proceed === 'Show Status') {
					const terminal = vscode.window.createTerminal('Git Status');
					terminal.show();
					terminal.sendText('git status');
					return;
				} else if (proceed !== 'Continue Anyway') {
					return;
				}
			}

			progress.report({ increment: 15, message: 'Getting target branch...' });

			// Get default branch first
			const defaultBranch = await azureCliService.getDefaultBranch(workspacePath);
			
			// Get target branch
			const targetBranch = await vscode.window.showQuickPick(
				[defaultBranch, 'main', 'master', 'develop', 'development', 'dev'].filter((branch, index, self) => self.indexOf(branch) === index),
				{
					placeHolder: 'Select target branch',
					title: 'Choose the target branch for your pull request'
				}
			);

			if (!targetBranch) {
				return; // User cancelled
			}

			// Check branch status
			const branchStatus = await azureCliService.getBranchStatus(workspacePath, currentBranch);
			if (!branchStatus.upToDate && branchStatus.behind > 0) {
				const proceed = await vscode.window.showWarningMessage(
					`Your branch is ${branchStatus.behind} commit(s) behind ${targetBranch}. Consider pulling latest changes.`,
					'Continue Anyway',
					'Cancel'
				);
				if (proceed !== 'Continue Anyway') {
					return;
				}
			}

			progress.report({ increment: 15, message: 'Gathering commit information...' });

			// Get recent commits and generate description
			const commits = await azureCliService.getRecentCommits(workspacePath);
			const changedFiles = gitStatus.split('\n').filter((line: string) => line.trim().length > 0);
			
			progress.report({ increment: 10, message: 'Getting PR details...' });

			// Get PR title
			const defaultTitle = commits.length > 0 ? 
				commits[0].replace(/^[a-f0-9]+\s+/, '') : // Remove commit hash
				`Merge ${currentBranch} into ${targetBranch}`;

			const title = await vscode.window.showInputBox({
				prompt: 'Enter pull request title',
				value: defaultTitle,
				validateInput: (value) => {
					if (!value || value.trim().length === 0) {
						return 'Title is required';
					}
					if (value.length > 200) {
						return 'Title is too long (max 200 characters)';
					}
					return null;
				}
			});

			if (!title) {
				return; // User cancelled
			}

			progress.report({ increment: 10, message: 'Generating description...' });

			// Generate description
			const description = await azureCliService.generateAIDescription(commits, changedFiles, useAI, workspacePath);

			// Ask if user wants to edit the description
			const editDescription = await vscode.window.showQuickPick(
				['Use Generated Description', 'Edit Description', 'Enter Custom Description'],
				{
					placeHolder: 'Choose how to handle the PR description',
					title: 'Pull Request Description'
				}
			);

			let finalDescription = description;

			if (editDescription === 'Edit Description') {
				const editedDescription = await vscode.window.showInputBox({
					prompt: 'Edit the pull request description',
					value: description,
					ignoreFocusOut: true
				});
				if (editedDescription !== undefined) {
					finalDescription = editedDescription;
				}
			} else if (editDescription === 'Enter Custom Description') {
				const customDescription = await vscode.window.showInputBox({
					prompt: 'Enter custom pull request description',
					placeHolder: 'Describe your changes...',
					ignoreFocusOut: true
				});
				if (customDescription !== undefined) {
					finalDescription = customDescription;
				}
			}

			progress.report({ increment: 5, message: 'Getting work items...' });

			// Get work items (optional)
			const workItems = await azureCliService.getWorkItems(workspacePath);
			let selectedWorkItems: string[] = [];

			if (workItems.length > 0) {
				const includeWorkItems = await vscode.window.showQuickPick(
					['Include Work Items', 'Skip Work Items'],
					{
						placeHolder: `Found ${workItems.length} work item(s) in commits`,
						title: 'Work Items'
					}
				);

				if (includeWorkItems === 'Include Work Items') {
					selectedWorkItems = workItems;
				}
			}

			// Ask about draft status
			const isDraft = await vscode.window.showQuickPick(
				['Ready for Review', 'Create as Draft'],
				{
					placeHolder: 'Choose PR status',
					title: 'Pull Request Status'
				}
			);

			// Get reviewers (optional)
			let selectedReviewers: string[] = [];
			if (isDraft === 'Ready for Review') {
				progress.report({ increment: 3, message: 'Loading reviewers...' });
				
				try {
					const availableReviewers = await azureCliService.listAvailableReviewers(repoInfo);
					if (availableReviewers.length > 0) {
						const addReviewers = await vscode.window.showQuickPick(
							['Add Reviewers', 'Skip Reviewers'],
							{
								placeHolder: 'Would you like to add reviewers?',
								title: 'Reviewers'
							}
						);

						if (addReviewers === 'Add Reviewers') {
							const reviewers = await vscode.window.showQuickPick(
								availableReviewers,
								{
									placeHolder: 'Select reviewers (use Ctrl/Cmd to select multiple)',
									title: 'Choose Reviewers',
									canPickMany: true
								}
							);
							
							if (reviewers && reviewers.length > 0) {
								selectedReviewers = reviewers;
							}
						}
					}
				} catch (error) {
					console.log('Could not load reviewers:', error);
				}
			}

			progress.report({ increment: 5, message: 'Pushing branch to remote...' });

			// Push the branch if needed
			try {
				await azureCliService.pushBranch(workspacePath, currentBranch);
			} catch (error: any) {
				if (!error.message.includes('up-to-date')) {
					vscode.window.showWarningMessage(`Warning: ${error.message}`);
				}
			}

			progress.report({ increment: 5, message: 'Creating pull request...' });

			// Create the pull request
			const prResult = await azureCliService.createPullRequest(
				repoInfo,
				{
					title: title.trim(),
					description: finalDescription,
					sourceBranch: currentBranch,
					targetBranch,
					workItems: selectedWorkItems,
					reviewers: selectedReviewers,
					isDraft: isDraft === 'Create as Draft'
				},
				workspacePath
			);

			progress.report({ increment: 5, message: 'Complete!' });

			// Show success message
			const result = await vscode.window.showInformationMessage(
				`Pull request #${prResult.pullRequestId} created successfully!`,
				'Open PR',
				'Copy URL',
				'Show in Terminal'
			);

			if (result === 'Open PR') {
				vscode.env.openExternal(vscode.Uri.parse(prResult.url));
			} else if (result === 'Copy URL') {
				vscode.env.clipboard.writeText(prResult.url);
				vscode.window.showInformationMessage('PR URL copied to clipboard!');
			} else if (result === 'Show in Terminal') {
				const terminal = vscode.window.createTerminal('Smart PR Creator');
				terminal.show();
				terminal.sendText(`echo "Pull Request Created Successfully!"`);
				terminal.sendText(`echo "PR #${prResult.pullRequestId}: ${title}"`);
				terminal.sendText(`echo "URL: ${prResult.url}"`);
				terminal.sendText(`echo "Organization: ${repoInfo.organization}"`);
				terminal.sendText(`echo "Project: ${repoInfo.project}"`);
				terminal.sendText(`echo "Repository: ${repoInfo.repository}"`);
			}
		});

	} catch (error: any) {
		vscode.window.showErrorMessage(`Failed to create pull request: ${error.message}`);
		console.error('PR creation error:', error);
	}
}

async function analyzeBranchChanges(azureCliService: AzureCliService) {
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

async function checkAzureCliStatus(azureCliService: AzureCliService) {
	try {
		// Create a webview to show Azure CLI status
		const panel = vscode.window.createWebviewPanel(
			'azureStatus',
			'Azure CLI Status',
			vscode.ViewColumn.One,
			{ enableScripts: true }
		);

		// Check various statuses
		const cliInstalled = await azureCliService.checkAzureCliInstalled();
		const devOpsExtension = await azureCliService.checkDevOpsExtension();
		const loggedIn = await azureCliService.checkLoginStatus();
		
		let organizationInfo = '';
		if (loggedIn) {
			const defaults = await azureCliService.getAzureDevOpsDefaults();
			organizationInfo = `
				<div class="status-item success">
					<strong>Organization:</strong> ${defaults.organization || 'Not configured'}
				</div>
				<div class="status-item success">
					<strong>Project:</strong> ${defaults.project || 'Not configured'}
				</div>
			`;
		}

		panel.webview.html = `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="UTF-8">
				<title>Azure CLI Status</title>
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
					.status-item { 
						margin: 10px 0; 
						padding: 10px;
						border-radius: 4px;
					}
					.success { 
						background: var(--vscode-textLink-foreground);
						color: white;
					}
					.error { 
						background: var(--vscode-errorForeground);
						color: white;
					}
					.warning { 
						background: var(--vscode-list-warningForeground);
						color: white;
					}
					.section { 
						margin: 20px 0; 
					}
				</style>
			</head>
			<body>
				<div class="header">
					<h1>☁️ Azure CLI Status Check</h1>
					<p>Current status of Azure CLI integration</p>
				</div>
				
				<div class="section">
					<h2>Prerequisites</h2>
					<div class="status-item ${cliInstalled ? 'success' : 'error'}">
						<strong>Azure CLI:</strong> ${cliInstalled ? '✅ Installed' : '❌ Not installed'}
					</div>
					<div class="status-item ${devOpsExtension ? 'success' : 'error'}">
						<strong>DevOps Extension:</strong> ${devOpsExtension ? '✅ Installed' : '❌ Not installed'}
					</div>
					<div class="status-item ${loggedIn ? 'success' : 'error'}">
						<strong>Authentication:</strong> ${loggedIn ? '✅ Logged in' : '❌ Not logged in'}
					</div>
				</div>

				${loggedIn ? `
				<div class="section">
					<h2>Configuration</h2>
					${organizationInfo}
				</div>` : ''}

				<div class="section">
					<h2>Next Steps</h2>
					${!cliInstalled ? '<p>• Install Azure CLI from <a href="https://docs.microsoft.com/cli/azure/install-azure-cli">Microsoft Docs</a></p>' : ''}
					${!devOpsExtension ? '<p>• Run: <code>az extension add --name azure-devops</code></p>' : ''}
					${!loggedIn ? '<p>• Run: <code>az login</code></p>' : ''}
					${cliInstalled && devOpsExtension && loggedIn ? '<p>✅ Ready to create pull requests!</p>' : ''}
				</div>
			</body>
			</html>
		`;

	} catch (error) {
		vscode.window.showErrorMessage(`Failed to check Azure CLI status: ${error}`);
	}
}

async function listAvailableAIModels() {
	try {
		const { AIService } = await import('./services/aiService.js');
		const aiService = new AIService();

		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Discovering available AI models...',
			cancellable: false
		}, async (progress) => {
			
			progress.report({ increment: 20, message: 'Checking VS Code Language Model API...' });
			
			const availableModels = await aiService.getAvailableModels();
			const copilotModels = await aiService.getCopilotModels();

			progress.report({ increment: 80, message: 'Preparing model list...' });

			// Create webview to display available models
			const panel = vscode.window.createWebviewPanel(
				'availableModels',
				'Available AI Models',
				vscode.ViewColumn.One,
				{
					enableScripts: true
				}
			);

			panel.webview.html = generateModelListHTML(availableModels, copilotModels);
		});

	} catch (error) {
		vscode.window.showErrorMessage(`Failed to list AI models: ${error}`);
	}
}

async function selectAIModel() {
	try {
		const { AIService } = await import('./services/aiService.js');
		const aiService = new AIService();

		// Get available models
		const availableModels = await aiService.getAvailableModels();
		
		if (availableModels.length === 0) {
			vscode.window.showWarningMessage('No AI models are currently available. Please ensure GitHub Copilot or other language model extensions are installed and logged in.');
			return;
		}

		// Create quick pick items
		const quickPickItems = [
			{
				label: '$(star) auto',
				description: 'Automatically select the best available model',
				detail: 'Recommended: Let the extension choose the optimal model',
				modelValue: 'auto'
			},
			...availableModels.map(model => ({
				label: `$(robot) ${model.name}`,
				description: `${model.vendor}/${model.family}`,
				detail: `Max tokens: ${model.maxInputTokens.toLocaleString()} | Version: ${model.version}`,
				modelValue: model.family
			}))
		];

		// Show quick pick
		const selected = await vscode.window.showQuickPick(quickPickItems, {
			title: 'Select AI Model for PR Descriptions',
			placeHolder: 'Choose an AI model to use for generating pull request descriptions',
			matchOnDescription: true,
			matchOnDetail: true
		});

		if (selected) {
			// Update configuration
			const config = vscode.workspace.getConfiguration('smartPrCreator');
			await config.update('aiModel', selected.modelValue, vscode.ConfigurationTarget.Global);
			
			vscode.window.showInformationMessage(
				`AI model updated to: ${selected.label.replace('$(robot) ', '').replace('$(star) ', '')}`,
				'Test with PR Creation'
			).then(action => {
				if (action === 'Test with PR Creation') {
					vscode.commands.executeCommand('smart-pr-creator.createPRWithAI');
				}
			});
		}

	} catch (error) {
		vscode.window.showErrorMessage(`Failed to select AI model: ${error}`);
	}
}

function generateModelListHTML(allModels: any[], copilotModels: any[]): string {
	const generateModelTable = (models: any[], title: string) => {
		if (models.length === 0) {
			return `<p><em>No ${title.toLowerCase()} available</em></p>`;
		}

		return `
			<table>
				<thead>
					<tr>
						<th>Name</th>
						<th>ID</th>
						<th>Vendor</th>
						<th>Family</th>
						<th>Version</th>
						<th>Max Tokens</th>
					</tr>
				</thead>
				<tbody>
					${models.map(model => `
						<tr>
							<td><strong>${model.name}</strong></td>
							<td><code>${model.id}</code></td>
							<td>${model.vendor}</td>
							<td>${model.family}</td>
							<td>${model.version}</td>
							<td>${model.maxInputTokens.toLocaleString()}</td>
						</tr>
					`).join('')}
				</tbody>
			</table>
		`;
	};

	return `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Available AI Models</title>
			<style>
				body {
					margin: 20px;
					font-family: var(--vscode-font-family);
					line-height: 1.6;
					color: var(--vscode-foreground);
					background-color: var(--vscode-editor-background);
				}
				.header {
					background: var(--vscode-button-background);
					color: var(--vscode-button-foreground);
					padding: 20px;
					border-radius: 8px;
					margin-bottom: 20px;
					border: 1px solid var(--vscode-button-border, transparent);
				}
				.section {
					margin: 20px 0;
					padding: 15px;
					border: 1px solid var(--vscode-panel-border);
					border-radius: 8px;
					background-color: var(--vscode-editor-background);
				}
				table {
					width: 100%;
					border-collapse: collapse;
					margin: 10px 0;
				}
				th, td {
					border: 1px solid var(--vscode-panel-border);
					padding: 8px;
					text-align: left;
					color: var(--vscode-foreground);
				}
				th {
					background-color: var(--vscode-textBlockQuote-background);
					font-weight: bold;
				}
				tr:nth-child(even) {
					background-color: var(--vscode-list-hoverBackground);
				}
				tr:hover {
					background-color: var(--vscode-list-focusBackground);
				}
				code {
					background-color: var(--vscode-textCodeBlock-background);
					color: var(--vscode-textPreformat-foreground);
					padding: 2px 4px;
					border-radius: 3px;
					font-family: var(--vscode-editor-font-family);
				}
				.config-section {
					background-color: var(--vscode-textBlockQuote-background);
					color: var(--vscode-foreground);
					padding: 15px;
					border-radius: 8px;
					margin: 20px 0;
					border: 1px solid var(--vscode-textBlockQuote-border);
				}
				.model-count {
					color: var(--vscode-descriptionForeground);
					font-style: italic;
				}
				h1, h2, h3 {
					color: var(--vscode-foreground);
				}
				ul, ol {
					color: var(--vscode-foreground);
				}
				li {
					margin: 5px 0;
				}
				a {
					color: var(--vscode-textLink-foreground);
				}
				a:hover {
					color: var(--vscode-textLink-activeForeground);
				}
				strong {
					color: var(--vscode-foreground);
				}
			</style>
		</head>
		<body>
			<div class="header">
				<h1>🤖 Available AI Models</h1>
				<p>Models available through VS Code's Language Model API</p>
			</div>

			<div class="config-section">
				<h2>Configuration</h2>
				<p>To use a specific model, update your settings:</p>
				<ul>
					<li><strong>AI Provider:</strong> Set <code>smartPrCreator.aiProvider</code> to "copilot"</li>
					<li><strong>AI Model:</strong> Set <code>smartPrCreator.aiModel</code> to desired model family (e.g., "gpt-4o", "claude-3-5-sonnet")</li>
				</ul>
			</div>

			<div class="section">
				<h2>🚀 GitHub Copilot Models <span class="model-count">(${copilotModels.length} available)</span></h2>
				<p>Models specifically available through GitHub Copilot integration:</p>
				${generateModelTable(copilotModels, 'Copilot models')}
			</div>

			<div class="section">
				<h2>🌐 All Available Models <span class="model-count">(${allModels.length} total)</span></h2>
				<p>All models accessible through VS Code's Language Model API:</p>
				${generateModelTable(allModels, 'models')}
			</div>

			${allModels.length === 0 ? `
			<div class="section" style="background-color: var(--vscode-inputValidation-warningBackground, #ffcc02); border-color: var(--vscode-inputValidation-warningBorder, #ffcc02); color: var(--vscode-inputValidation-warningForeground, #000);">
				<h3>⚠️ No Models Available</h3>
				<p>No AI models are currently available. This could be because:</p>
				<ul>
					<li>GitHub Copilot extension is not installed or not logged in</li>
					<li>VS Code Language Model API is not available in your VS Code version</li>
					<li>No language model extensions are installed</li>
				</ul>
				<p><strong>To get started:</strong></p>
				<ol>
					<li>Install the GitHub Copilot extension</li>
					<li>Sign in to GitHub Copilot</li>
					<li>Restart VS Code and try again</li>
				</ol>
			</div>
			` : ''}
		</body>
		</html>
	`;
}

async function configureWebhooks() {
	try {
		const action = await vscode.window.showQuickPick([
			{ label: '$(add) Add New Webhook', description: 'Configure a new webhook endpoint', value: 'add' },
			{ label: '$(list-unordered) View Existing Webhooks', description: 'View and manage existing webhooks', value: 'view' },
			{ label: '$(settings-gear) Enable/Disable Webhooks', description: 'Toggle webhook functionality', value: 'toggle' }
		], {
			title: 'Webhook Configuration',
			placeHolder: 'Choose a webhook management action'
		});

		if (!action) {
			return;
		}

		switch (action.value) {
			case 'add':
				await addNewWebhook();
				break;
			case 'view':
				await viewExistingWebhooks();
				break;
			case 'toggle':
				await toggleWebhooks();
				break;
		}
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to configure webhooks: ${error}`);
	}
}

async function addNewWebhook() {
	try {
		// Get webhook name
		const name = await vscode.window.showInputBox({
			title: 'Webhook Name',
			placeHolder: 'Enter a name for this webhook (e.g., "Slack Notifications")',
			validateInput: (value) => value.trim() ? null : 'Name is required'
		});
		if (!name) {
			return;
		}

		// Get webhook URL
		const url = await vscode.window.showInputBox({
			title: 'Webhook URL',
			placeHolder: 'Enter the webhook URL (e.g., https://hooks.slack.com/...)',
			validateInput: (value) => {
				if (!value.trim()) {
					return 'URL is required';
				}
				if (!value.startsWith('http')) {
					return 'URL must start with http:// or https://';
				}
				return null;
			}
		});
		if (!url) {
			return;
		}

		// Select events
		const eventOptions = [
			{ label: 'PR Created', description: 'Trigger when a new PR is created', value: 'pr_created', picked: true },
			{ label: 'PR Updated', description: 'Trigger when a PR is updated', value: 'pr_updated' },
			{ label: 'PR Merged', description: 'Trigger when a PR is merged', value: 'pr_merged' },
			{ label: 'PR Closed', description: 'Trigger when a PR is closed', value: 'pr_closed' }
		];

		const selectedEvents = await vscode.window.showQuickPick(eventOptions, {
			title: 'Select Events',
			placeHolder: 'Choose which events should trigger this webhook',
			canPickMany: true
		});
		if (!selectedEvents || selectedEvents.length === 0) {
			return;
		}

		// Save webhook configuration
		const config = vscode.workspace.getConfiguration('smartPrCreator');
		const webhooksConfig = config.get('webhooks') as any || { enabled: false, endpoints: [] };
		
		const newWebhook = {
			name: name.trim(),
			url: url.trim(),
			events: selectedEvents.map(e => e.value),
			retryAttempts: 3,
			timeout: 10000,
			headers: {
				'Content-Type': 'application/json'
			}
		};

		webhooksConfig.endpoints.push(newWebhook);
		await config.update('webhooks', webhooksConfig, vscode.ConfigurationTarget.Global);

		vscode.window.showInformationMessage(`Webhook "${name}" configured successfully!`);
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to add webhook: ${error}`);
	}
}

async function viewExistingWebhooks() {
	try {
		const config = vscode.workspace.getConfiguration('smartPrCreator');
		const webhooksConfig = config.get('webhooks') as any || { enabled: false, endpoints: [] };

		if (webhooksConfig.endpoints.length === 0) {
			vscode.window.showInformationMessage('No webhooks configured. Use "Configure Webhooks" to add one.');
			return;
		}

		const webhookItems = webhooksConfig.endpoints.map((webhook: any) => ({
			label: `$(link) ${webhook.name}`,
			description: webhook.url,
			detail: `Events: ${webhook.events.join(', ')}`
		}));

		await vscode.window.showQuickPick(webhookItems, {
			title: 'Configured Webhooks',
			placeHolder: 'Your configured webhook endpoints'
		});
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to view webhooks: ${error}`);
	}
}

async function toggleWebhooks() {
	try {
		const config = vscode.workspace.getConfiguration('smartPrCreator');
		const webhooksConfig = config.get('webhooks') as any || { enabled: false, endpoints: [] };
		
		const newState = !webhooksConfig.enabled;
		webhooksConfig.enabled = newState;
		
		await config.update('webhooks', webhooksConfig, vscode.ConfigurationTarget.Global);
		
		vscode.window.showInformationMessage(
			`Webhooks ${newState ? 'enabled' : 'disabled'} successfully!`
		);
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to toggle webhooks: ${error}`);
	}
}

async function testWebhookConnection() {
	try {
		const config = vscode.workspace.getConfiguration('smartPrCreator');
		const webhooksConfig = config.get('webhooks') as any || { enabled: false, endpoints: [] };

		if (webhooksConfig.endpoints.length === 0) {
			vscode.window.showInformationMessage('No webhooks configured. Use "Configure Webhooks" to add one first.');
			return;
		}

		const webhookItems = webhooksConfig.endpoints.map((webhook: any) => ({
			label: `$(link) ${webhook.name}`,
			description: webhook.url,
			webhook
		}));

		const selected = await vscode.window.showQuickPick(webhookItems, {
			title: 'Test Webhook Connection',
			placeHolder: 'Select a webhook to test'
		});

		if (selected) {
			// Import WebhookService dynamically
			const webhookModule = await import('./services/webhookService.js');
			const webhookService = new webhookModule.WebhookService();
			
			vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Testing webhook "${(selected as any).webhook.name}"...`,
				cancellable: false
			}, async () => {
				const success = await webhookService.testWebhook((selected as any).webhook.url, (selected as any).webhook.headers || {});
				
				if (success) {
					vscode.window.showInformationMessage(`✅ Webhook connection successful!`);
				} else {
					vscode.window.showErrorMessage(`❌ Webhook connection failed. Check the URL and try again.`);
				}
			});
		}
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to test webhook connection: ${error}`);
	}
}

async function viewWebhookHistory() {
	try {
		// Import WebhookService dynamically
		const webhookModule = await import('./services/webhookService.js');
		const webhookService = new webhookModule.WebhookService();
		const history = await webhookService.getWebhookHistory();

		if (history.length === 0) {
			vscode.window.showInformationMessage('No webhook history available yet. Webhooks will appear here after PRs are created.');
			return;
		}

		// Create a webview to display webhook history
		const panel = vscode.window.createWebviewPanel(
			'webhookHistory',
			'Webhook History',
			vscode.ViewColumn.One,
			{ enableScripts: true }
		);

		const historyHTML = `
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					body { font-family: var(--vscode-font-family); margin: 20px; }
					.history-item { border: 1px solid #ccc; margin: 10px 0; padding: 10px; border-radius: 5px; }
					.success { border-left: 4px solid green; }
					.failure { border-left: 4px solid red; }
				</style>
			</head>
			<body>
				<h1>Webhook History</h1>
				${history.map((item: any) => `
					<div class="history-item ${item.success ? 'success' : 'failure'}">
						<strong>${item.webhookName}</strong> - ${item.event}<br>
						<small>${new Date(item.timestamp).toLocaleString()}</small>
						${item.error ? `<br><span style="color: red;">Error: ${item.error}</span>` : ''}
					</div>
				`).join('')}
			</body>
			</html>
		`;

		panel.webview.html = historyHTML;
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to view webhook history: ${error}`);
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}
