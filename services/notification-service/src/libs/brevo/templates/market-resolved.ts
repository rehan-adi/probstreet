export function marketResolvedEmailHtml(
	marketTitle: string,
	result: string,
	didWin: boolean,
): string {
	const message = didWin
		? `Congratulations! You won your trades. The market has been resolved to ${result}.`
		: `The market has been resolved to ${result}. Your positions have been settled.`;

	const headerColor = didWin ? '#22c55e' : '#ef4444';
	const headerText = didWin ? 'Market Won' : 'Market Settled';

	return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><title>Market Resolved</title></head>
<body style="font-family: Arial, sans-serif; background: #0f0f0f; color: #fff; padding: 40px;">
  <div style="max-width: 480px; margin: 0 auto; background: #1a1a1a; border-radius: 12px; padding: 32px; border: 1px solid #2a2a2a;">
    <h1 style="color: #6366f1; margin: 0 0 8px;">Probstreet</h1>
    <p style="color: ${headerColor}; margin: 0 0 32px; font-size: 14px; font-weight: bold;">${headerText}</p>
    <h2 style="margin: 0 0 16px; font-size: 18px; line-height: 1.4;">${marketTitle}</h2>
    <p style="color: #ccc; margin: 0 0 24px; font-size: 16px; line-height: 1.5;">
      ${message}
    </p>
    <a href="https://probstreet.rehan.me/portfolio" style="display: inline-block; background: #6366f1; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold;">
      View Portfolio
    </a>
  </div>
</body>
</html>`;
}
