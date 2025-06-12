import * as vscode from 'vscode';
import * as cp from 'child_process';
import { promisify } from 'util';
import { AIService } from './aiService';
import { GitChange, GitCommit } from './gitService';
import { WebhookService, WebhookPayload } from './webhookService';

const exec = promisify(cp.exec);

export interface AzureRepoInfo {
    organization: string;
    project: string;
    repository: string;
    remoteUrl: string;
}

export interface AzurePROptions {
    title: string;
    description: string;
    sourceBranch: string;
    targetBranch: string;
    workItems?: string[];
    reviewers?: string[];
    isDraft?: boolean;
}

export interface AzurePRResult {
    pullRequestId: number;
    url: string;
    status: string;
}

export class AzureCliService {
    private isLoggedIn: boolean | null = null;
    private webhookService: WebhookService;

    constructor() {
        this.checkLoginStatus();
        this.webhookService = new WebhookService();
    }

    async checkAzureCliInstalled(): Promise<boolean> {
        try {
            await exec('az --version');
            return true;
        } catch (error) {
            return false;
        }
    }

    async checkDevOpsExtension(): Promise<boolean> {
        try {
            const { stdout } = await exec('az extension list --query "[?name==\'azure-devops\'].name" -o tsv');
            return stdout.trim() === 'azure-devops';
        } catch (error) {
            return false;
        }
    }

