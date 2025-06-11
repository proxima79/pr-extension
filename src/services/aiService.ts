import * as vscode from 'vscode';
import { GitChange, GitCommit } from './gitService';

export interface PRDescription {
    title: string;
    description: string;
}

export interface BranchAnalysis {
    summary: string;
    suggestedTitle: string;
    suggestedDescription: string;
    keyChanges: string[];
    recommendations: string[];
}

export class AIService {
    private apiKey: string | null = null;
    private provider: string = 'openai';

    constructor() {
        this.loadConfiguration();
    }

    private loadConfiguration() {
        const config = vscode.workspace.getConfiguration('smartPrCreator');
        this.provider = config.get<string>('aiProvider') || 'openai';
        
        // Try to get API key from environment variables or secure storage
        this.apiKey = process.env.OPENAI_API_KEY || null;
    }

    async generatePRDescription(
        changes: GitChange[],
        commits: GitCommit[],
        sourceBranch: string,
        targetBranch: string
    ): Promise<PRDescription> {
        try {
            // If no API key, provide a fallback
            if (!this.apiKey) {
                return this.generateFallbackDescription(changes, commits, sourceBranch, targetBranch);
            }

            // Prepare context for AI
            const context = this.prepareContext(changes, commits, sourceBranch, targetBranch);
            
            // Generate description using AI (mock implementation for now)
            const aiResponse = await this.callAIProvider(context);
            
            return {
                title: aiResponse.title || this.generateFallbackTitle(commits, sourceBranch),
                description: aiResponse.description || this.generateFallbackDescription(changes, commits, sourceBranch, targetBranch).description
            };
        } catch (error) {
            console.error('Error generating AI description:', error);
            return this.generateFallbackDescription(changes, commits, sourceBranch, targetBranch);
        }
    }

    async analyzeBranchChanges(
        changes: GitChange[],
        commits: GitCommit[],
        branchName: string
    ): Promise<BranchAnalysis> {
        try {
            const fileCount = changes.length;
            const commitCount = commits.length;
            
            // Analyze file types
            const fileTypes = this.analyzeFileTypes(changes);
            const keyChanges = this.identifyKeyChanges(changes, commits);
            
            return {
                summary: `Branch '${branchName}' contains ${commitCount} commit(s) affecting ${fileCount} file(s). Primary changes involve ${fileTypes.join(', ')}.`,
                suggestedTitle: this.generateFallbackTitle(commits, branchName),
                suggestedDescription: this.generateDetailedDescription(changes, commits, fileTypes),
                keyChanges,
                recommendations: this.generateRecommendations(changes, commits)
            };
        } catch (error) {
            console.error('Error analyzing branch:', error);
            return {
                summary: `Analysis completed for branch '${branchName}'`,
                suggestedTitle: `Update from ${branchName}`,
                suggestedDescription: 'Changes made to improve the codebase',
                keyChanges: [],
                recommendations: []
            };
        }
    }

    private async callAIProvider(context: string): Promise<{ title: string; description: string }> {
        // Mock AI response - in a real implementation, this would call OpenAI, Azure OpenAI, etc.
        // For demonstration purposes, we'll return a structured response
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const lines = context.split('\n');
        const hasNewFiles = lines.some(line => line.includes('added:'));
        const hasModifications = lines.some(line => line.includes('modified:'));
        const hasFeatures = lines.some(line => line.toLowerCase().includes('feature') || line.toLowerCase().includes('add'));
        const hasFixes = lines.some(line => line.toLowerCase().includes('fix') || line.toLowerCase().includes('bug'));
        
        let title = 'Code improvements';
        let description = 'This PR contains various improvements to the codebase.';
        
        if (hasFeatures && hasFixes) {
            title = 'Feature additions and bug fixes';
            description = 'This PR includes new features and resolves existing issues.';
        } else if (hasFeatures) {
            title = 'Add new features';
            description = 'This PR introduces new functionality to enhance the application.';
        } else if (hasFixes) {
            title = 'Bug fixes and improvements';
            description = 'This PR addresses various bugs and improves code quality.';
        }
        
        if (hasNewFiles) {
            description += '\n\n## New Files\nNew files have been added to extend functionality.';
        }
        
        if (hasModifications) {
            description += '\n\n## Modifications\nExisting files have been updated to improve performance and maintainability.';
        }
        
        return { title, description };
    }

    private prepareContext(
        changes: GitChange[],
        commits: GitCommit[],
        sourceBranch: string,
        targetBranch: string
    ): string {
        let context = `Creating pull request from '${sourceBranch}' to '${targetBranch}'\n\n`;
        
        context += 'Recent commits:\n';
        commits.slice(0, 5).forEach(commit => {
            context += `- ${commit.message} (${commit.author})\n`;
        });
        
        context += '\nFile changes:\n';
        changes.forEach(change => {
            context += `- ${change.status}: ${change.file}\n`;
        });
        
        return context;
    }

