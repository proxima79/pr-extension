import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';

export interface WebhookConfig {
    name: string;
    url: string;
    enabled: boolean;
    events: WebhookEvent[];
    platform: 'teams' | 'slack' | 'discord' | 'generic';
    retryAttempts?: number;
    timeout?: number;
}

export type WebhookEvent = 'pr_created' | 'pr_updated' | 'pr_merged' | 'pr_closed';

export interface WebhookPayload {
    event: WebhookEvent;
    pullRequest: {
        id: string;
        title: string;
        description: string;
        url: string;
        author: string;
        sourceBranch: string;
        targetBranch: string;
        repository: string;
        aiGenerated: boolean;
        modelUsed?: string;
        filesChanged: number;
        commits: number;
    };
    timestamp: string;
    metadata: {
        extensionVersion: string;
        workspaceFolder: string;
        vsCodeVersion: string;
    };
}

export interface TeamsMessage {
    "@type": "MessageCard";
    "@context": "http://schema.org/extensions";
    themeColor: string;
    summary: string;
    sections: TeamsSection[];
    potentialAction?: TeamsAction[];
}

export interface TeamsSection {
    activityTitle: string;
    activitySubtitle?: string;
    activityImage?: string;
    facts: TeamsFact[];
    markdown?: boolean;
}

export interface TeamsFact {
    name: string;
    value: string;
}

export interface TeamsAction {
    "@type": "OpenUri";
    name: string;
    targets: Array<{
        os: "default";
        uri: string;
    }>;
}

export interface WebhookHistoryItem {
    id: string;
    webhookName: string;
    event: WebhookEvent;
    timestamp: string;
    success: boolean;
    responseTime?: number;
    error?: string;
    url: string;
}

