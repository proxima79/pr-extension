import * as assert from 'assert';
import * as vscode from 'vscode';
import { AIService } from '../services/aiService';
import { GitChange, GitCommit } from '../services/gitService';

// Mock the vscode.lm API
const mockChatResponse = {
    text: (async function* () {
        yield 'TITLE: Add GitHub Copilot integration for PR descriptions\n\n';
        yield 'DESCRIPTION:\n';
        yield '## Summary\n';
        yield 'This PR integrates GitHub Copilot to automatically generate meaningful pull request descriptions.\n\n';
        yield '## Changes Made\n';
        yield '- Added AI service with Copilot integration\n';
        yield '- Updated package.json configuration\n';
        yield '- Fixed TypeScript compilation errors\n\n';
        yield '## Testing\n';
        yield 'Manual testing with various code changes and commit histories.\n\n';
        yield '## Additional Notes\n';
        yield 'This enhancement will significantly improve the quality of PR descriptions by leveraging AI.';
    })()
};

const mockModel = {
    name: 'copilot-gpt-4o',
    id: 'copilot-gpt-4o',
    vendor: 'copilot',
    family: 'gpt-4o',
    version: '1.0.0',
    maxInputTokens: 8192,
    sendRequest: async () => mockChatResponse,
    countTokens: async () => 100
};

// Mock vscode.lm.selectChatModels
const originalSelectChatModels = vscode.lm?.selectChatModels;

suite('AIService Test Suite', () => {
    let aiService: AIService;
    
    const sampleChanges: GitChange[] = [
        {
            file: 'src/services/aiService.ts',
            status: 'modified',
            insertions: 150,
            deletions: 20
        },
        {
            file: 'package.json',
            status: 'modified',
            insertions: 5,
            deletions: 1
        },
        {
            file: 'src/test/aiService.test.ts',
            status: 'added',
            insertions: 80,
            deletions: 0
        }
    ];

    const sampleCommits: GitCommit[] = [
        {
            hash: 'abc123def456',
            message: 'Add GitHub Copilot integration for PR descriptions',
            author: 'Test Author',
            date: new Date('2025-06-11')
        },
        {
            hash: 'def456ghi789',
            message: 'Fix TypeScript compilation errors in aiService',
            author: 'Test Author',
            date: new Date('2025-06-11')
        }
    ];

    setup(() => {
        aiService = new AIService();
        
        // Mock vscode.lm.selectChatModels if it exists
        if (vscode.lm) {
            vscode.lm.selectChatModels = async () => [mockModel as any];
        }
    });

    teardown(() => {
        // Restore original function if it exists
        if (vscode.lm && originalSelectChatModels) {
            vscode.lm.selectChatModels = originalSelectChatModels;
        }
    });

    test('generatePRDescription should return valid description', async () => {
        const result = await aiService.generatePRDescription(
            sampleChanges,
            sampleCommits,
            'feature/copilot-integration',
            'main'
        );

        assert.ok(result.title, 'Title should be present');
        assert.ok(result.description, 'Description should be present');
        assert.ok(result.title.length > 0, 'Title should not be empty');
        assert.ok(result.description.length > 0, 'Description should not be empty');
    });

    test('generatePRDescription should handle empty changes gracefully', async () => {
        const result = await aiService.generatePRDescription(
            [],
            [],
            'empty-branch',
            'main'
        );

        assert.ok(result.title, 'Should generate fallback title');
        assert.ok(result.description, 'Should generate fallback description');
    });

    test('analyzeBranchChanges should return comprehensive analysis', async () => {
        const result = await aiService.analyzeBranchChanges(
            sampleChanges,
            sampleCommits,
            'feature/copilot-integration'
        );

        assert.ok(result.summary, 'Summary should be present');
        assert.ok(result.suggestedTitle, 'Suggested title should be present');
        assert.ok(result.suggestedDescription, 'Suggested description should be present');
        assert.ok(Array.isArray(result.keyChanges), 'Key changes should be an array');
        assert.ok(Array.isArray(result.recommendations), 'Recommendations should be an array');
    });

    test('analyzeBranchChanges should identify file types correctly', async () => {
        const mixedChanges: GitChange[] = [
            { file: 'src/component.tsx', status: 'added' },
            { file: 'README.md', status: 'modified' },
            { file: 'package.json', status: 'modified' },
            { file: 'styles.css', status: 'added' }
        ];

        const result = await aiService.analyzeBranchChanges(
            mixedChanges,
            sampleCommits,
            'feature/mixed-changes'
        );

        // The analysis should recognize different file types
        assert.ok(result.summary.includes('file'), 'Summary should mention files');
        assert.ok(result.keyChanges.length > 0, 'Should identify key changes');
    });

    test('should handle Copilot unavailable gracefully', async () => {
        // Mock Copilot as unavailable
        if (vscode.lm) {
            vscode.lm.selectChatModels = async () => [];
        }

        const result = await aiService.generatePRDescription(
            sampleChanges,
            sampleCommits,
            'feature/test',
            'main'
        );

        // Should fall back to basic description generation
        assert.ok(result.title, 'Should generate fallback title');
        assert.ok(result.description, 'Should generate fallback description');
    });

    test('should provide meaningful recommendations', async () => {
        const manyChanges: GitChange[] = Array.from({ length: 25 }, (_, i) => ({
            file: `src/file${i}.ts`,
            status: 'modified' as const
        }));

        const result = await aiService.analyzeBranchChanges(
            manyChanges,
            sampleCommits,
            'feature/large-change'
        );

        // Should recommend breaking into smaller PRs for large changes
        const hasBreakupRecommendation = result.recommendations.some(r => 
            r.includes('smaller') || r.includes('break')
        );
        assert.ok(hasBreakupRecommendation, 'Should recommend breaking up large PRs');
    });
});
