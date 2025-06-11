import * as vscode from 'vscode';
import axios from 'axios';

export interface PRRequest {
    title: string;
    description: string;
    sourceBranch: string;
    targetBranch: string;
    repositoryUrl: string;
}

export interface PRResponse {
    id: number;
    url: string;
    number: number;
}

export class PRService {
    private config = vscode.workspace.getConfiguration('smartPrCreator');

    async createPullRequest(request: PRRequest): Promise<string> {
        const platform = this.detectPlatform(request.repositoryUrl);
        
        switch (platform) {
            case 'github':
                return this.createGitHubPR(request);
            case 'azure-devops':
                return this.createAzureDevOpsPR(request);
            case 'gitlab':
                return this.createGitLabPR(request);
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
    }

    private detectPlatform(repositoryUrl: string): 'github' | 'azure-devops' | 'gitlab' | 'unknown' {
        if (repositoryUrl.includes('github.com')) {
            return 'github';
        } else if (repositoryUrl.includes('dev.azure.com') || repositoryUrl.includes('visualstudio.com')) {
            return 'azure-devops';
        } else if (repositoryUrl.includes('gitlab.com') || repositoryUrl.includes('gitlab')) {
            return 'gitlab';
        }
        return 'unknown';
    }

    private async createGitHubPR(request: PRRequest): Promise<string> {
        try {
            const token = await this.getGitHubToken();
            if (!token) {
                throw new Error('GitHub token not found. Please authenticate with GitHub.');
            }

            const { owner, repo } = this.parseGitHubUrl(request.repositoryUrl);
            
            const response = await axios.post(
                `https://api.github.com/repos/${owner}/${repo}/pulls`,
                {
                    title: request.title,
                    body: request.description,
                    head: request.sourceBranch,
                    base: request.targetBranch
                },
                {
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data.html_url;
        } catch (error: any) {
            if (error.response?.status === 401) {
                throw new Error('GitHub authentication failed. Please check your token.');
            } else if (error.response?.status === 422) {
                throw new Error('Pull request could not be created. Check if it already exists or if the branches are valid.');
            }
            throw new Error(`GitHub API error: ${error.message}`);
        }
    }

    private async createAzureDevOpsPR(request: PRRequest): Promise<string> {
        try {
            const token = await this.getAzureDevOpsToken();
            if (!token) {
                throw new Error('Azure DevOps token not found. Please authenticate with Azure DevOps.');
            }

            const { organization, project, repo } = this.parseAzureDevOpsUrl(request.repositoryUrl);
            
            const response = await axios.post(
                `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repo}/pullrequests?api-version=7.0`,
                {
                    sourceRefName: `refs/heads/${request.sourceBranch}`,
                    targetRefName: `refs/heads/${request.targetBranch}`,
                    title: request.title,
                    description: request.description
                },
                {
                    headers: {
                        'Authorization': `Basic ${Buffer.from(`:${token}`).toString('base64')}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const prId = response.data.pullRequestId;
            return `https://dev.azure.com/${organization}/${project}/_git/${repo}/pullrequest/${prId}`;
        } catch (error: any) {
            if (error.response?.status === 401) {
                throw new Error('Azure DevOps authentication failed. Please check your token.');
            }
            throw new Error(`Azure DevOps API error: ${error.message}`);
        }
    }

    private async createGitLabPR(request: PRRequest): Promise<string> {
        try {
            const token = await this.getGitLabToken();
            if (!token) {
                throw new Error('GitLab token not found. Please authenticate with GitLab.');
            }

            const { projectId, baseUrl } = this.parseGitLabUrl(request.repositoryUrl);
            
            const response = await axios.post(
                `${baseUrl}/api/v4/projects/${projectId}/merge_requests`,
                {
                    source_branch: request.sourceBranch,
                    target_branch: request.targetBranch,
                    title: request.title,
                    description: request.description
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data.web_url;
        } catch (error: any) {
            if (error.response?.status === 401) {
                throw new Error('GitLab authentication failed. Please check your token.');
            }
            throw new Error(`GitLab API error: ${error.message}`);
        }
    }

    private async getGitHubToken(): Promise<string | null> {
        try {
            // First try to get token from GitHub authentication provider
            const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: false });
            if (session) {
                return session.accessToken;
            }
        } catch (error) {
            console.error('Error getting GitHub session:', error);
        }

        // Fallback to environment variable or user input
        const envToken = process.env.GITHUB_TOKEN;
        if (envToken) {
            return envToken;
        }

        // Ask user for token
        const token = await vscode.window.showInputBox({
            prompt: 'Enter your GitHub Personal Access Token',
            password: true,
            placeHolder: 'ghp_...'
        });

        return token || null;
    }

    private async getAzureDevOpsToken(): Promise<string | null> {
        // Try environment variable first
        const envToken = process.env.AZURE_DEVOPS_TOKEN;
        if (envToken) {
            return envToken;
        }

        // Ask user for token
        const token = await vscode.window.showInputBox({
            prompt: 'Enter your Azure DevOps Personal Access Token',
            password: true,
            placeHolder: 'Personal Access Token'
        });

        return token || null;
    }

    private async getGitLabToken(): Promise<string | null> {
        // Try environment variable first
        const envToken = process.env.GITLAB_TOKEN;
        if (envToken) {
            return envToken;
        }

        // Ask user for token
        const token = await vscode.window.showInputBox({
            prompt: 'Enter your GitLab Personal Access Token',
            password: true,
            placeHolder: 'glpat-...'
        });

        return token || null;
    }

    private parseGitHubUrl(url: string): { owner: string; repo: string } {
        // Handle both HTTPS and SSH URLs
        let cleanUrl = url.replace(/\.git$/, '');
        
        if (cleanUrl.includes('git@github.com:')) {
            // SSH format: git@github.com:owner/repo
            const match = cleanUrl.match(/git@github\.com:([^/]+)\/(.+)/);
            if (match) {
                return { owner: match[1], repo: match[2] };
            }
        } else {
            // HTTPS format: https://github.com/owner/repo
            const match = cleanUrl.match(/github\.com\/([^/]+)\/(.+)/);
            if (match) {
                return { owner: match[1], repo: match[2] };
            }
        }
        
        throw new Error('Invalid GitHub URL format');
    }

    private parseAzureDevOpsUrl(url: string): { organization: string; project: string; repo: string } {
        // Azure DevOps URL format: https://dev.azure.com/organization/project/_git/repo
        const match = url.match(/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/(.+)/);
        if (match) {
            return {
                organization: match[1],
                project: match[2],
                repo: match[3].replace(/\.git$/, '')
            };
        }
        
        throw new Error('Invalid Azure DevOps URL format');
    }

    private parseGitLabUrl(url: string): { projectId: string; baseUrl: string } {
        // For simplicity, we'll extract the project path and use it as ID
        // In a real implementation, you'd need to resolve the project ID via API
        let baseUrl = 'https://gitlab.com';
        let projectPath = '';
        
        if (url.includes('gitlab.com')) {
            const match = url.match(/gitlab\.com\/(.+)\.git/);
            if (match) {
                projectPath = match[1];
            }
        } else {
            // Self-hosted GitLab
            const match = url.match(/(https?:\/\/[^/]+)\/(.+)\.git/);
            if (match) {
                baseUrl = match[1];
                projectPath = match[2];
            }
        }
        
        // URL encode the project path to use as project ID
        const projectId = encodeURIComponent(projectPath);
        
        return { projectId, baseUrl };
    }

    async testConnection(platform: string, repositoryUrl: string): Promise<boolean> {
        try {
            switch (platform) {
                case 'github':
                    const githubToken = await this.getGitHubToken();
                    if (!githubToken) {
                        return false;
                    }
                    
                    const { owner, repo } = this.parseGitHubUrl(repositoryUrl);
                    const response = await axios.get(
                        `https://api.github.com/repos/${owner}/${repo}`,
                        {
                            headers: {
                                'Authorization': `token ${githubToken}`,
                                'Accept': 'application/vnd.github.v3+json'
                            }
                        }
                    );
                    return response.status === 200;
                    
                case 'azure-devops':
                    // Azure DevOps connection test
                    return true; // Simplified for now
                    
                case 'gitlab':
                    // GitLab connection test
                    return true; // Simplified for now
                    
                default:
                    return false;
            }
        } catch (error) {
            console.error(`Connection test failed for ${platform}:`, error);
            return false;
        }
    }
}
