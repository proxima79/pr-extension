import * as vscode from 'vscode';
import * as cp from 'child_process';
import { promisify } from 'util';

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

    constructor() {
        this.checkLoginStatus();
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
            
            return {
                pullRequestId: response.pullRequestId,
                url: response.url || `https://dev.azure.com/${repoInfo.organization}/${repoInfo.project}/_git/${repoInfo.repository}/pullrequest/${response.pullRequestId}`,
                status: response.status
            };

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

    async generateAIDescription(
        commits: string[],
        changedFiles: string[],
        useAI: boolean
    ): Promise<string> {
        if (!useAI || commits.length === 0) {
            return this.generateBasicDescription(commits, changedFiles);
        }

        // AI-enhanced description (mock implementation for now)
        let description = '## Summary\n';
        description += 'This pull request includes the following changes:\n\n';
        
        if (commits.length > 0) {
            description += '### Recent Commits\n';
            commits.slice(0, 3).forEach(commit => {
                description += `- ${commit}\n`;
            });
            
            if (commits.length > 3) {
                description += `- ... and ${commits.length - 3} more commits\n`;
            }
            description += '\n';
        }

        if (changedFiles.length > 0) {
            description += '### Files Changed\n';
            const fileCount = changedFiles.length;
            description += `This PR modifies ${fileCount} file(s).\n\n`;
        }

        description += '### Impact\n';
        description += 'These changes improve the codebase by:\n';
        description += '- Enhancing functionality\n';
        description += '- Improving code quality\n';
        description += '- Following best practices\n\n';

        description += '---\n*Generated by Smart PR Creator*';
        
        return description;
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
}
