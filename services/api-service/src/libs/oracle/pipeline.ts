import { logger } from '@/libs/logger';
import { Market } from '@probstreet/database';
import { evaluateWithAI } from './resolvers/ai';
import { tavilyClient } from '@/libs/tavily/client';
import { OracleConfig, PipelineResult } from './types';
import { deterministicResolvers } from './resolvers/deterministic';

export async function runResolutionPipeline(market: Market): Promise<PipelineResult> {
	const config = market.oracleConfig as unknown as OracleConfig | null;

	logger.info({ marketId: market.id, symbol: market.symbol }, 'Starting resolution pipeline');

	try {
		let evidenceStr = '';

		// 1. Fetch from sourceOfTruth if provided
		if (market.sourceOfTruth) {
			try {
				const res = await fetch(market.sourceOfTruth);
				if (res.ok) {
					// We'll parse JSON if possible, otherwise keep as text
					const contentType = res.headers.get('content-type') || '';
					if (contentType.includes('application/json')) {
						const json = await res.json();
						evidenceStr = JSON.stringify(json, null, 2);

						// 2. Try deterministic resolver if we got JSON and have a config
						if (config && config.resolver && deterministicResolvers[config.resolver]) {
							const resolver = deterministicResolvers[config.resolver];
							const result = resolver(json, config);

							if (result.success && result.verdict) {
								logger.info(
									{ marketId: market.id, verdict: result.verdict },
									'Deterministic resolver succeeded',
								);
								return {
									resolved: true,
									verdict: result.verdict,
									source: 'deterministic',
									rawData: json,
								};
							} else {
								logger.warn(
									{ marketId: market.id, error: result.error },
									'Deterministic resolver did not meet completion criteria - skipping AI to save costs',
								);
								return {
									resolved: false,
									source: 'deterministic',
									error:
										result.error || 'Deterministic criteria not met or event still in progress',
									rawData: json,
								};
							}
						}
					} else {
						evidenceStr = await res.text();
					}
				} else {
					logger.warn({ status: res.status }, 'Failed to fetch sourceOfTruth URL');
				}
			} catch (err: any) {
				logger.error({ err }, 'Error fetching sourceOfTruth');
			}
		}

		// 3. Fallback to Tavily Search if no evidence yet
		if (!evidenceStr || evidenceStr.trim().length === 0) {
			logger.info({ marketId: market.id }, 'Fetching evidence via Tavily search');
			const query = `Has the event occurred: ${market.title} ${market.rules || ''}`;
			const searchRes = await tavilyClient.search(query, {
				searchDepth: 'advanced',
				includeAnswer: true,
			});
			evidenceStr = JSON.stringify(
				{
					answer: searchRes.answer,
					results: searchRes.results.map((r) => ({
						title: r.title,
						content: r.content,
						url: r.url,
					})),
				},
				null,
				2,
			);
		}

		// 4. AI Evaluation
		logger.info({ marketId: market.id }, 'Starting AI evaluation');
		const evaluation = await evaluateWithAI(evidenceStr, market);

		logger.info(
			{ marketId: market.id, score: evaluation.totalScore, verdict: evaluation.verdict },
			'AI Evaluation complete',
		);

		// 5. Decision Gate
		if (evaluation.totalScore >= 90 && evaluation.verdict !== 'INCONCLUSIVE') {
			return {
				resolved: true,
				verdict: evaluation.verdict,
				source: 'ai',
				rubricScore: evaluation.totalScore,
				reasoning: evaluation.reasoning,
				rawData: evidenceStr,
			};
		} else {
			return {
				resolved: false,
				source: 'admin_required',
				rubricScore: evaluation.totalScore,
				verdict: evaluation.verdict === 'INCONCLUSIVE' ? undefined : evaluation.verdict,
				reasoning: evaluation.reasoning,
				rawData: evidenceStr,
			};
		}
	} catch (error: any) {
		logger.error({ err: error, marketId: market.id }, 'Pipeline failed');
		return {
			resolved: false,
			source: 'ai',
			error: error.message,
		};
	}
}
