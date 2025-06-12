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

export interface AIModelConfig {
    provider: string;
    model: string;
    apiKey?: string;
    baseUrl?: string;
}

export interface AvailableModel {
    id: string;
    name: string;
    vendor: string;
    family: string;
    version: string;
    maxInputTokens: number;
}

export interface ModelSelector {
    vendor?: string;
    family?: string;
    version?: string;
    id?: string;
}

export class AIService {
    private provider: string = 'copilot';
    private model: string = 'gpt-4o';
    private apiKey?: string;
    private baseUrl?: string;

    constructor() {
        this.loadConfiguration();
    }

    private loadConfiguration() {
        try {
            const config = vscode.workspace.getConfiguration('smartPrCreator');
            this.provider = config.get<string>('aiProvider') || 'copilot';
            const configuredModel = config.get<string>('aiModel') || 'auto';
            
            // Handle "auto" model selection
            if (configuredModel === 'auto') {
                this.model = this.getDefaultModelForProvider(this.provider);
            } else {
                this.model = configuredModel;
            }
            
            this.apiKey = config.get<string>('aiApiKey');
            this.baseUrl = config.get<string>('aiBaseUrl');
        } catch (error) {
            // Fallback for test environment
            console.log('Configuration not available, using default provider');
            this.provider = 'copilot';
            this.model = 'gpt-4o';
        }
    }

    private getDefaultModelForProvider(provider: string): string {
        switch (provider) {
            case 'copilot':
                return 'gpt-4o'; // Default, but will discover available models dynamically
            case 'anthropic':
                return 'claude-3-5-sonnet-20241022';
            case 'openai':
                return 'gpt-4o';
            case 'azure-openai':
                return 'gpt-4o';
            default:
                return 'gpt-4o';
        }
    }    async generatePRDescription(
        changes: GitChange[],
        commits: GitCommit[],
        sourceBranch: string,
        targetBranch: string
    ): Promise<PRDescription> {
        try {
            let result: PRDescription | null = null;

            // Try different AI providers based on configuration
            switch (this.provider) {
                case 'copilot':
                    result = await this.generateWithCopilot(changes, commits, sourceBranch, targetBranch);
                    break;
                case 'anthropic':
                    result = await this.generateWithAnthropic(changes, commits, sourceBranch, targetBranch);
                    break;
                case 'openai':
                    result = await this.generateWithOpenAI(changes, commits, sourceBranch, targetBranch);
                    break;
                case 'azure-openai':
                    result = await this.generateWithAzureOpenAI(changes, commits, sourceBranch, targetBranch);
                    break;
                default:
                    console.warn(`Unknown AI provider: ${this.provider}, falling back to Copilot`);
                    result = await this.generateWithCopilot(changes, commits, sourceBranch, targetBranch);
            }

            // If the primary provider fails, try fallback to Copilot if it's not already being used
            if (!result && this.provider !== 'copilot') {
                console.log(`${this.provider} failed, trying Copilot as fallback`);
                result = await this.generateWithCopilot(changes, commits, sourceBranch, targetBranch);
            }

            // Final fallback to basic description
            return result || this.generateFallbackDescription(changes, commits, sourceBranch, targetBranch);
        } catch (error) {
            console.error('Error generating PR description:', error);
            return this.generateFallbackDescription(changes, commits, sourceBranch, targetBranch);
        }
    }

    private async generateWithCopilot(
        changes: GitChange[],
        commits: GitCommit[],
        sourceBranch: string,
        targetBranch: string
    ): Promise<PRDescription | null> {
        // Use the new advanced method with model selection
        return this.generateWithCopilotAdvanced(changes, commits, sourceBranch, targetBranch);
    }

