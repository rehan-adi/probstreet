export const getArchiveFailedTemplate = (symbol: string, error: string) => `
<div style="font-family: sans-serif; color: #333;">
	<h2 style="color: #e53e3e;">CRITICAL: Market Archival Failed</h2>
	<p>The matching engine failed to archive market <strong>${symbol}</strong> to S3 after multiple retries.</p>
	<p><strong>Error Details:</strong> ${error}</p>
	<p>The market data is currently retained in memory. Please manually intervene or check the bucket permissions.</p>
</div>
`;
