export interface OracleConfig {
	resolver?: 'crypto_price' | 'sports_match' | 'stock_price' | 'json_compare';

	resultPath?: string;
	condition?: 'gte' | 'lte' | 'eq' | 'gt' | 'lt' | 'equals' | 'home_win' | 'away_win' | 'draw';
	targetValue?: number | string;

	// Crypto-specific
	asset?: string; // e.g., "bitcoin", "ethereum"

	// Sports-specific
	finishedStatus?: string; // e.g., "FT" for full-time
	statusPath?: string; // JSONPath to match status
	team?: string;
	homePath?: string;
	awayPath?: string;
	homeTeamPath?: string;

	// Stock-specific
	ticker?: string; // e.g., "TSLA"

	// Retry config
	retryIntervalMinutes?: number; // Default: 30
	maxRetries?: number; // Default: 48 (24 hours at 30 min intervals)
}

export interface ResolverResult {
	success: boolean;
	verdict?: 'YES' | 'NO';
	confidence?: number; // 0-100
	rawData?: any;
	error?: string;
}

export interface RubricScores {
	eventCompletion: number; // 0 or 25
	sourceAuthority: number; // 0 or 20
	ruleMatch: number; // 0 or 25
	dataClarity: number; // 0 or 20
	corroboration: number; // 0 or 10
}

export interface AIEvaluation {
	verdict: 'YES' | 'NO' | 'INCONCLUSIVE';
	rubricScores: RubricScores;
	totalScore: number;
	reasoning: string;
}

export interface PipelineResult {
	resolved: boolean;
	verdict?: 'YES' | 'NO';
	source: 'deterministic' | 'ai' | 'admin_required';
	rubricScore?: number;
	reasoning?: string;
	rawData?: any;
	error?: string;
}
