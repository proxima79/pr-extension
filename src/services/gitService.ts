import * as vscode from 'vscode';
import { simpleGit, SimpleGit, StatusResult } from 'simple-git';
import * as path from 'path';

export interface GitChange {
    file: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed';
    insertions?: number;
    deletions?: number;
}

export interface GitCommit {
    hash: string;
    message: string;
    author: string;
    date: Date;
}

export interface RepositoryInfo {
    remoteUrl: string;
    rootPath: string;
    platform: 'github' | 'azure-devops' | 'gitlab' | 'unknown';
}

export class GitService {
    private git: SimpleGit | null = null;

    private async getGit(): Promise<SimpleGit | null> {
        if (this.git) {
            return this.git;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return null;
        }

        try {
            this.git = simpleGit(workspaceFolder.uri.fsPath);
            const isRepo = await this.git.checkIsRepo();
            if (!isRepo) {
                return null;
            }
            return this.git;
        } catch (error) {
            console.error('Error initializing git:', error);
            return null;
        }
    }

    async getRepositoryInfo(): Promise<RepositoryInfo | null> {
        const git = await this.getGit();
        if (!git) {
            return null;
        }

        try {
            const remotes = await git.getRemotes(true);
            const origin = remotes.find(r => r.name === 'origin');
            
            if (!origin?.refs?.fetch) {
                throw new Error('No origin remote found');
            }

            const remoteUrl = origin.refs.fetch;
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            
            return {
                remoteUrl,
                rootPath: workspaceFolder?.uri.fsPath || '',
                platform: this.detectPlatform(remoteUrl)
            };
        } catch (error) {
            console.error('Error getting repository info:', error);
            return null;
        }
    }

    private detectPlatform(remoteUrl: string): 'github' | 'azure-devops' | 'gitlab' | 'unknown' {
        if (remoteUrl.includes('github.com')) {
            return 'github';
        } else if (remoteUrl.includes('dev.azure.com') || remoteUrl.includes('visualstudio.com')) {
            return 'azure-devops';
        } else if (remoteUrl.includes('gitlab.com') || remoteUrl.includes('gitlab')) {
            return 'gitlab';
        }
        return 'unknown';
    }

    async getCurrentBranch(): Promise<string> {
        const git = await this.getGit();
        if (!git) {
            throw new Error('No git repository found');
        }

        try {
            const status = await git.status();
            return status.current || 'main';
        } catch (error) {
            console.error('Error getting current branch:', error);
            throw error;
        }
    }

    async getChanges(): Promise<GitChange[]> {
        const git = await this.getGit();
        if (!git) {
            return [];
        }

        try {
            const status = await git.status();
            const changes: GitChange[] = [];

            // Process different types of changes
            status.created.forEach(file => {
                changes.push({ file, status: 'added' });
            });

            status.modified.forEach(file => {
                changes.push({ file, status: 'modified' });
            });

            status.deleted.forEach(file => {
                changes.push({ file, status: 'deleted' });
            });

            status.renamed.forEach(file => {
                changes.push({ file: file.to || file.from, status: 'renamed' });
            });

            return changes;
        } catch (error) {
            console.error('Error getting changes:', error);
            return [];
        }
    }

    async getRecentCommits(limit: number = 10): Promise<GitCommit[]> {
        const git = await this.getGit();
        if (!git) {
            return [];
        }

        try {
            const log = await git.log({ maxCount: limit });
            return log.all.map(commit => ({
                hash: commit.hash,
                message: commit.message,
                author: commit.author_name,
                date: new Date(commit.date)
            }));
        } catch (error) {
            console.error('Error getting commits:', error);
            return [];
        }
    }

    async getDiffStats(): Promise<{ insertions: number; deletions: number }> {
        const git = await this.getGit();
        if (!git) {
            return { insertions: 0, deletions: 0 };
        }

        try {
            const diff = await git.diff(['--stat']);
            const lines = diff.split('\n');
            const summaryLine = lines[lines.length - 2]; // Last non-empty line usually contains summary
            
            let insertions = 0;
            let deletions = 0;

            if (summaryLine) {
                const insertionMatch = summaryLine.match(/(\d+) insertion/);
                const deletionMatch = summaryLine.match(/(\d+) deletion/);
                
                if (insertionMatch) {
                    insertions = parseInt(insertionMatch[1]);
                }
                if (deletionMatch) {
                    deletions = parseInt(deletionMatch[1]);
                }
            }

            return { insertions, deletions };
        } catch (error) {
            console.error('Error getting diff stats:', error);
            return { insertions: 0, deletions: 0 };
        }
    }

    async getFileContent(filePath: string): Promise<string> {
        const git = await this.getGit();
        if (!git) {
            throw new Error('No git repository found');
        }

        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder found');
            }

            const fullPath = path.join(workspaceFolder.uri.fsPath, filePath);
            const document = await vscode.workspace.openTextDocument(fullPath);
            return document.getText();
        } catch (error) {
            console.error('Error reading file content:', error);
            return '';
        }
    }
}
