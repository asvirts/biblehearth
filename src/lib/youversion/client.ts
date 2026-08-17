import { ApiClient, BibleClient } from '@youversion/platform-core';
import { YVP_APP_KEY } from 'astro:env/server';

export class PlatformConfigError extends Error {
	constructor() {
		super('YouVersion Platform is not configured');
		this.name = 'PlatformConfigError';
	}
}

export function isPlatformConfigured(): boolean {
	return Boolean(YVP_APP_KEY);
}

export function getBibleClient(): BibleClient {
	if (!YVP_APP_KEY) {
		throw new PlatformConfigError();
	}

	const apiClient = new ApiClient({
		appKey: YVP_APP_KEY,
		timeout: 10_000,
	});

	return new BibleClient(apiClient);
}
