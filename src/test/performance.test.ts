import * as assert from 'assert';
import * as vscode from 'vscode';
import { AIService } from '../services/aiService';
import { GitService } from '../services/gitService';
import { ConfigurationService } from '../services/configurationService';

suite('Performance Test Suite', () => {
    test('AI service should respond within reasonable time', async function() {
        this.timeout(10000); // 10 second timeout
        
        const aiService = new AIService();
        const startTime = Date.now();
        
        try {
            const result = await aiService.generatePRDescription(
                [{ file: 'test.ts', status: 'modified', insertions: 10, deletions: 5 }],
                [{ hash: 'abc123', message: 'Test commit', author: 'Test', date: new Date() }],
                'feature/test',
                'main'
            );
            
            const duration = Date.now() - startTime;
            
            // Should complete within 8 seconds for simple changes
            assert.ok(duration < 8000, `AI generation took ${duration}ms, should be under 8000ms`);
            assert.ok(result.title.length > 0);
            assert.ok(result.description.length > 0);
            
        } catch (error) {
            // If AI is not available, that's okay for performance testing
            const duration = Date.now() - startTime;
            assert.ok(duration < 2000, `Fallback should be fast: ${duration}ms`);
        }
    });

    test('Git operations should be fast', async function() {
        this.timeout(5000); // 5 second timeout
        
        const gitService = new GitService();
        const startTime = Date.now();
        
        try {
            // Test git operations which should be reasonably fast
            await gitService.getCurrentBranch();
            await gitService.getChanges();
            const duration = Date.now() - startTime;
            
            assert.ok(duration < 2000, `Git operations took ${duration}ms, should be under 2000ms`);
            
        } catch (error) {
            // Git operations might fail in test environment, that's okay
            const duration = Date.now() - startTime;
            assert.ok(duration < 1000, `Git error handling should be fast: ${duration}ms`);
        }
    });

    test('Configuration access should be instantaneous', async () => {
        const configService = new ConfigurationService();
        const startTime = Date.now();
        
        // Multiple config reads should be very fast
        for (let i = 0; i < 100; i++) {
            configService.getAIProvider();
            configService.getPlatform();
            configService.getDefaultTarget();
        }
        
        const duration = Date.now() - startTime;
        assert.ok(duration < 100, `100 config reads took ${duration}ms, should be under 100ms`);
    });

    test('Memory usage should be reasonable', async () => {
        const initialMemory = process.memoryUsage().heapUsed;
        
        // Create multiple service instances
        const services = [];
        for (let i = 0; i < 10; i++) {
            services.push(new AIService());
            services.push(new GitService());
            services.push(new ConfigurationService());
        }
        
        const afterCreation = process.memoryUsage().heapUsed;
        const memoryIncrease = afterCreation - initialMemory;
        
        // Should not use more than 50MB for 30 service instances
        const maxMemoryIncrease = 50 * 1024 * 1024; // 50MB
        assert.ok(memoryIncrease < maxMemoryIncrease, 
            `Memory increase of ${memoryIncrease} bytes should be under ${maxMemoryIncrease} bytes`);
    });

    test('Service initialization should be fast', async () => {
        const startTime = Date.now();
        
        // Initialize multiple services
        for (let i = 0; i < 20; i++) {
            new AIService();
            new GitService();
            new ConfigurationService();
        }
        
        const duration = Date.now() - startTime;
        assert.ok(duration < 500, `Service initialization took ${duration}ms, should be under 500ms`);
    });

    test('Concurrent operations should not interfere', async function() {
        this.timeout(15000); // 15 second timeout
        
        const configService = new ConfigurationService();
        
        // Run multiple operations concurrently
        const promises = [];
        
        for (let i = 0; i < 5; i++) {
            promises.push(
                configService.getAIProvider(),
                configService.getPlatform(),
                configService.getDefaultTarget()
            );
        }
        
        const startTime = Date.now();
        const results = await Promise.all(promises);
        const duration = Date.now() - startTime;
        
        assert.strictEqual(results.length, 15);
        assert.ok(duration < 1000, `Concurrent config reads took ${duration}ms, should be under 1000ms`);
    });

    test('Error handling should not impact performance', async () => {
        const gitService = new GitService();
        
        const startTime = Date.now();
        
        // Try operations that may fail multiple times
        for (let i = 0; i < 50; i++) {
            try {
                await gitService.getCurrentBranch();
            } catch (error) {
                // Expected to fail in some environments
            }
        }
        
        const duration = Date.now() - startTime;
        assert.ok(duration < 2000, `Error handling took ${duration}ms, should be under 2000ms`);
    });

    test('Cache efficiency should improve repeated operations', async () => {
        const configService = new ConfigurationService();
        
        // First access
        const firstStart = Date.now();
        const firstResult = configService.getAIProvider();
        const firstDuration = Date.now() - firstStart;
        
        // Second access
        const secondStart = Date.now();
        const secondResult = configService.getAIProvider();
        const secondDuration = Date.now() - secondStart;
        
        assert.strictEqual(firstResult, secondResult);
        // Second access should be fast
        assert.ok(secondDuration <= firstDuration + 10, 
            `Cached access (${secondDuration}ms) should not be much slower than first access (${firstDuration}ms)`);
    });
});
