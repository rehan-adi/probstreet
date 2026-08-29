import { Market } from '@probstreet/database';
import { AIEvaluation, RubricScores } from '../types';
import { callGroqLLM } from '../llm/groq';

export async function evaluateWithAI(evidence: string, market: Market): Promise<AIEvaluation> {
	const prompt = buildRubricPrompt(evidence, market);
	const rawResponse = await callGroqLLM(prompt);

	try {
		return parseRubricResponse(rawResponse);
	} catch (error: any) {
		throw new Error(`Failed to parse AI rubric response: ${error.message}`);
	}
}

function buildRubricPrompt(evidence: string, market: Market): string {
	const rules = market.rules || market.eos || 'No specific rules provided.';
	const sourceOfTruth = market.sourceOfTruth || 'General web search';

	return `You are an Oracle evaluating whether a prediction market event has occurred.

MARKET TITLE: "${market.title}"
RESOLUTION RULES: "${rules}"
SOURCE OF TRUTH: "${sourceOfTruth}"

EVIDENCE (raw data from external source or search):
${evidence}

Evaluate against this rubric and score EACH criterion:

1. EVENT_COMPLETION (0 or 25): Does the evidence confirm the event has concluded/finished (not still in progress)?
2. SOURCE_AUTHORITY (0 or 20): Is this evidence from an authoritative/official source?
3. RULE_MATCH (0 or 25): Does the outcome clearly satisfy the market's YES or NO condition per the resolution rules?
4. DATA_CLARITY (0 or 20): Is the relevant data (score, price, result) explicitly and unambiguously stated?
5. CORROBORATION (0 or 10): Are there multiple data points or sources in agreement?

Respond in this exact JSON format:
{
  "verdict": "YES" or "NO" or "INCONCLUSIVE",
  "rubricScores": {
    "eventCompletion": <0 or 25>,
    "sourceAuthority": <0 or 20>,
    "ruleMatch": <0 or 25>,
    "dataClarity": <0 or 20>,
    "corroboration": <0 or 10>
  },
  "totalScore": <sum of all scores, 0-100>,
  "reasoning": "<2-3 sentence explanation of your evaluation>"
}`;
}

function parseRubricResponse(responseBody: string): AIEvaluation {
	// Sometimes Gemini includes markdown JSON blocks
	let cleanJson = responseBody.trim();
	if (cleanJson.startsWith('```json')) {
		cleanJson = cleanJson.replace(/^```json\n/, '').replace(/\n```$/, '');
	}

	const parsed = JSON.parse(cleanJson);

	if (!parsed.verdict || !parsed.rubricScores || typeof parsed.totalScore !== 'number') {
		throw new Error('Invalid JSON structure from AI');
	}

	// Validate verdict
	if (!['YES', 'NO', 'INCONCLUSIVE'].includes(parsed.verdict)) {
		throw new Error(`Invalid verdict: ${parsed.verdict}`);
	}

	return {
		verdict: parsed.verdict as 'YES' | 'NO' | 'INCONCLUSIVE',
		rubricScores: parsed.rubricScores as RubricScores,
		totalScore: parsed.totalScore,
		reasoning: parsed.reasoning || 'No reasoning provided.',
	};
}
