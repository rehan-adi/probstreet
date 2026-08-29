import { OracleConfig, ResolverResult } from '../types';

/**
 * Utility to extract a value using a dot-notation JSON path
 * e.g., getByPath({ a: { b: { c: 42 } } }, "a.b.c") => 42
 */
function getByPath(obj: any, path?: string): any {
	if (!path) return undefined;
	return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

/**
 * Compare two values based on a condition string
 */
function compareCondition(value: any, condition: string | undefined, target: any): boolean {
	const v = Number(value);
	const t = Number(target);

	if (isNaN(v) || isNaN(t)) {
		// String comparison
		switch (condition) {
			case 'eq':
			case 'equals':
				return String(value).toLowerCase() === String(target).toLowerCase();
			default:
				return false;
		}
	}

	// Number comparison
	switch (condition) {
		case 'gte':
			return v >= t;
		case 'lte':
			return v <= t;
		case 'gt':
			return v > t;
		case 'lt':
			return v < t;
		case 'eq':
		case 'equals':
			return v === t;
		default:
			return false;
	}
}

// ----------------------------------------------------------------------------
// Specific Resolvers
// ----------------------------------------------------------------------------

export function resolveCryptoPrice(apiResponse: any, config: OracleConfig): ResolverResult {
	if (!config.resultPath || !config.condition || config.targetValue === undefined) {
		return { success: false, error: 'Missing required config for crypto_price' };
	}

	const price = getByPath(apiResponse, config.resultPath);
	if (price === undefined) {
		return { success: false, error: `Value not found at path: ${config.resultPath}` };
	}

	const met = compareCondition(price, config.condition, config.targetValue);
	return { success: true, verdict: met ? 'YES' : 'NO', confidence: 100 };
}

export function resolveSportsMatch(apiResponse: any, config: OracleConfig): ResolverResult {
	if (!config.statusPath || !config.finishedStatus) {
		return { success: false, error: 'Missing status config for sports_match' };
	}

	const status = getByPath(apiResponse, config.statusPath);
	if (status !== config.finishedStatus) {
		// Event not finished yet
		return { success: false, error: `Match not finished. Current status: ${status}` };
	}

	if (!config.homePath || !config.awayPath || !config.condition) {
		return { success: false, error: 'Missing goals config for sports_match' };
	}

	const homeGoals = Number(getByPath(apiResponse, config.homePath));
	const awayGoals = Number(getByPath(apiResponse, config.awayPath));

	if (isNaN(homeGoals) || isNaN(awayGoals)) {
		return { success: false, error: 'Invalid goal counts' };
	}

	// Assuming a simple "home team win" or "away team win" condition for now
	// Expand this logic based on actual sports market types (e.g., over/under)
	let met = false;
	if (config.condition === 'home_win') {
		met = homeGoals > awayGoals;
	} else if (config.condition === 'away_win') {
		met = awayGoals > homeGoals;
	} else if (config.condition === 'draw') {
		met = homeGoals === awayGoals;
	} else {
		return { success: false, error: `Unknown sports condition: ${config.condition}` };
	}

	return { success: true, verdict: met ? 'YES' : 'NO', confidence: 100 };
}

export function resolveJsonCompare(apiResponse: any, config: OracleConfig): ResolverResult {
	if (!config.resultPath || !config.condition || config.targetValue === undefined) {
		return { success: false, error: 'Missing required config for json_compare' };
	}

	const value = getByPath(apiResponse, config.resultPath);
	if (value === undefined) {
		return { success: false, error: `Value not found at path: ${config.resultPath}` };
	}

	const met = compareCondition(value, config.condition, config.targetValue);
	return { success: true, verdict: met ? 'YES' : 'NO', confidence: 100 };
}

export const deterministicResolvers: Record<
	string,
	(response: any, config: OracleConfig) => ResolverResult
> = {
	crypto_price: resolveCryptoPrice,
	sports_match: resolveSportsMatch,
	json_compare: resolveJsonCompare,
};