export class WebhookService {
    private webhooks: WebhookConfig[] = [];
    private outputChannel: vscode.OutputChannel;
    private history: WebhookHistoryItem[] = [];

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Smart PR Creator - Webhooks');
        this.loadConfiguration();
        this.loadHistory();
    }

    private loadConfiguration(): void {
        try {
            const config = vscode.workspace.getConfiguration('smartPrCreator');
            const webhookConfigs = config.get<WebhookConfig[]>('webhooks') || [];
            this.webhooks = webhookConfigs.filter(webhook => webhook.enabled);
            
            this.outputChannel.appendLine(`Loaded ${this.webhooks.length} webhook(s)`);
        } catch (error) {
            this.outputChannel.appendLine(`Failed to load webhook configuration: ${error}`);
            this.webhooks = [];
        }
    }

    /**
     * Load webhook history from workspace state
     */
    private loadHistory(): void {
        try {
            // In a real implementation, you would load from persistent storage
            // For now, we'll start with an empty history
            this.history = [];
        } catch (error) {
            this.outputChannel.appendLine(`Failed to load webhook history: ${error}`);
            this.history = [];
        }
    }

    /**
     * Add entry to webhook history
     */
    private addHistoryEntry(
        webhookName: string,
        event: WebhookEvent,
        success: boolean,
        url: string,
        responseTime?: number,
        error?: string
    ): void {
        const historyItem: WebhookHistoryItem = {
            id: Date.now().toString(),
            webhookName,
            event,
            timestamp: new Date().toISOString(),
            success,
            responseTime,
            error,
            url
        };

        this.history.unshift(historyItem); // Add to beginning
        
        // Keep only last 100 entries
        if (this.history.length > 100) {
            this.history = this.history.slice(0, 100);
        }
    }

    /**
     * Send webhook notifications for PR events
     */
    async sendWebhook(event: WebhookEvent, payload: WebhookPayload): Promise<void> {
        const relevantWebhooks = this.webhooks.filter(webhook => 
            webhook.events.includes(event)
        );

        if (relevantWebhooks.length === 0) {
            this.outputChannel.appendLine(`No webhooks configured for event: ${event}`);
            return;
        }

        this.outputChannel.appendLine(`Sending ${event} webhook to ${relevantWebhooks.length} endpoint(s)`);

        const promises = relevantWebhooks.map(webhook => 
            this.sendToWebhook(webhook, payload)
        );

        try {
            const results = await Promise.allSettled(promises);
            const failures = results.filter(result => result.status === 'rejected');
            
            if (failures.length > 0) {
                this.outputChannel.appendLine(`${failures.length} webhook(s) failed to send`);
            }
        } catch (error) {
            this.outputChannel.appendLine(`Error sending webhooks: ${error}`);
        }
    }

    /**
     * Send payload to individual webhook
     */
    private async sendToWebhook(webhook: WebhookConfig, payload: WebhookPayload): Promise<void> {
        const maxRetries = webhook.retryAttempts || 3;
        const timeout = webhook.timeout || 10000;
        const startTime = Date.now();

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                let body: string;

                switch (webhook.platform) {
                    case 'teams':
                        body = JSON.stringify(this.createTeamsMessage(payload));
                        break;
                    case 'slack':
                        body = JSON.stringify(this.createSlackMessage(payload));
                        break;
                    case 'discord':
                        body = JSON.stringify(this.createDiscordMessage(payload));
                        break;
                    default:
                        body = JSON.stringify(payload);
                }

                await this.sendHttpRequest(webhook.url, body, timeout);
                
                const responseTime = Date.now() - startTime;
                this.outputChannel.appendLine(`✅ Webhook sent successfully: ${webhook.name} (attempt ${attempt}, ${responseTime}ms)`);
                
                // Record successful webhook
                this.addHistoryEntry(webhook.name, payload.event, true, webhook.url, responseTime);
                return; // Success, exit retry loop
                
            } catch (error) {
                this.outputChannel.appendLine(`❌ Attempt ${attempt}/${maxRetries} failed for ${webhook.name}: ${error}`);
                
                if (attempt === maxRetries) {
                    // Final attempt failed, show user notification and record failure
                    const responseTime = Date.now() - startTime;
                    this.addHistoryEntry(webhook.name, payload.event, false, webhook.url, responseTime, String(error));
                    
                    vscode.window.showWarningMessage(
                        `Failed to send webhook to ${webhook.name} after ${maxRetries} attempts`
                    );
                    throw error;
                }
                
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
    }

    /**
     * Create Microsoft Teams message card
     */
    private createTeamsMessage(payload: WebhookPayload): TeamsMessage {
        const { pullRequest, event, timestamp } = payload;
        
        // Color coding for different events
        const colors = {
            pr_created: '0078d4',  // Microsoft Blue
            pr_updated: 'ffa500',  // Orange
            pr_merged: '107c10',   // Green
            pr_closed: 'd13438'    // Red
        };

        const eventTitles = {
            pr_created: '🚀 New Pull Request Created',
            pr_updated: '📝 Pull Request Updated', 
            pr_merged: '✅ Pull Request Merged',
            pr_closed: '❌ Pull Request Closed'
        };

        const facts: TeamsFact[] = [
            { name: 'Repository', value: pullRequest.repository },
            { name: 'Branch', value: `${pullRequest.sourceBranch} → ${pullRequest.targetBranch}` },
            { name: 'Author', value: pullRequest.author },
            { name: 'Files Changed', value: pullRequest.filesChanged.toString() },
            { name: 'Commits', value: pullRequest.commits.toString() },
            { name: 'Created', value: new Date(timestamp).toLocaleString() }
        ];

        if (pullRequest.aiGenerated && pullRequest.modelUsed) {
            facts.push({ 
                name: '🤖 AI Generated', 
                value: `Yes (${pullRequest.modelUsed})` 
            });
        }

        const teamsMessage: TeamsMessage = {
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            themeColor: colors[event],
            summary: `${eventTitles[event]}: ${pullRequest.title}`,
            sections: [
                {
                    activityTitle: eventTitles[event],
                    activitySubtitle: pullRequest.title,
                    activityImage: "https://raw.githubusercontent.com/microsoft/vscode/main/resources/win32/code_70x70.png",
                    facts: facts,
                    markdown: true
                }
            ]
        };

        // Add description section if available and not too long
        if (pullRequest.description && pullRequest.description.trim().length > 0) {
            const description = pullRequest.description.length > 300 
                ? pullRequest.description.substring(0, 300) + '...'
                : pullRequest.description;
                
            teamsMessage.sections.push({
                activityTitle: "📋 Description",
                activitySubtitle: description,
                facts: [],
                markdown: true
            });
        }

        // Add action button to view PR
        if (pullRequest.url) {
            teamsMessage.potentialAction = [
                {
                    "@type": "OpenUri",
                    name: "View Pull Request",
                    targets: [
                        {
                            os: "default",
                            uri: pullRequest.url
                        }
                    ]
                }
            ];
        }

        return teamsMessage;
    }

    /**
     * Create Slack message (for future use)
     */
    private createSlackMessage(payload: WebhookPayload): any {
        const { pullRequest, event } = payload;
        
        const eventEmojis = {
            pr_created: '🚀',
            pr_updated: '📝',
            pr_merged: '✅',
            pr_closed: '❌'
        };

        const colors = {
            pr_created: 'good',
            pr_updated: 'warning',
            pr_merged: 'good',
            pr_closed: 'danger'
        };

        return {
            text: `${eventEmojis[event]} Pull Request ${event.replace('pr_', '').replace('_', ' ')}`,
            attachments: [
                {
                    color: colors[event],
                    title: pullRequest.title,
                    title_link: pullRequest.url,
                    fields: [
                        {
                            title: 'Repository',
                            value: pullRequest.repository,
                            short: true
                        },
                        {
                            title: 'Author',
                            value: pullRequest.author,
                            short: true
                        },
                        {
                            title: 'Branch',
                            value: `${pullRequest.sourceBranch} → ${pullRequest.targetBranch}`,
                            short: false
                        }
                    ]
                }
            ]
        };
    }

    /**
     * Create Discord message (for future use)
     */
    private createDiscordMessage(payload: WebhookPayload): any {
        const { pullRequest, event } = payload;
        
        const colors = {
            pr_created: 3447003,   // Blue
            pr_updated: 16776960,  // Yellow
            pr_merged: 3066993,    // Green
            pr_closed: 15158332    // Red
        };

        return {
            embeds: [
                {
                    title: `Pull Request ${event.replace('pr_', '').replace('_', ' ')}`,
                    description: pullRequest.title,
                    color: colors[event],
                    url: pullRequest.url,
                    fields: [
                        {
                            name: 'Repository',
                            value: pullRequest.repository,
                            inline: true
                        },
                        {
                            name: 'Author',
                            value: pullRequest.author,
                            inline: true
                        },
                        {
                            name: 'Branch',
                            value: `${pullRequest.sourceBranch} → ${pullRequest.targetBranch}`,
                            inline: false
                        }
                    ],
                    timestamp: payload.timestamp
                }
            ]
        };
    }

    /**
     * Send HTTP request to webhook URL
     */
    private async sendHttpRequest(url: string, body: string, timeout: number = 10000): Promise<void> {
        return new Promise((resolve, reject) => {
            const urlObject = new URL(url);
            const isHttps = urlObject.protocol === 'https:';
            const client = isHttps ? https : http;

            const options = {
                hostname: urlObject.hostname,
                port: urlObject.port || (isHttps ? 443 : 80),
                path: urlObject.pathname + urlObject.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                    'User-Agent': 'Smart-PR-Creator-Extension'
                },
                timeout: timeout
            };

            const req = client.request(options, (res) => {
                let responseData = '';
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve();
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.write(body);
            req.end();
        });
    }

    /**
     * Test webhook connectivity
     */
    async testWebhook(url: string, platform: 'teams' | 'slack' | 'discord' | 'generic' = 'teams'): Promise<boolean> {
        try {
            const testPayload: WebhookPayload = {
                event: 'pr_created',
                pullRequest: {
                    id: 'test-123',
                    title: '🧪 Test Webhook from Smart PR Creator',
                    description: 'This is a test message to verify webhook connectivity. If you see this, your webhook is working correctly!',
                    url: 'https://github.com/microsoft/vscode',
                    author: 'Smart PR Creator Extension',
                    sourceBranch: 'feature/test-webhook',
                    targetBranch: 'main',
                    repository: 'test/project/repository',
                    aiGenerated: true,
                    modelUsed: 'GPT-4o',
                    filesChanged: 5,
                    commits: 3
                },
                timestamp: new Date().toISOString(),
                metadata: {
                    extensionVersion: '1.0.0',
                    workspaceFolder: 'test-workspace',
                    vsCodeVersion: vscode.version
                }
            };

            const testWebhook: WebhookConfig = {
                name: 'Test Webhook',
                url: url,
                enabled: true,
                events: ['pr_created'],
                platform: platform,
                retryAttempts: 1,
                timeout: 10000
            };

            await this.sendToWebhook(testWebhook, testPayload);
            return true;
        } catch (error) {
            this.outputChannel.appendLine(`Webhook test failed: ${error}`);
            return false;
        }
    }

    /**
     * Add a new webhook configuration
     */
    async addWebhook(webhook: WebhookConfig): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('smartPrCreator');
            const existingWebhooks = config.get<WebhookConfig[]>('webhooks') || [];
            
            // Check if webhook with same name already exists
            const existingIndex = existingWebhooks.findIndex(w => w.name === webhook.name);
            
            if (existingIndex >= 0) {
                existingWebhooks[existingIndex] = webhook;
            } else {
                existingWebhooks.push(webhook);
            }
            
            await config.update('webhooks', existingWebhooks, vscode.ConfigurationTarget.Workspace);
            this.loadConfiguration(); // Reload after update
            
            this.outputChannel.appendLine(`Added/updated webhook: ${webhook.name}`);
        } catch (error) {
            throw new Error(`Failed to save webhook configuration: ${error}`);
        }
    }

    /**
     * Remove a webhook configuration
     */
    async removeWebhook(webhookName: string): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('smartPrCreator');
            const existingWebhooks = config.get<WebhookConfig[]>('webhooks') || [];
            
            const filteredWebhooks = existingWebhooks.filter(w => w.name !== webhookName);
            
            await config.update('webhooks', filteredWebhooks, vscode.ConfigurationTarget.Workspace);
            this.loadConfiguration(); // Reload after update
            
            this.outputChannel.appendLine(`Removed webhook: ${webhookName}`);
        } catch (error) {
            throw new Error(`Failed to remove webhook: ${error}`);
        }
    }

    /**
     * Get all configured webhooks
     */
    getWebhooks(): WebhookConfig[] {
        return [...this.webhooks];
    }

    /**
     * Get webhook history
     */
    async getWebhookHistory(): Promise<WebhookHistoryItem[]> {
        return [...this.history];
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.outputChannel.dispose();
    }
}
