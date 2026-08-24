export function priceAlertEmailHtml(
	marketTitle: string,
	stockType: string,
	currentPrice: number,
): string {
	return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><title>Price Alert Triggered</title></head>
<body style="font-family: Arial, sans-serif; background: #0f0f0f; color: #fff; padding: 40px;">
  <div style="max-width: 480px; margin: 0 auto; background: #1a1a1a; border-radius: 12px; padding: 32px; border: 1px solid #2a2a2a;">
    <h1 style="color: #6366f1; margin: 0 0 8px;">Probstreet</h1>
    <p style="color: #aaa; margin: 0 0 32px; font-size: 14px;">Price Alert Triggered</p>
    <h2 style="margin: 0 0 16px;">${marketTitle}</h2>
    <p style="color: #ccc; margin-bottom: 24px;">Your price alert has been triggered.</p>
    <div style="background: #2a2a2a; border-radius: 8px; padding: 24px; text-align: center; font-size: 24px; font-weight: bold; color: ${stockType === 'YES' ? '#22c55e' : '#ef4444'};">
      ${stockType} is now ₹${currentPrice.toFixed(2)}
    </div>
    <p style="color: #555; margin-top: 24px; font-size: 12px;">You received this because you set a price alert for this market.</p>
  </div>
</body>
</html>`;
}