    async installDevOpsExtension(): Promise<boolean> {
        try {
            vscode.window.showInformationMessage('Installing Azure DevOps extension...');
            await exec('az extension add --name azure-devops');
            vscode.window.showInformationMessage('Azure DevOps extension installed successfully!');
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to install Azure DevOps extension: ${error}`);
            return false;
        }
    }

    async checkLoginStatus(): Promise<boolean> {
        try {
            await exec('az account show');
            this.isLoggedIn = true;
            return true;
        } catch (error) {
            this.isLoggedIn = false;
            return false;
        }
    }

    async login(): Promise<boolean> {
        try {
            vscode.window.showInformationMessage('Opening Azure CLI login...');
            await exec('az login');
            this.isLoggedIn = true;
            vscode.window.showInformationMessage('Successfully logged in to Azure!');
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Azure login failed: ${error}`);
            return false;
        }
    }

    async configureDefaults(organization: string, project: string): Promise<void> {
        try {
            await exec(`az devops configure --defaults organization=https://dev.azure.com/${organization} project="${project}"`);
        } catch (error) {
            throw new Error(`Failed to configure Azure DevOps defaults: ${error}`);
        }
    }

    async parseAzureRepoInfo(workspaceFolder: string): Promise<AzureRepoInfo | null> {
        try {
            // Get remote URL
            const { stdout: remoteUrl } = await exec('git remote get-url origin', { cwd: workspaceFolder });
            const cleanUrl = remoteUrl.trim();

            // Parse Azure DevOps URL
            // Format: https://dev.azure.com/organization/project/_git/repository
            // Or: https://organization@dev.azure.com/organization/project/_git/repository
            const match = cleanUrl.match(/dev\.azure\.com\/([^\/]+)\/([^\/]+)\/_git\/(.+)/);
            
            if (match) {
                return {
                    organization: match[1],
                    project: decodeURIComponent(match[2]),
                    repository: match[3].replace(/\.git$/, ''),
                    remoteUrl: cleanUrl
                };
            }

            return null;
        } catch (error) {
            console.error('Error parsing Azure repo info:', error);
            return null;
        }
    }

    async getCurrentBranch(workspaceFolder: string): Promise<string> {
        try {
            const { stdout } = await exec('git branch --show-current', { cwd: workspaceFolder });
            return stdout.trim();
        } catch (error) {
            throw new Error(`Failed to get current branch: ${error}`);
        }
    }

    async getRecentCommits(workspaceFolder: string, count: number = 5): Promise<string[]> {
        try {
            const { stdout } = await exec(`git log --oneline -${count}`, { cwd: workspaceFolder });
            return stdout.trim().split('\n').filter(line => line.length > 0);
        } catch (error) {
            console.error('Error getting commits:', error);
            return [];
        }
    }

    async getGitStatus(workspaceFolder: string): Promise<string> {
        try {
            const { stdout } = await exec('git status --porcelain', { cwd: workspaceFolder });
            return stdout.trim();
        } catch (error) {
            return '';
        }
    }

    async createPullRequest(
        repoInfo: AzureRepoInfo,
        options: AzurePROptions,
        workspaceFolder: string
    ): Promise<AzurePRResult> {
        try {
            // Ensure we're logged in
            if (!this.isLoggedIn) {
                const loginSuccess = await this.login();
                if (!loginSuccess) {
                    throw new Error('Azure CLI login required');
                }
            }

            // Configure defaults
            await this.configureDefaults(repoInfo.organization, repoInfo.project);

            // Build the Azure CLI command
            let command = `az repos pr create`;
            command += ` --source-branch "${options.sourceBranch}"`;
            command += ` --target-branch "${options.targetBranch}"`;
            command += ` --title "${options.title.replace(/"/g, '\\"')}"`;
            
            if (options.description) {
                command += ` --description "${options.description.replace(/"/g, '\\"')}"`;
            }

            if (options.workItems && options.workItems.length > 0) {
                command += ` --work-items ${options.workItems.join(' ')}`;
            }

            if (options.reviewers && options.reviewers.length > 0) {
                command += ` --reviewers ${options.reviewers.join(' ')}`;
            }

            if (options.isDraft) {
                command += ` --draft`;
            }

            // Execute the command
            const { stdout } = await exec(command, { cwd: workspaceFolder });
            
            // Parse the response
            const response = JSON.parse(stdout);
            
            const result: AzurePRResult = {
                pullRequestId: response.pullRequestId,
                url: response.url || `https://dev.azure.com/${repoInfo.organization}/${repoInfo.project}/_git/${repoInfo.repository}/pullrequest/${response.pullRequestId}`,
                status: response.status
            };

            // Send webhook notification
            await this.sendPRCreatedWebhook(repoInfo, options, result, workspaceFolder);

            return result;

        } catch (error: any) {
            if (error.message.includes('already exists')) {
                throw new Error('A pull request already exists for this branch. Please check your Azure DevOps repository.');
            } else if (error.message.includes('not found')) {
                throw new Error('Branch not found on remote. Please push your branch first.');
            } else if (error.message.includes('authentication')) {
                throw new Error('Authentication failed. Please run "az login" and try again.');
            }
            throw new Error(`Failed to create pull request: ${error.message}`);
        }
    }

    async pushBranch(workspaceFolder: string, branchName: string): Promise<void> {
        try {
            await exec(`git push origin ${branchName}`, { cwd: workspaceFolder });
        } catch (error) {
            throw new Error(`Failed to push branch: ${error}`);
        }
    }

    /**
     * Generates AI-powered pull request descriptions using GitHub Copilot and other AI models
     * This method now integrates with the real AIService instead of using mock data
     * 
     * @param commits Array of commit strings from git log
     * @param changedFiles Array of changed file strings from git status
     * @param useAI Whether to use AI generation or fallback to basic description
     * @param workspaceFolder Optional workspace folder path
     * @returns Promise<string> Generated PR description
     */
    async generateAIDescription(
        commits: string[],
        changedFiles: string[],
        useAI: boolean,
        workspaceFolder?: string
    ): Promise<string> {
        if (!useAI || commits.length === 0) {
            return this.generateBasicDescription(commits, changedFiles);
        }

        try {
            // Initialize real AI service with multi-model support (GPT-4o, Claude Sonnet, etc.)
            const aiService = new AIService();

            // Get workspace folder if not provided
            const wsFolder = workspaceFolder || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!wsFolder) {
                throw new Error('No workspace folder available');
            }

            // Get enhanced git information
            const [gitCommits, gitChanges, currentBranch, defaultBranch] = await Promise.all([
                this.getEnhancedCommits(wsFolder),
                this.getEnhancedChanges(wsFolder, changedFiles),
                this.getCurrentBranch(wsFolder),
                this.getDefaultBranch(wsFolder)
            ]);

            // Generate AI-powered description
            const prDescription = await aiService.generatePRDescription(
                gitChanges,
                gitCommits,
                currentBranch,
                defaultBranch
            );

            return prDescription.description;

        } catch (error) {
            console.error('AI description generation failed:', error);
            vscode.window.showWarningMessage('AI description generation failed, using basic description');
            return this.generateBasicDescription(commits, changedFiles);
        }
    }

    private async getEnhancedCommits(workspaceFolder: string): Promise<GitCommit[]> {
        try {
            // Get detailed commit information including author and date
            const { stdout } = await exec(
                'git log --oneline --format="%H|%an|%ad|%s" --date=iso -10',
                { cwd: workspaceFolder }
            );
            
            return stdout.trim().split('\n')
                .filter(line => line.length > 0)
                .map(line => {
                    const [hash, author, dateStr, ...messageParts] = line.split('|');
                    return {
                        hash: hash,
                        author: author || 'Unknown',
                        date: new Date(dateStr || Date.now()),
                        message: messageParts.join('|') || 'No message'
                    };
                });
        } catch (error) {
            console.error('Error getting enhanced commits:', error);
            // Fallback to basic parsing
            const commits = await this.getRecentCommits(workspaceFolder);
            return commits.map((commitLine, index) => {
                const parts = commitLine.split(' ');
                const hash = parts[0];
                const message = parts.slice(1).join(' ');
                
                return {
                    hash: hash,
                    message: message,
                    author: 'Unknown',
                    date: new Date()
                };
            });
        }
    }

    private async getEnhancedChanges(workspaceFolder: string, changedFiles: string[]): Promise<GitChange[]> {
        try {
            // Get detailed file changes with insertion/deletion counts
            const { stdout } = await exec('git diff --stat HEAD', { cwd: workspaceFolder });
            const statLines = stdout.trim().split('\n').filter(line => line.includes('|'));
            
            const statsMap = new Map<string, { insertions: number; deletions: number }>();
            
            statLines.forEach(line => {
                const match = line.match(/^(.+?)\s+\|\s+\d+\s+([+-]+)/);
                if (match) {
                    const filename = match[1].trim();
                    const changes = match[2];
                    const insertions = (changes.match(/\+/g) || []).length;
                    const deletions = (changes.match(/-/g) || []).length;
                    statsMap.set(filename, { insertions, deletions });
                }
            });

            return changedFiles.map(fileLine => {
                // Parse git status line: " M filename" or "A  filename" etc.
                const statusChar = fileLine.charAt(1) || fileLine.charAt(0);
                const filename = fileLine.substring(2).trim() || fileLine.substring(1).trim();
                
                let status: 'added' | 'modified' | 'deleted' | 'renamed';
                switch (statusChar) {
                    case 'A':
                        status = 'added';
                        break;
                    case 'D':
                        status = 'deleted';
                        break;
                    case 'R':
                        status = 'renamed';
                        break;
                    case 'M':
                    default:
                        status = 'modified';
                        break;
                }

                const stats = statsMap.get(filename);
                return {
                    file: filename,
                    status: status,
                    insertions: stats?.insertions,
                    deletions: stats?.deletions
                };
            });
        } catch (error) {
            console.error('Error getting enhanced changes:', error);
            // Fallback to basic parsing
            return changedFiles.map(fileLine => {
                const statusChar = fileLine.charAt(1) || fileLine.charAt(0);
                const filename = fileLine.substring(2).trim() || fileLine.substring(1).trim();
                
                let status: 'added' | 'modified' | 'deleted' | 'renamed';
                switch (statusChar) {
                    case 'A': status = 'added'; break;
                    case 'D': status = 'deleted'; break;
                    case 'R': status = 'renamed'; break;
                    case 'M': default: status = 'modified'; break;
                }

                return { file: filename, status: status };
            });
        }
    }

    private generateBasicDescription(commits: string[], changedFiles: string[]): string {
        let description = 'Pull request created via Smart PR Creator.\n\n';
        
        if (commits.length > 0) {
            description += '**Recent commits:**\n';
            commits.slice(0, 5).forEach(commit => {
                description += `- ${commit}\n`;
            });
        }
        
        if (changedFiles.length > 0) {
            description += `\n**Files changed:** ${changedFiles.length} file(s)\n`;
        }
        
        return description;
    }

    async getWorkItems(workspaceFolder: string): Promise<string[]> {
        try {
            // Try to extract work item numbers from commit messages
            const commits = await this.getRecentCommits(workspaceFolder, 10);
            const workItems: string[] = [];
            
            commits.forEach(commit => {
                // Look for patterns like #1234 or AB#1234
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
            
            return workItems;
        } catch (error) {
            return [];
        }
    }

    async validatePrerequisites(): Promise<{ success: boolean; message: string }> {
        // Check if Azure CLI is installed
        const cliInstalled = await this.checkAzureCliInstalled();
        if (!cliInstalled) {
            return {
                success: false,
                message: 'Azure CLI is not installed. Please install it from https://docs.microsoft.com/en-us/cli/azure/install-azure-cli'
            };
        }

        // Check if DevOps extension is installed
        const devOpsExtension = await this.checkDevOpsExtension();
        if (!devOpsExtension) {
            const installResult = await vscode.window.showWarningMessage(
                'Azure DevOps extension is not installed. Would you like to install it?',
                'Install',
                'Cancel'
            );
            
            if (installResult === 'Install') {
                const installed = await this.installDevOpsExtension();
                if (!installed) {
                    return {
                        success: false,
                        message: 'Failed to install Azure DevOps extension'
                    };
                }
            } else {
                return {
                    success: false,
                    message: 'Azure DevOps extension is required'
                };
            }
        }

        // Check login status
        const loggedIn = await this.checkLoginStatus();
        if (!loggedIn) {
            const loginResult = await vscode.window.showWarningMessage(
                'You are not logged in to Azure CLI. Would you like to login?',
                'Login',
                'Cancel'
            );
            
            if (loginResult === 'Login') {
                const loginSuccess = await this.login();
                if (!loginSuccess) {
                    return {
                        success: false,
                        message: 'Azure CLI login failed'
                    };
                }
            } else {
                return {
                    success: false,
                    message: 'Azure CLI login is required'
                };
            }
        }

        return { success: true, message: 'All prerequisites are met' };
    }

    async getBranchStatus(workspaceFolder: string, branchName: string): Promise<{ ahead: number; behind: number; upToDate: boolean }> {
        try {
            const { stdout } = await exec(`git rev-list --count --left-right origin/${branchName}...${branchName}`, { cwd: workspaceFolder });
            const [behind, ahead] = stdout.trim().split('\t').map(Number);
            return {
                ahead: ahead || 0,
                behind: behind || 0,
                upToDate: ahead === 0 && behind === 0
            };
        } catch (error) {
            // Branch might not exist on remote yet
            return { ahead: 0, behind: 0, upToDate: false };
        }
    }

    async getDefaultBranch(workspaceFolder: string): Promise<string> {
        try {
            const { stdout } = await exec('git symbolic-ref refs/remotes/origin/HEAD', { cwd: workspaceFolder });
            return stdout.trim().replace('refs/remotes/origin/', '');
        } catch (error) {
            // Fallback to common default branches
            const { stdout: branches } = await exec('git branch -r', { cwd: workspaceFolder });
            if (branches.includes('origin/main')) {
                return 'main';
            } else if (branches.includes('origin/master')) {
                return 'master';
            } else if (branches.includes('origin/develop')) {
                return 'develop';
            }
            return 'main'; // Final fallback
        }
    }

    async getAzureDevOpsDefaults(): Promise<{ organization?: string; project?: string }> {
        try {
            const { stdout } = await exec('az devops configure --list');
            const config: { organization?: string; project?: string } = {};
            
            stdout.split('\n').forEach(line => {
                if (line.includes('organization')) {
                    const match = line.match(/organization\s*=\s*(.+)/);
                    if (match) {
                        config.organization = match[1].trim().replace('https://dev.azure.com/', '');
                    }
                }
                if (line.includes('project')) {
                    const match = line.match(/project\s*=\s*(.+)/);
                    if (match) {
                        config.project = match[1].trim();
                    }
                }
            });
            
            return config;
        } catch (error) {
            return {};
        }
    }

    async listAvailableReviewers(repoInfo: AzureRepoInfo): Promise<string[]> {
        try {
            await this.configureDefaults(repoInfo.organization, repoInfo.project);
            const { stdout } = await exec(`az devops user list --query "[].displayName" -o tsv`);
            return stdout.trim().split('\n').filter(name => name.length > 0);
        } catch (error) {
            console.error('Error getting reviewers:', error);
            return [];
        }
    }

    async checkBranchPolicies(repoInfo: AzureRepoInfo, targetBranch: string): Promise<{ hasRequiredReviewers: boolean; minimumReviewers: number }> {
        try {
            await this.configureDefaults(repoInfo.organization, repoInfo.project);
            const { stdout } = await exec(`az repos policy list --branch "${targetBranch}" --repository-id "${repoInfo.repository}"`);
            const policies = JSON.parse(stdout);
            
            let hasRequiredReviewers = false;
            let minimumReviewers = 0;
            
            policies.forEach((policy: any) => {
                if (policy.type?.displayName?.includes('Minimum number of reviewers')) {
                    hasRequiredReviewers = true;
                    minimumReviewers = policy.settings?.minimumApproverCount || 0;
                }
            });
            
            return { hasRequiredReviewers, minimumReviewers };
        } catch (error) {
            return { hasRequiredReviewers: false, minimumReviewers: 0 };
        }
    }

    /**
     * Send webhook notification when PR is created
     */
    private async sendPRCreatedWebhook(
        repoInfo: AzureRepoInfo,
        options: AzurePROptions,
        result: AzurePRResult,
        workspaceFolder: string
    ): Promise<void> {
        try {
            // Get current user info
            const currentUser = await this.getCurrentUser();
            
            // Get workspace folder name
            const workspaceName = workspaceFolder.split('/').pop() || 'Unknown';
            
            // Create webhook payload
            const payload: WebhookPayload = {
                event: 'pr_created',
                pullRequest: {
                    id: result.pullRequestId.toString(),
                    title: options.title,
                    description: options.description,
                    url: result.url,
                    author: currentUser,
                    sourceBranch: options.sourceBranch,
                    targetBranch: options.targetBranch,
                    repository: `${repoInfo.organization}/${repoInfo.project}/${repoInfo.repository}`,
                    aiGenerated: options.description.includes('Generated by Smart PR Creator') || 
                                options.description.includes('AI-generated'),
                    modelUsed: this.extractAIModelFromDescription(options.description),
                    filesChanged: await this.getChangedFilesCount(workspaceFolder),
                    commits: await this.getCommitsCount(workspaceFolder, options.sourceBranch)
                },
                timestamp: new Date().toISOString(),
                metadata: {
                    extensionVersion: this.getExtensionVersion(),
                    workspaceFolder: workspaceName,
                    vsCodeVersion: vscode.version
                }
            };

            // Send webhook notification
            await this.webhookService.sendWebhook('pr_created', payload);
            
        } catch (error) {
            console.error('Failed to send webhook notification:', error);
            // Don't throw - webhook failure shouldn't break PR creation
        }
    }

    /**
     * Get current Azure user
     */
    private async getCurrentUser(): Promise<string> {
        try {
            const { stdout } = await exec('az account show --query "user.name" -o tsv');
            return stdout.trim();
        } catch (error) {
            return 'Unknown User';
        }
    }

    /**
     * Extract AI model name from PR description
     */
    private extractAIModelFromDescription(description: string): string | undefined {
        const modelPatterns = [
            /GPT-4o/i,
            /Claude.*Sonnet/i,
            /GPT-4o Mini/i,
            /O1 Preview/i,
            /O1 Mini/i,
            /Copilot/i
        ];

        for (const pattern of modelPatterns) {
            const match = description.match(pattern);
            if (match) {
                return match[0];
            }
        }

        return undefined;
    }

    /**
     * Get count of changed files
     */
    private async getChangedFilesCount(workspaceFolder: string): Promise<number> {
        try {
            const { stdout } = await exec('git diff --name-only HEAD~1', { cwd: workspaceFolder });
            return stdout.trim().split('\n').filter(line => line.length > 0).length;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get count of commits in current branch vs target
     */
    private async getCommitsCount(workspaceFolder: string, sourceBranch: string): Promise<number> {
        try {
            const { stdout } = await exec(`git rev-list --count HEAD ^origin/main`, { cwd: workspaceFolder });
            return parseInt(stdout.trim()) || 1;
        } catch (error) {
            return 1;
        }
    }

    /**
     * Get extension version from package.json
     */
    private getExtensionVersion(): string {
        try {
            const extension = vscode.extensions.getExtension('kenr.smart-pr-creator');
            return extension?.packageJSON?.version || '1.0.0';
        } catch (error) {
            return '1.0.0';
        }
    }
}
