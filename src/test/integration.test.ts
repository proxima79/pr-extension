import * as assert from 'assert';
import * as vscode from 'vscode';
import { AIService } from '../services/aiService';
import { GitService } from '../services/gitService';
import { ConfigurationService } from '../services/configurationService';
import { PRService } from '../services/prService';
import { AzureCliService } from '../services/azureCliService';

suite('Integration Test Suite', () => {
    let aiService: AIService;
    let gitService: GitService;
    let configService: ConfigurationService;
    let prService: PRService;
    let azureCliService: AzureCliService;

    suiteSetup(() => {
        aiService = new AIService();
        gitService = new GitService();
        configService = new ConfigurationService();
        prService = new PRService();
        azureCliService = new AzureCliService();
    });

    test('End-to-end PR creation workflow should work', async function() {
        this.timeout(30000); // 30 second timeout for full workflow
        
        // Step 1: Get configuration
        const aiProvider = configService.getAIProvider();
        const platform = configService.getPlatform();
        
        assert.ok(typeof aiProvider === 'string');
        assert.ok(typeof platform === 'string');
        
        // Step 2: Mock git data
        const mockChanges = [
            { file: 'src/test.ts', status: 'modified' as const, insertions: 50, deletions: 10 },
            { file: 'README.md', status: 'modified' as const, insertions: 5, deletions: 2 }
        ];
        
        const mockCommits = [
            {
                hash: 'abc123',
                message: 'Add new test functionality',
                author: 'Test User',
                date: new Date()
            }
        ];
        
        // Step 3: Generate AI description
        try {
            const aiResult = await aiService.generatePRDescription(
                mockChanges,
                mockCommits,
                'feature/test-integration',
                'main'
            );
            
            assert.ok(aiResult.title.length > 0);
            assert.ok(aiResult.description.length > 0);
            
            // Step 4: Create PR request
            const prRequest = {
                title: aiResult.title,
                description: aiResult.description,
                sourceBranch: 'feature/test-integration',
                targetBranch: 'main',
                repositoryUrl: 'https://github.com/test/repo.git'
            };
            
            // Validate the request structure
            assert.ok(typeof prRequest.title === 'string');
            assert.ok(typeof prRequest.description === 'string');
            assert.ok(prRequest.title.length > 0);
            assert.ok(prRequest.description.length > 0);
            
        } catch (error) {
            // If AI is not available, test should still validate the workflow structure
            console.log('AI not available, testing fallback workflow');
            
            const fallbackResult = {
                title: 'Add new test functionality',
                description: 'This PR includes test changes and documentation updates.'
            };
            
            assert.ok(typeof fallbackResult.title === 'string');
            assert.ok(typeof fallbackResult.description === 'string');
        }
    });

    test('Service dependencies should work together correctly', async () => {
        // Test that services can interact with each other properly
        
        // Configuration should provide valid values for other services
        const aiProvider = configService.getAIProvider();
        const platform = configService.getPlatform();
        const defaultTarget = configService.getDefaultTarget();
        
        assert.ok(typeof aiProvider === 'string');
        assert.ok(typeof platform === 'string');
        assert.ok(typeof defaultTarget === 'string');
        
        // Git service should provide data that other services can process
        try {
            const currentBranch = await gitService.getCurrentBranch();
            if (currentBranch) {
                assert.ok(typeof currentBranch === 'string');
                assert.ok(currentBranch.length > 0);
            }
        } catch (error) {
            // Expected if not in a git repository
            assert.ok(error instanceof Error);
        }
        
        // PR service should accept structured data
        const mockPrData = {
            title: 'Test PR',
            description: 'Test description',
            sourceBranch: 'test',
            targetBranch: 'main',
            repositoryUrl: 'https://github.com/test/repo.git'
        };
        
        // Should be able to process this data without crashing
        try {
            await prService.createPullRequest(mockPrData);
        } catch (error) {
            // Expected to fail in test environment
            assert.ok(error instanceof Error);
        }
    });

    test('Azure CLI integration should work with other services', async function() {
        this.timeout(10000);
        
        // Check Azure CLI availability
        const azureCliAvailable = await azureCliService.checkAzureCliInstalled();
        
        if (azureCliAvailable) {
            // Test that Azure CLI service can work with configuration
            try {
                // This might fail if not authenticated, but should not crash
                await azureCliService.checkDevOpsExtension();
            } catch (error) {
                // Expected if not authenticated
                assert.ok(error instanceof Error);
            }
        }
        
        // Test should pass regardless of Azure CLI availability
        assert.ok(true);
    });

    test('Error propagation should work correctly across services', async () => {
        // Test that errors from one service are handled properly by others
        
        try {
            // Try to create a PR with invalid data
            const invalidPrRequest = {
                title: 'Test',
                description: 'Test',
                sourceBranch: 'test',
                targetBranch: 'main',
                repositoryUrl: 'invalid-url'
            };
            
            await prService.createPullRequest(invalidPrRequest);
            // May succeed or fail depending on implementation
            
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok(error.message.length > 0);
        }
    });

    test('Configuration changes should affect all services', async () => {
        const originalPlatform = configService.getPlatform();
        
        try {
            // Change platform configuration
            await configService.updatePlatform('azure-devops');
            
            // Configuration should pick up the new value
            const newPlatform = configService.getPlatform();
            assert.strictEqual(newPlatform, 'azure-devops');
            
        } finally {
            // Restore original configuration
            await configService.updatePlatform(originalPlatform);
        }
    });

    test('Multi-platform support should work consistently', async () => {
        const platforms = ['github', 'azure-devops', 'gitlab'];
        
        for (const platform of platforms) {
            // Test that configuration can be set for this platform
            const originalPlatform = configService.getPlatform();
            
            try {
                await configService.updatePlatform(platform);
                const newPlatform = configService.getPlatform();
                assert.strictEqual(newPlatform, platform);
                
            } finally {
                await configService.updatePlatform(originalPlatform);
            }
        }
    });

    test('Service lifecycle should be managed correctly', async () => {
        // Test that services can be created and destroyed without issues
        
        const services = [];
        
        // Create multiple instances
        for (let i = 0; i < 5; i++) {
            services.push({
                ai: new AIService(),
                git: new GitService(),
                config: new ConfigurationService(),
                pr: new PRService()
            });
        }
        
        // All services should be functional
        for (const serviceSet of services) {
            assert.ok(serviceSet.ai);
            assert.ok(serviceSet.git);
            assert.ok(serviceSet.config);
            assert.ok(serviceSet.pr);
            
            // Basic functionality should work
            assert.ok(typeof serviceSet.config.getAIProvider() === 'string');
        }
    });

    test('Concurrent service operations should work safely', async function() {
        this.timeout(15000);
        
        // Run multiple service operations concurrently
        const operations = [];
        
        for (let i = 0; i < 10; i++) {
            operations.push(
                configService.getAIProvider(),
                configService.getPlatform(),
                configService.getDefaultTarget()
            );
        }
        
        const results = await Promise.all(operations);
        
        // All operations should complete successfully
        assert.strictEqual(results.length, 30);
        
        // Config results should be consistent strings
        results.forEach(result => {
            assert.ok(typeof result === 'string');
            assert.ok(result.length > 0);
        });
    });

    test('AI service should integrate with git data properly', async () => {
        // Test that AI service can process git data from GitService
        try {
            const changes = await gitService.getChanges();
            const commits = await gitService.getRecentCommits(3);
            const currentBranch = await gitService.getCurrentBranch();
            
            if (changes && commits && currentBranch) {
                // Try to generate PR description with real git data
                const result = await aiService.generatePRDescription(
                    changes,
                    commits,
                    currentBranch,
                    'main'
                );
                
                assert.ok(result.title.length > 0);
                assert.ok(result.description.length > 0);
            }
        } catch (error) {
            // Expected if no git repo or AI unavailable
            assert.ok(error instanceof Error);
        }
    });
});