    private createCopilotPrompt(
        changes: GitChange[],
        commits: GitCommit[],
        sourceBranch: string,
        targetBranch: string
    ): vscode.LanguageModelChatMessage[] {
        // Prepare file changes summary
        const filesSummary = changes.slice(0, 20).map(change => {
            return `- ${change.file} (${change.status})${change.insertions ? ` +${change.insertions}` : ''}${change.deletions ? ` -${change.deletions}` : ''}`;
        }).join('\n');

        // Prepare commits summary
        const commitsSummary = commits.slice(0, 10).map(commit => {
            return `- ${commit.hash.substring(0, 7)}: ${commit.message}`;
        }).join('\n');

        const systemPrompt = `You are an expert software developer helping to create pull request descriptions. 
        
Your task is to analyze code changes and commits to generate a clear, professional pull request description.

Follow this format exactly:
TITLE: [Concise title describing the main purpose]

DESCRIPTION:
## Summary
[Brief overview of what this PR does]

## Changes Made
[List of key changes made]

## Testing
[Testing approach or what was tested]

## Additional Notes
[Any additional context, breaking changes, or important information]

Keep the description professional, clear, and focused on the business value and technical implementation.`;

        const userPrompt = `Please create a pull request description for merging "${sourceBranch}" into "${targetBranch}".

**Recent Commits:**
${commitsSummary}

**Files Changed:**
${filesSummary}

**Additional Context:**
- Source Branch: ${sourceBranch}
- Target Branch: ${targetBranch}
- Number of files changed: ${changes.length}
- Total commits: ${commits.length}

Please generate a clear, professional PR description following the specified format.`;

        return [
            vscode.LanguageModelChatMessage.Assistant(systemPrompt),
            vscode.LanguageModelChatMessage.User(userPrompt)
        ];
    }

