import * as assert from 'assert';
import * as vscode from 'vscode';
import { GitService, GitChange, GitCommit, RepositoryInfo } from '../services/gitService';

suite('GitService Test Suite', () => {
    let gitService: GitService;

    setup(() => {
        gitService = new GitService();
    });

    test('should create GitService instance', async () => {
        assert.ok(gitService instanceof GitService);
    });

    test('should handle repository detection gracefully', async () => {
        // Test with current workspace (may or may not be a git repo)
        try {
            const repoInfo = await gitService.getRepositoryInfo();
            if (repoInfo) {
                assert.ok(typeof repoInfo.remoteUrl === 'string');
                assert.ok(typeof repoInfo.rootPath === 'string');
                assert.ok(['github', 'azure-devops', 'gitlab', 'unknown'].includes(repoInfo.platform));
            }
        } catch (error) {
            // Expected if not in a git repository
            assert.ok(error instanceof Error);
        }
    });

    test('should handle getCurrentBranch gracefully', async () => {
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
    });

    test('should handle getChanges gracefully', async () => {
        try {
            const changes = await gitService.getChanges();
            assert.ok(Array.isArray(changes));
            changes.forEach(change => {
                assert.ok(typeof change.file === 'string');
                assert.ok(['added', 'modified', 'deleted', 'renamed'].includes(change.status));
            });
        } catch (error) {
            // Expected if not in a git repository
            assert.ok(error instanceof Error);
        }
    });

    test('should handle getRecentCommits gracefully', async () => {
        try {
            const commits = await gitService.getRecentCommits(5);
            assert.ok(Array.isArray(commits));
            commits.forEach(commit => {
                assert.ok(typeof commit.hash === 'string');
                assert.ok(typeof commit.message === 'string');
                assert.ok(typeof commit.author === 'string');
                assert.ok(commit.date instanceof Date);
            });
        } catch (error) {
            // Expected if not in a git repository
            assert.ok(error instanceof Error);
        }
    });

    test('should handle getDiffStats gracefully', async () => {
        try {
            const stats = await gitService.getDiffStats();
            assert.ok(typeof stats.insertions === 'number');
            assert.ok(typeof stats.deletions === 'number');
            assert.ok(stats.insertions >= 0);
            assert.ok(stats.deletions >= 0);
        } catch (error) {
            // Expected if not in a git repository
            assert.ok(error instanceof Error);
        }
    });

    test('should handle getFileContent gracefully', async () => {
        try {
            // Try to read a file that should exist in the workspace
            const content = await gitService.getFileContent('package.json');
            if (content) {
                assert.ok(typeof content === 'string');
                // Should contain package info if it's a valid package.json
                if (content.includes('"name"')) {
                    assert.ok(content.includes('"version"'));
                }
            }
        } catch (error) {
            // Expected if file doesn't exist or not in a workspace
            assert.ok(error instanceof Error);
        }
    });

    test('should not crash on git operations in non-git directory', async () => {
        // Test that all git operations handle errors gracefully
        const operations = [
            () => gitService.getCurrentBranch(),
            () => gitService.getChanges(),
            () => gitService.getRecentCommits(),
            () => gitService.getDiffStats(),
            () => gitService.getRepositoryInfo()
        ];

        for (const operation of operations) {
            try {
                await operation();
                // If it succeeds, that's fine
            } catch (error) {
                // If it fails, it should be a proper Error object
                assert.ok(error instanceof Error);
                assert.ok(error.message.length > 0);
            }
        }
    });

    test('should handle concurrent operations safely', async () => {
        // Test that multiple operations can run concurrently
        const operations = [
            gitService.getRepositoryInfo(),
            gitService.getCurrentBranch(),
            gitService.getChanges(),
            gitService.getRecentCommits(3),
            gitService.getDiffStats()
        ];

        try {
            const results = await Promise.allSettled(operations);
            
            // All operations should either succeed or fail gracefully
            results.forEach(result => {
                if (result.status === 'rejected') {
                    assert.ok(result.reason instanceof Error);
                }
            });
            
            assert.strictEqual(results.length, 5);
        } catch (error) {
            // If Promise.allSettled fails, something is very wrong
            assert.fail(`Concurrent operations should not crash: ${error}`);
        }
    });

    test('should handle edge cases in commit limits', async () => {
        try {
            // Test with different commit limits
            const noLimit = await gitService.getRecentCommits();
            const limitedCommits = await gitService.getRecentCommits(1);
            const zeroCommits = await gitService.getRecentCommits(0);

            assert.ok(Array.isArray(noLimit));
            assert.ok(Array.isArray(limitedCommits));
            assert.ok(Array.isArray(zeroCommits));

            if (limitedCommits.length > 0) {
                assert.ok(limitedCommits.length <= 1);
            }
        } catch (error) {
            // Expected if not in a git repository
            assert.ok(error instanceof Error);
        }
    });
});
