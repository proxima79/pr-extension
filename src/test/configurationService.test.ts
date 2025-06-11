import * as assert from 'assert';
import * as vscode from 'vscode';
import { ConfigurationService } from '../services/configurationService';

suite('ConfigurationService Test Suite', () => {
    let configService: ConfigurationService;

    setup(() => {
        configService = new ConfigurationService();
    });

    test('should get AI provider configuration', async () => {
        const aiProvider = configService.getAIProvider();
        assert.ok(typeof aiProvider === 'string');
        // Should be a valid provider or default to 'openai'
        const validProviders = ['openai', 'copilot', 'anthropic', 'azure-openai'];
        assert.ok(validProviders.includes(aiProvider) || aiProvider === 'openai');
    });

    test('should get platform configuration', async () => {
        const platform = configService.getPlatform();
        assert.ok(typeof platform === 'string');
        // Should be a valid platform or default to 'github'
        const validPlatforms = ['github', 'azure-devops', 'gitlab'];
        assert.ok(validPlatforms.includes(platform) || platform === 'github');
    });

    test('should get default target branch', async () => {
        const defaultTarget = configService.getDefaultTarget();
        assert.ok(typeof defaultTarget === 'string');
        assert.ok(defaultTarget.length > 0);
    });

    test('should get file changes inclusion setting', async () => {
        const includeFileChanges = configService.shouldIncludeFileChanges();
        assert.ok(typeof includeFileChanges === 'boolean');
    });

    test('should get max files to analyze setting', async () => {
        const maxFiles = configService.getMaxFilesToAnalyze();
        assert.ok(typeof maxFiles === 'number');
        assert.ok(maxFiles > 0);
    });

    test('should handle missing configuration gracefully', async () => {
        const nonExistentValue = configService.get('nonExistentKey');
        assert.strictEqual(nonExistentValue, undefined);
    });

    test('should update configuration values', async () => {
        const originalTarget = configService.getDefaultTarget();
        
        try {
            await configService.updateDefaultTarget('develop');
            const newTarget = configService.getDefaultTarget();
            assert.strictEqual(newTarget, 'develop');
        } finally {
            // Restore original value
            await configService.updateDefaultTarget(originalTarget);
        }
    });

    test('should update AI provider configuration', async () => {
        const originalProvider = configService.getAIProvider();
        
        try {
            await configService.updateAIProvider('copilot');
            const newProvider = configService.getAIProvider();
            assert.strictEqual(newProvider, 'copilot');
        } finally {
            await configService.updateAIProvider(originalProvider);
        }
    });

    test('should update platform configuration', async () => {
        const originalPlatform = configService.getPlatform();
        
        try {
            await configService.updatePlatform('azure-devops');
            const newPlatform = configService.getPlatform();
            assert.strictEqual(newPlatform, 'azure-devops');
        } finally {
            await configService.updatePlatform(originalPlatform);
        }
    });

    test('should get all configuration as object', async () => {
        const allConfig = configService.getAllConfig();
        
        assert.ok(typeof allConfig === 'object');
        assert.ok(typeof allConfig.defaultTarget === 'string');
        assert.ok(typeof allConfig.aiProvider === 'string');
        assert.ok(typeof allConfig.platform === 'string');
        assert.ok(typeof allConfig.includeFileChanges === 'boolean');
        assert.ok(typeof allConfig.maxFilesToAnalyze === 'number');
    });

    test('should handle configuration change events', async () => {
        let changeDetected = false;
        
        const disposable = configService.onConfigurationChanged(() => {
            changeDetected = true;
        });
        
        try {
            // Trigger a configuration change
            await configService.updateDefaultTarget('test-branch');
            
            // Give it a moment to process
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Change should be detected
            assert.ok(changeDetected);
        } finally {
            disposable.dispose();
            // Restore default
            await configService.updateDefaultTarget('main');
        }
    });

    test('should provide consistent configuration values', async () => {
        // Multiple calls should return consistent values
        const provider1 = configService.getAIProvider();
        const provider2 = configService.getAIProvider();
        const provider3 = configService.getAIProvider();
        
        assert.strictEqual(provider1, provider2);
        assert.strictEqual(provider2, provider3);
        
        const platform1 = configService.getPlatform();
        const platform2 = configService.getPlatform();
        
        assert.strictEqual(platform1, platform2);
    });
});