    private parseCopilotResponse(response: string): PRDescription {
        // If response is empty or whitespace only, return null to trigger fallback
        if (!response || !response.trim()) {
            throw new Error('Empty response from Copilot');
        }
        
        // Extract title and description from Copilot response
        const lines = response.split('\n');
        let title = '';
        let description = '';
        let foundTitle = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('TITLE:')) {
                title = line.replace('TITLE:', '').trim();
                foundTitle = true;
            } else if (line.startsWith('DESCRIPTION:') || (foundTitle && line.startsWith('##'))) {
                // Everything after DESCRIPTION: or after we found title
                description = lines.slice(i + 1).join('\n').trim();
                break;
            }
        }
        
        // If we couldn't parse properly, use the whole response as description
        if (!title) {
            const firstLine = lines[0]?.trim() || 'Pull Request';
            title = firstLine.length > 100 ? firstLine.substring(0, 97) + '...' : firstLine;
        }
        
        if (!description) {
            description = response;
        }

        return {
            title: title || 'Pull Request',
            description: description || response
        };
    }

    async analyzeBranchChanges(
        changes: GitChange[],
        commits: GitCommit[],
        branchName: string
    ): Promise<BranchAnalysis> {
        try {
            // Try Copilot for analysis if available
            if (this.provider === 'copilot') {
                const copilotAnalysis = await this.analyzeWithCopilot(changes, commits, branchName);
                if (copilotAnalysis) {
                    // If Copilot analysis doesn't have recommendations, add fallback ones
                    if (copilotAnalysis.recommendations.length === 0) {
                        copilotAnalysis.recommendations = this.generateRecommendations(changes, commits);
                    }
                    return copilotAnalysis;
                }
            }

            // Fallback analysis
            const fileCount = changes.length;
            const commitCount = commits.length;
            
            // Analyze file types
            const fileTypes = this.analyzeFileTypes(changes);
            const keyChanges = this.identifyKeyChanges(changes, commits);
            
            // Ensure summary always mentions files
            let summary = `Branch '${branchName}' contains ${commitCount} commit(s) affecting ${fileCount} file(s).`;
            if (fileTypes.length > 0) {
                summary += ` Primary changes involve ${fileTypes.join(', ')} files.`;
            } else {
                summary += ` Various file changes detected.`;
            }
            
            return {
                summary,
                suggestedTitle: this.generateFallbackTitle(commits, branchName),
                suggestedDescription: this.generateDetailedDescription(changes, commits, fileTypes),
                keyChanges,
                recommendations: this.generateRecommendations(changes, commits)
            };
        } catch (error) {
            console.error('Error analyzing branch:', error);
            return {
                summary: `Analysis completed for branch '${branchName}' with file changes detected`,
                suggestedTitle: `Update from ${branchName}`,
                suggestedDescription: '## Summary\nChanges made to improve the codebase.\n\n## Impact\nThese updates enhance functionality and code quality.',
                keyChanges: ['Code updates and improvements'],
                recommendations: ['Review changes carefully before merging']
            };
        }
    }

    private async analyzeWithCopilot(
        changes: GitChange[],
        commits: GitCommit[],
        branchName: string
    ): Promise<BranchAnalysis | null> {
        try {
            // Check if vscode.lm is available (it might not be in test environment)
            if (!vscode.lm || !vscode.lm.selectChatModels) {
                console.log('VS Code Language Model API not available for analysis');
                return null;
            }

            const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
            if (models.length === 0) {
                console.log('No Copilot models available for analysis');
                return null;
            }

            const model = models[0];
            const prompt = this.createAnalysisPrompt(changes, commits, branchName);
            const tokenSource = new vscode.CancellationTokenSource();
            
            const chatResponse = await model.sendRequest(prompt, {}, tokenSource.token);
            
            let response = '';
            for await (const fragment of chatResponse.text) {
                response += fragment;
            }

            return this.parseAnalysisResponse(response, branchName);

        } catch (error) {
            console.error('Copilot analysis error:', error);
            return null;
        }
    }

    private createAnalysisPrompt(
        changes: GitChange[],
        commits: GitCommit[],
        branchName: string
    ): vscode.LanguageModelChatMessage[] {
        const filesSummary = changes.slice(0, 15).map(change => 
            `- ${change.file} (${change.status})`
        ).join('\n');

        const commitsSummary = commits.slice(0, 8).map(commit => 
            `- ${commit.message}`
        ).join('\n');

        const systemPrompt = `You are analyzing a git branch to provide insights about the changes. 
        
Provide analysis in this format:
SUMMARY: [Brief overview of what the branch does]
TITLE: [Suggested PR title]
KEY_CHANGES: [List 3-5 key changes, one per line]
RECOMMENDATIONS: [List 2-4 recommendations, one per line]`;

        const userPrompt = `Analyze branch "${branchName}" with these changes:

**Commits:**
${commitsSummary}

**Files Changed:**
${filesSummary}

Please provide a comprehensive analysis following the specified format.`;

        return [
            vscode.LanguageModelChatMessage.Assistant(systemPrompt),
            vscode.LanguageModelChatMessage.User(userPrompt)
        ];
    }

    private parseAnalysisResponse(response: string, branchName: string): BranchAnalysis {
        const lines = response.split('\n');
        let summary = `Analysis for branch '${branchName}' with file changes detected`;
        let suggestedTitle = `Update from ${branchName}`;
        const keyChanges: string[] = [];
        const recommendations: string[] = [];

        let currentSection = '';

        for (const line of lines) {
            const trimmed = line.trim();
            
            if (trimmed.startsWith('SUMMARY:')) {
                summary = trimmed.replace('SUMMARY:', '').trim();
            } else if (trimmed.startsWith('TITLE:')) {
                suggestedTitle = trimmed.replace('TITLE:', '').trim();
            } else if (trimmed.startsWith('KEY_CHANGES:')) {
                currentSection = 'changes';
            } else if (trimmed.startsWith('RECOMMENDATIONS:')) {
                currentSection = 'recommendations';
            } else if (trimmed.startsWith('-') && currentSection === 'changes') {
                keyChanges.push(trimmed.substring(1).trim());
            } else if (trimmed.startsWith('-') && currentSection === 'recommendations') {
                recommendations.push(trimmed.substring(1).trim());
            }
        }

        // If we didn't find the expected format, try to extract meaningful info
        if (keyChanges.length === 0) {
            // Look for common patterns in the response
            if (response.includes('AI service') || response.includes('Copilot')) {
                keyChanges.push('AI integration improvements');
            }
            if (response.includes('TypeScript') || response.includes('compilation')) {
                keyChanges.push('TypeScript compilation fixes');
            }
            if (response.includes('test') || response.includes('Test')) {
                keyChanges.push('Testing enhancements');
            }
            // Ensure we always have at least one key change
            if (keyChanges.length === 0) {
                keyChanges.push('Code improvements and updates');
            }
        }

        // Generate a meaningful suggested description
        const suggestedDescription = `## Summary\nAnalysis of branch '${branchName}' with detected file changes.\n\n## Key Changes\n${keyChanges.map(change => `- ${change}`).join('\n')}\n\n## Impact\nThese changes enhance the codebase.`;

        return {
            summary,
            suggestedTitle,
            suggestedDescription,
            keyChanges,
            recommendations
        };
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
        } else {
            description += '## Changes\n- Code updates and improvements\n';
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
        } else {
            description += '\n## Files Modified\n- No file changes detected\n';
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
        const deletedFiles = changes.filter(c => c.status === 'deleted').length;
        
        if (newFiles > 0) {
            keyChanges.push(`${newFiles} new file(s) added`);
        }
        
        if (modifiedFiles > 0) {
            keyChanges.push(`${modifiedFiles} file(s) modified`);
        }
        
        if (deletedFiles > 0) {
            keyChanges.push(`${deletedFiles} file(s) deleted`);
        }
        
        // Ensure we always have at least one key change
        if (keyChanges.length === 0) {
            if (changes.length > 0) {
                keyChanges.push('Code updates and improvements');
            } else if (commits.length > 0) {
                keyChanges.push('Repository changes');
            } else {
                keyChanges.push('Branch preparation');
            }
        }
        
        return keyChanges;
    }

    private generateDetailedDescription(changes: GitChange[], commits: GitCommit[], fileTypes: string[]): string {
        let description = '## Summary\n';
        
        if (fileTypes.length > 0) {
            description += `This pull request includes changes across ${fileTypes.join(', ')} files.\n\n`;
        } else if (changes.length > 0) {
            description += `This pull request includes ${changes.length} file change(s).\n\n`;
        } else {
            description += 'This pull request includes code changes.\n\n';
        }
        
        description += '## Key Changes\n';
        if (commits.length > 0) {
            commits.slice(0, 3).forEach(commit => {
                description += `- ${commit.message}\n`;
            });
            
            if (commits.length > 3) {
                description += `- ... and ${commits.length - 3} additional commits\n`;
            }
        } else {
            description += '- Code improvements and updates\n';
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

    // Model discovery and selection methods
    async getAvailableModels(): Promise<AvailableModel[]> {
        try {
            if (!vscode.lm || !vscode.lm.selectChatModels) {
                console.log('VS Code Language Model API not available');
                return [];
            }

            // Get all available models
            const allModels = await vscode.lm.selectChatModels();
            
            return allModels.map(model => ({
                id: model.id,
                name: model.name,
                vendor: model.vendor,
                family: model.family,
                version: model.version,
                maxInputTokens: model.maxInputTokens
            }));
        } catch (error) {
            console.error('Error getting available models:', error);
            return [];
        }
    }

    async getCopilotModels(): Promise<AvailableModel[]> {
        try {
            if (!vscode.lm || !vscode.lm.selectChatModels) {
                return [];
            }

            const copilotModels = await vscode.lm.selectChatModels({ vendor: 'copilot' });
            
            return copilotModels.map(model => ({
                id: model.id,
                name: model.name,
                vendor: model.vendor,
                family: model.family,
                version: model.version,
                maxInputTokens: model.maxInputTokens
            }));
        } catch (error) {
            console.error('Error getting Copilot models:', error);
            return [];
        }
    }

    async selectBestModel(selector?: ModelSelector): Promise<vscode.LanguageModelChat | null> {
        try {
            if (!vscode.lm || !vscode.lm.selectChatModels) {
                return null;
            }

            // If no selector provided, try to get the configured model
            if (!selector) {
                selector = this.getModelSelectorFromConfig();
            }

            const models = await vscode.lm.selectChatModels(selector);
            
            if (models.length === 0) {
                // Fallback to any available Copilot model
                const fallbackModels = await vscode.lm.selectChatModels({ vendor: 'copilot' });
                return fallbackModels.length > 0 ? fallbackModels[0] : null;
            }

            return models[0];
        } catch (error) {
            console.error('Error selecting model:', error);
            return null;
        }
    }

    private getModelSelectorFromConfig(): ModelSelector {
        // Parse the configured model to create a selector
        const selector: ModelSelector = { vendor: 'copilot' };
        
        // Map common model names to families and handle variations
        const modelLower = this.model.toLowerCase();
        
        if (modelLower.includes('gpt-4o')) {
            selector.family = modelLower.includes('mini') ? 'gpt-4o-mini' : 'gpt-4o';
        } else if (modelLower.includes('claude') && modelLower.includes('sonnet')) {
            // Handle various Claude Sonnet naming conventions
            selector.family = 'claude-3.5-sonnet';
        } else if (modelLower.includes('claude')) {
            selector.family = 'claude-3.5-sonnet'; // Default to latest Sonnet
        } else if (modelLower.includes('o1')) {
            selector.family = modelLower.includes('mini') ? 'o1-mini' : 'o1-preview';
        } else {
            // Try to use the model name directly as family
            selector.family = this.model;
        }
        
        console.log(`Model selector: vendor=${selector.vendor}, family=${selector.family} (from config: ${this.model})`);
        return selector;
    }

    // Enhanced Copilot method that supports multiple models
    private async generateWithCopilotAdvanced(
        changes: GitChange[],
        commits: GitCommit[],
        sourceBranch: string,
        targetBranch: string,
        modelSelector?: ModelSelector
    ): Promise<PRDescription | null> {
        try {
            if (!vscode.lm || !vscode.lm.selectChatModels) {
                console.log('VS Code Language Model API not available');
                return null;
            }

            // Select the best available model
            const model = await this.selectBestModel(modelSelector);
            
            if (!model) {
                console.log('No compatible models available');
                return null;
            }

            console.log(`Using model: ${model.name} (${model.vendor}/${model.family})`);
            
            // Prepare the context and prompt
            const prompt = this.createAdvancedPrompt(changes, commits, sourceBranch, targetBranch, model);
            
            // Create a cancellation token
            const tokenSource = new vscode.CancellationTokenSource();
            
            // Send request and await the response
            const chatResponse = await model.sendRequest(prompt, {}, tokenSource.token);
            
            let response = '';
            for await (const fragment of chatResponse.text) {
                response += fragment;
            }

            // Parse the response to extract title and description
            return this.parseCopilotResponse(response);

        } catch (error) {
            if (error instanceof vscode.LanguageModelError) {
                console.log('Language Model error:', error.message, error.code);
                
                if (error.cause instanceof Error && error.cause.message.includes('off_topic')) {
                    vscode.window.showWarningMessage('AI model declined to generate PR description (off-topic)');
                } else {
                    vscode.window.showErrorMessage(`AI model error: ${error.message}`);
                }
            } else {
                console.error('Unexpected error with AI model:', error);
            }
            return null;
        }
    }

    private createAdvancedPrompt(
        changes: GitChange[],
        commits: GitCommit[],
        sourceBranch: string,
        targetBranch: string,
        model: vscode.LanguageModelChat
    ): vscode.LanguageModelChatMessage[] {
        // Prepare file changes summary
        const filesSummary = changes.slice(0, 30).map(change => {
            return `- ${change.file} (${change.status})${change.insertions ? ` +${change.insertions}` : ''}${change.deletions ? ` -${change.deletions}` : ''}`;
        }).join('\n');

        // Prepare commits summary
        const commitsSummary = commits.slice(0, 15).map(commit => {
            return `- ${commit.hash.substring(0, 7)}: ${commit.message}`;
        }).join('\n');

        // Adjust prompt based on model capabilities
        const isAdvancedModel = model.family.includes('gpt-4') || model.family.includes('claude') || model.family.includes('o1');
        
        const systemPrompt = `You are an expert software developer and technical writer helping to create professional pull request descriptions.

Your task is to analyze code changes and commits to generate a clear, comprehensive pull request description that helps reviewers understand the purpose, scope, and impact of the changes.

${isAdvancedModel ? `As an advanced AI model, please provide detailed analysis including:
- Technical implementation details
- Potential risks or considerations
- Code quality observations
- Architectural implications` : ''}

Follow this format exactly:
TITLE: [Concise, descriptive title that captures the main purpose]

DESCRIPTION:
## Summary
[Brief overview of what this PR accomplishes and why it's needed]

## Changes Made
[Detailed list of key changes, organized by component/area if applicable]

## Testing
[Testing approach, test coverage, or what should be tested during review]

## Additional Notes
[Any additional context, breaking changes, migration notes, or important reviewer guidance]

Keep the description professional, clear, and focused on helping reviewers understand the changes efficiently.`;

        const userPrompt = `Please create a comprehensive pull request description for merging "${sourceBranch}" into "${targetBranch}".

**Recent Commits:**
${commitsSummary}

**Files Changed:**
${filesSummary}

**Context:**
- Source Branch: ${sourceBranch}
- Target Branch: ${targetBranch}
- Files changed: ${changes.length}
- Total commits: ${commits.length}
- Model: ${model.name} (${model.family})

Please analyze these changes and generate a professional PR description that will help reviewers understand the purpose, scope, and impact of this pull request.`;

        return [
            vscode.LanguageModelChatMessage.Assistant(systemPrompt),
            vscode.LanguageModelChatMessage.User(userPrompt)
        ];
    }

    // Direct API integration methods for other AI providers
    private async generateWithAnthropic(
        changes: GitChange[],
        commits: GitCommit[],
        sourceBranch: string,
        targetBranch: string
    ): Promise<PRDescription | null> {
        // First try to use Claude models via Copilot if available
        try {
            const claudeSelector: ModelSelector = {
                vendor: 'copilot',
                family: 'claude-3.5-sonnet'
            };
            
            const result = await this.generateWithCopilotAdvanced(changes, commits, sourceBranch, targetBranch, claudeSelector);
            if (result) {
                return result;
            }
        } catch (error) {
            console.log('Claude via Copilot not available, trying direct Anthropic integration');
        }
        
        // Direct Anthropic API integration
        try {
            const anthropicApiKey = await this.getAnthropicApiKey();
            if (!anthropicApiKey) {
                console.log('Anthropic API key not configured');
                return null;
            }

            const prompt = this.buildPrompt(changes, commits, sourceBranch, targetBranch);
            
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': anthropicApiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 2000,
                    messages: [{
                        role: 'user',
                        content: prompt
                    }]
                })
            });

            if (!response.ok) {
                throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as any;
            const content = data.content?.[0]?.text;
            
            if (content) {
                return this.parseAIResponse(content);
            }
        } catch (error) {
            console.error('Error with direct Anthropic integration:', error);
        }
        
        return null;
    }

    private async generateWithOpenAI(
        changes: GitChange[],
        commits: GitCommit[],
        sourceBranch: string,
        targetBranch: string
    ): Promise<PRDescription | null> {
        try {
            const openaiApiKey = await this.getOpenAIApiKey();
            if (!openaiApiKey) {
                console.log('OpenAI API key not configured');
                return null;
            }

            const prompt = this.buildPrompt(changes, commits, sourceBranch, targetBranch);
            
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openaiApiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [{
                        role: 'user',
                        content: prompt
                    }],
                    max_tokens: 2000,
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as any;
            const content = data.choices?.[0]?.message?.content;
            
            if (content) {
                return this.parseAIResponse(content);
            }
        } catch (error) {
            console.error('Error with OpenAI integration:', error);
        }
        
        return null;
    }

    private async generateWithAzureOpenAI(
        changes: GitChange[],
        commits: GitCommit[],
        sourceBranch: string,
        targetBranch: string
    ): Promise<PRDescription | null> {
        try {
            const azureConfig = await this.getAzureOpenAIConfig();
            if (!azureConfig.apiKey || !azureConfig.endpoint || !azureConfig.deploymentName) {
                console.log('Azure OpenAI configuration incomplete');
                return null;
            }

            const prompt = this.buildPrompt(changes, commits, sourceBranch, targetBranch);
            
            const response = await fetch(`${azureConfig.endpoint}/openai/deployments/${azureConfig.deploymentName}/chat/completions?api-version=2024-02-01`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': azureConfig.apiKey
                },
                body: JSON.stringify({
                    messages: [{
                        role: 'user',
                        content: prompt
                    }],
                    max_tokens: 2000,
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                throw new Error(`Azure OpenAI API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as any;
            const content = data.choices?.[0]?.message?.content;
            
            if (content) {
                return this.parseAIResponse(content);
            }
        } catch (error) {
            console.error('Error with Azure OpenAI integration:', error);
        }
        
        return null;
    }

    // Helper methods for API key management
    private async getAnthropicApiKey(): Promise<string | null> {
        try {
            // Try to get from VS Code secrets first
            const secretKey = await vscode.window.showInputBox({
                prompt: 'Enter your Anthropic API key',
                password: true,
                placeHolder: 'sk-ant-...'
            });
            return secretKey || null;
        } catch (error) {
            return null;
        }
    }

    private async getOpenAIApiKey(): Promise<string | null> {
        try {
            // Try to get from VS Code secrets first
            const secretKey = await vscode.window.showInputBox({
                prompt: 'Enter your OpenAI API key',
                password: true,
                placeHolder: 'sk-...'
            });
            return secretKey || null;
        } catch (error) {
            return null;
        }
    }

    private async getAzureOpenAIConfig(): Promise<{
        apiKey: string | null;
        endpoint: string | null;
        deploymentName: string | null;
    }> {
        try {
            const apiKey = await vscode.window.showInputBox({
                prompt: 'Enter your Azure OpenAI API key',
                password: true
            });
            
            const endpoint = await vscode.window.showInputBox({
                prompt: 'Enter your Azure OpenAI endpoint',
                placeHolder: 'https://your-resource.openai.azure.com'
            });
            
            const deploymentName = await vscode.window.showInputBox({
                prompt: 'Enter your Azure OpenAI deployment name',
                placeHolder: 'gpt-4o'
            });
            
            return { 
                apiKey: apiKey || null, 
                endpoint: endpoint || null, 
                deploymentName: deploymentName || null 
            };
        } catch (error) {
            return { apiKey: null, endpoint: null, deploymentName: null };
        }
    }

    // Helper method to parse AI responses from different providers
    private parseAIResponse(content: string): PRDescription {
        // Try to extract title and description from the response
        const lines = content.split('\n');
        let title = '';
        let description = '';
        
        // Look for title in first few lines
        for (let i = 0; i < Math.min(5, lines.length); i++) {
            const line = lines[i].trim();
            if (line && !title && line.length < 100) {
                // Remove common prefixes
                title = line.replace(/^(Title:|PR Title:|Pull Request Title:)\s*/i, '').trim();
                break;
            }
        }
        
        // Use the rest as description
        const titleIndex = lines.findIndex(line => line.trim() === title);
        if (titleIndex >= 0 && titleIndex < lines.length - 1) {
            description = lines.slice(titleIndex + 1).join('\n').trim();
        } else {
            // If we can't find the title in the response, use everything after first line
            description = lines.slice(1).join('\n').trim();
        }
        
        // Fallback title if none found
        if (!title) {
            title = 'Pull Request';
        }
        
        // Fallback description if none found
        if (!description) {
            description = content.trim();
        }
        
        return { title, description };
    }

    // Helper method to build prompt for AI providers
    private buildPrompt(changes: GitChange[], commits: GitCommit[], sourceBranch: string, targetBranch: string): string {
        const prompt = `As a senior software engineer, analyze these code changes and generate a professional pull request description.

Branch: ${sourceBranch} → ${targetBranch}

Recent Commits:
${commits.map(commit => `- ${commit.hash.substring(0, 8)}: ${commit.message} (by ${commit.author})`).join('\n')}

Code Changes Summary:
${changes.map(change => `- ${change.file}: ${change.status}${change.insertions ? ` +${change.insertions}` : ''}${change.deletions ? ` -${change.deletions}` : ''}`).join('\n')}

Please provide:
1. A clear, concise title (under 72 characters)
2. A detailed description with:
   - Summary of changes
   - Technical details
   - Testing considerations
   - Any breaking changes or special notes

Format your response as:
Title: [Your PR title here]

Description:
[Your detailed description here]`;

        return prompt;
    }
}
