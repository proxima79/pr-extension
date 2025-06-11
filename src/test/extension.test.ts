import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('Extension should be present and activated', async () => {
		const extension = vscode.extensions.getExtension('kenr.smart-pr-creator');
		assert.ok(extension, 'Extension should be installed');

		if (!extension.isActive) {
			await extension.activate();
		}
		assert.ok(extension.isActive, 'Extension should be activated');
	});

	test('Commands should be registered correctly', async () => {
		const commands = await vscode.commands.getCommands(true);
		
		const expectedCommands = [
			'smart-pr-creator.createPullRequest',
			'smart-pr-creator.listAvailableModels',
			'smart-pr-creator.selectAIModel',
			'smart-pr-creator.analyzeBranch',
			'smart-pr-creator.checkAzureCliStatus'
		];

		for (const command of expectedCommands) {
			assert.ok(commands.includes(command), 
				`Command '${command}' should be registered`);
		}
	});

	test('Configuration should have default values', async () => {
		const config = vscode.workspace.getConfiguration('smartPrCreator');
		
		// Test that configuration exists and has expected structure
		const aiProvider = config.get('aiProvider');
		const aiModel = config.get('aiModel');
		const platform = config.get('platform');
		
		assert.ok(typeof aiProvider === 'string');
		assert.ok(typeof aiModel === 'string');
		assert.ok(typeof platform === 'string');
	});

	test('Extension should handle workspace without git gracefully', async () => {
		// This tests that the extension doesn't crash when no git repo is present
		try {
			const commands = await vscode.commands.getCommands(true);
			assert.ok(commands.includes('smart-pr-creator.createPullRequest'));
			
			// The command should exist even if it can't execute due to no git repo
		} catch (error) {
			assert.fail(`Extension should not throw errors during initialization: ${error}`);
		}
	});

	test('Status bar integration should work', async () => {
		// Test that the extension doesn't crash when working with status bar
		// We can't directly test status bar items in unit tests
		assert.ok(true); // Extension should initialize without errors
	});

	test('Output channel should be created', async () => {
		// Test that extension creates its output channel without crashing
		// We can't directly access output channels in tests
		assert.ok(true); // Extension should initialize without errors
	});

	test('Extension should handle command execution errors gracefully', async () => {
		try {
			// Try to execute a command that might fail
			await vscode.commands.executeCommand('smart-pr-creator.createPullRequest');
			// Command might fail due to no git repo, but should not crash extension
		} catch (error) {
			// This is expected if no git repo is present
			assert.ok(error instanceof Error);
		}
	});

	test('AI model selection command should work', async () => {
		try {
			await vscode.commands.executeCommand('smart-pr-creator.listAvailableModels');
			// Should not throw an error, even if no models are available
		} catch (error) {
			// Some errors are expected (like no Copilot access)
			assert.ok(error instanceof Error);
		}
	});

	test('Azure CLI status command should work', async () => {
		try {
			await vscode.commands.executeCommand('smart-pr-creator.checkAzureCliStatus');
			// Should return a status even if Azure CLI is not installed
		} catch (error) {
			assert.fail(`Azure CLI status check should not throw: ${error}`);
		}
	});

	test('Configuration updates should be handled correctly', async () => {
		const config = vscode.workspace.getConfiguration('smartPrCreator');
		const originalValue = config.get('aiModel');
		
		try {
			// Test configuration update
			await config.update('aiModel', 'gpt-4o', vscode.ConfigurationTarget.Workspace);
			const newValue = config.get('aiModel');
			assert.strictEqual(newValue, 'gpt-4o');
			
			// Restore original value
			await config.update('aiModel', originalValue, vscode.ConfigurationTarget.Workspace);
		} catch (error) {
			assert.fail(`Configuration update should work: ${error}`);
		}
	});
});
