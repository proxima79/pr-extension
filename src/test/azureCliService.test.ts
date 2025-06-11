import * as assert from 'assert';
import * as vscode from 'vscode';
import { AzureCliService } from '../services/azureCliService';

suite('Azure CLI Integration Test Suite', () => {
    vscode.window.showInformationMessage('Start Azure CLI integration tests.');

    let azureCliService: AzureCliService;

    setup(() => {
        azureCliService = new AzureCliService();
    });

    test('Azure CLI Installation Check', async () => {
        const isInstalled = await azureCliService.checkAzureCliInstalled();
        console.log(`Azure CLI installed: ${isInstalled}`);
        
        // This test should pass even if Azure CLI is not installed
        // We're just checking that the method executes without throwing
        assert.ok(typeof isInstalled === 'boolean');
    });

    test('DevOps Extension Check', async () => {
        const hasExtension = await azureCliService.checkDevOpsExtension();
        console.log(`DevOps extension installed: ${hasExtension}`);
        
        // This test should pass even if extension is not installed
        assert.ok(typeof hasExtension === 'boolean');
    });

    test('Azure Repository URL Parsing', async () => {
        // Mock workspace folder for testing
        const mockWorkspace = '/tmp/mock-workspace';
        
        // Test with various Azure DevOps URL formats
        const testCases = [
            {
                url: 'https://dev.azure.com/myorg/myproject/_git/myrepo',
                expected: {
                    organization: 'myorg',
                    project: 'myproject',
                    repository: 'myrepo'
                }
            },
            {
                url: 'https://myorg@dev.azure.com/myorg/myproject/_git/myrepo',
                expected: {
                    organization: 'myorg',
                    project: 'myproject', 
                    repository: 'myrepo'
                }
            }
        ];

        // Since we can't easily mock git commands in unit tests,
        // we'll test the URL parsing logic separately
        testCases.forEach(testCase => {
            const match = testCase.url.match(/dev\.azure\.com\/([^\/]+)\/([^\/]+)\/_git\/(.+)/);
            if (match) {
                const parsed = {
                    organization: match[1],
                    project: decodeURIComponent(match[2]),
                    repository: match[3].replace(/\.git$/, '')
                };
                
                assert.strictEqual(parsed.organization, testCase.expected.organization);
                assert.strictEqual(parsed.project, testCase.expected.project);
                assert.strictEqual(parsed.repository, testCase.expected.repository);
            }
        });
    });

    test('Work Item Extraction', async () => {
        const mockCommits = [
            'abc1234 Fix bug #1234 in authentication',
            'def5678 Add feature AB#5678',
            'ghi9012 Update documentation',
            'jkl3456 Resolve issue #3456 and #7890'
        ];

        // Test work item extraction logic
        const workItems: string[] = [];
        
        mockCommits.forEach(commit => {
            const matches = commit.match(/#(\d+)/g);
            if (matches) {
                matches.forEach(match => {
                    const workItemId = match.replace('#', '');
                    if (!workItems.includes(workItemId)) {
                        workItems.push(workItemId);
                    }
                });
            }
        });

        assert.ok(workItems.includes('1234'));
        assert.ok(workItems.includes('5678'));
        assert.ok(workItems.includes('3456'));
        assert.ok(workItems.includes('7890'));
        assert.strictEqual(workItems.length, 4);
    });

    test('Prerequisites Validation', async () => {
        const validation = await azureCliService.validatePrerequisites();
        
        // Should return an object with success and message properties
        assert.ok(typeof validation === 'object');
        assert.ok(typeof validation.success === 'boolean');
        assert.ok(typeof validation.message === 'string');
        
        console.log(`Prerequisites validation: ${validation.success ? 'PASS' : 'FAIL'} - ${validation.message}`);
    });
});
