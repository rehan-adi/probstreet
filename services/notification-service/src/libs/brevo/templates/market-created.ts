export function newMarketEmailHtml(marketTitle: string, marketId: string): string {
	return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><title>New Market</title></head>
<body style="font-family: Arial, sans-serif; background: #0f0f0f; color: #fff; padding: 40px;">
  <div style="max-width: 480px; margin: 0 auto; background: #1a1a1a; border-radius: 12px; padding: 32px; border: 1px solid #2a2a2a;">
    <h1 style="color: #6366f1; margin: 0 0 8px;">Probstreet</h1>
    <p style="color: #aaa; margin: 0 0 32px; font-size: 14px;">A new market just launched!</p>
    <h2 style="margin: 0 0 16px;">${marketTitle}</h2>
    <p style="color: #ccc; margin-bottom: 24px;">Trade YES or NO on the outcome of this event.</p>
    <a href="https://probstreet.com/market/${marketId}" style="display: inline-block; background: #6366f1; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Market →</a>
    <p style="color: #555; margin-top: 24px; font-size: 12px;">You received this because you opted in to market notifications.</p>
  </div>
</body>
</html>`;
}
