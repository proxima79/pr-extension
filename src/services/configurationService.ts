import * as vscode from 'vscode';

export class ConfigurationService {
    private readonly configSection = 'smartPrCreator';

    get<T>(key: string): T | undefined {
        const config = vscode.workspace.getConfiguration(this.configSection);
        return config.get<T>(key);
    }

    async set<T>(key: string, value: T, configurationTarget?: vscode.ConfigurationTarget): Promise<void> {
        const config = vscode.workspace.getConfiguration(this.configSection);
        await config.update(key, value, configurationTarget);
    }

    getDefaultTarget(): string {
        return this.get<string>('defaultTarget') || 'main';
    }

    getAIProvider(): string {
        return this.get<string>('aiProvider') || 'openai';
    }

    getPlatform(): string {
        return this.get<string>('platform') || 'github';
    }

    shouldIncludeFileChanges(): boolean {
        return this.get<boolean>('includeFileChanges') ?? true;
    }

    getMaxFilesToAnalyze(): number {
        return this.get<number>('maxFilesToAnalyze') || 50;
    }

    async updateDefaultTarget(target: string): Promise<void> {
        await this.set('defaultTarget', target);
    }

    async updateAIProvider(provider: string): Promise<void> {
        await this.set('aiProvider', provider);
    }

    async updatePlatform(platform: string): Promise<void> {
        await this.set('platform', platform);
    }

    // Get all configuration as an object
    getAllConfig(): any {
        const config = vscode.workspace.getConfiguration(this.configSection);
        return {
            defaultTarget: this.getDefaultTarget(),
            aiProvider: this.getAIProvider(),
            platform: this.getPlatform(),
            includeFileChanges: this.shouldIncludeFileChanges(),
            maxFilesToAnalyze: this.getMaxFilesToAnalyze()
        };
    }

    // Listen for configuration changes
    onConfigurationChanged(callback: (e: vscode.ConfigurationChangeEvent) => void): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(this.configSection)) {
                callback(e);
            }
        });
    }
}