    private generateFallbackDescription(
        changes: GitChange[],
        commits: GitCommit[],
        sourceBranch: string,
        targetBranch: string
    ): PRDescription {
        const title = this.generateFallbackTitle(commits, sourceBranch);
        
        let description = `Pull request from \`${sourceBranch}\` to \`${targetBranch}\`\n\n`;
        
        if (commits.length > 0) {
            description += '## Changes\n';
            commits.slice(0, 5).forEach(commit => {
                description += `- ${commit.message}\n`;
            });
            
            if (commits.length > 5) {
                description += `- ... and ${commits.length - 5} more commit(s)\n`;
            }
        }
        
        if (changes.length > 0) {
            description += '\n## Files Modified\n';
            const groupedChanges = this.groupChangesByType(changes);
            
            Object.entries(groupedChanges).forEach(([status, files]) => {
                description += `\n**${status.charAt(0).toUpperCase() + status.slice(1)}:**\n`;
                files.forEach(file => {
                    description += `- ${file}\n`;
                });
            });
        }
        
        description += '\n---\n*Generated by Smart PR Creator*';
        
        return { title, description };
    }

    private generateFallbackTitle(commits: GitCommit[], branchName: string): string {
        if (commits.length === 0) {
            return `Merge ${branchName}`;
        }
        
        const firstCommit = commits[0].message;
        if (firstCommit.length > 50) {
            return firstCommit.substring(0, 47) + '...';
        }
        
        return firstCommit;
    }

    private analyzeFileTypes(changes: GitChange[]): string[] {
        const typeMap: { [key: string]: string } = {
            '.ts': 'TypeScript',
            '.js': 'JavaScript',
            '.tsx': 'React TypeScript',
            '.jsx': 'React JavaScript',
            '.json': 'Configuration',
            '.md': 'Documentation',
            '.css': 'Styles',
            '.scss': 'Styles',
            '.html': 'Templates',
            '.yml': 'Configuration',
            '.yaml': 'Configuration'
        };
        
        const types = new Set<string>();
        
        changes.forEach(change => {
            const ext = change.file.substring(change.file.lastIndexOf('.'));
            const type = typeMap[ext] || 'Other';
            types.add(type);
        });
        
        return Array.from(types);
    }

    private identifyKeyChanges(changes: GitChange[], commits: GitCommit[]): string[] {
        const keyChanges: string[] = [];
        
        // Look for key patterns in commit messages
        const commitText = commits.map(c => c.message.toLowerCase()).join(' ');
        
        if (commitText.includes('feature') || commitText.includes('add')) {
            keyChanges.push('New features added');
        }
        
        if (commitText.includes('fix') || commitText.includes('bug')) {
            keyChanges.push('Bug fixes implemented');
        }
        
        if (commitText.includes('refactor') || commitText.includes('cleanup')) {
            keyChanges.push('Code refactoring');
        }
        
        if (commitText.includes('test') || commitText.includes('spec')) {
            keyChanges.push('Test improvements');
        }
        
        // Analyze file changes
        const newFiles = changes.filter(c => c.status === 'added').length;
        const modifiedFiles = changes.filter(c => c.status === 'modified').length;
        
        if (newFiles > 0) {
            keyChanges.push(`${newFiles} new file(s) added`);
        }
        
        if (modifiedFiles > 0) {
            keyChanges.push(`${modifiedFiles} file(s) modified`);
        }
        
        return keyChanges;
    }

    private generateDetailedDescription(changes: GitChange[], commits: GitCommit[], fileTypes: string[]): string {
        let description = '## Summary\n';
        description += `This pull request includes changes across ${fileTypes.join(', ')} files.\n\n`;
        
        description += '## Key Changes\n';
        commits.slice(0, 3).forEach(commit => {
            description += `- ${commit.message}\n`;
        });
        
        if (commits.length > 3) {
            description += `- ... and ${commits.length - 3} additional commits\n`;
        }
        
        description += '\n## Impact\n';
        description += 'These changes improve code quality and functionality.\n\n';
        
        return description;
    }

    private generateRecommendations(changes: GitChange[], commits: GitCommit[]): string[] {
        const recommendations: string[] = [];
        
        if (changes.length > 20) {
            recommendations.push('Consider breaking this into smaller PRs for easier review');
        }
        
        if (commits.length > 10) {
            recommendations.push('Consider squashing some commits for a cleaner history');
        }
        
        const hasTests = changes.some(c => 
            c.file.includes('test') || c.file.includes('spec') || c.file.includes('.test.'));
        
        if (!hasTests && changes.length > 5) {
            recommendations.push('Consider adding tests for the new functionality');
        }
        
        const hasDocumentation = changes.some(c => c.file.endsWith('.md'));
        
        if (!hasDocumentation && changes.length > 10) {
            recommendations.push('Consider updating documentation to reflect the changes');
        }
        
        return recommendations;
    }

    private groupChangesByType(changes: GitChange[]): { [key: string]: string[] } {
        const grouped: { [key: string]: string[] } = {};
        
        changes.forEach(change => {
            if (!grouped[change.status]) {
                grouped[change.status] = [];
            }
            grouped[change.status].push(change.file);
        });
        
        return grouped;
    }
}
