export function tradeExecutedEmailHtml(
	marketTitle: string,
	stockType: string,
	price: number,
	quantity: number,
	totalValue: number,
): string {
	return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><title>Trade Executed</title></head>
<body style="font-family: Arial, sans-serif; background: #0f0f0f; color: #fff; padding: 40px;">
  <div style="max-width: 480px; margin: 0 auto; background: #1a1a1a; border-radius: 12px; padding: 32px; border: 1px solid #2a2a2a;">
    <h1 style="color: #6366f1; margin: 0 0 8px;">Probstreet</h1>
    <p style="color: #aaa; margin: 0 0 32px; font-size: 14px;">Trade Executed</p>
    <h2 style="margin: 0 0 16px;">${marketTitle}</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr><td style="color: #aaa; padding: 8px 0; border-bottom: 1px solid #2a2a2a;">Side</td><td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #2a2a2a; color: ${stockType === 'YES' ? '#22c55e' : '#ef4444'};">${stockType}</td></tr>
      <tr><td style="color: #aaa; padding: 8px 0; border-bottom: 1px solid #2a2a2a;">Price</td><td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #2a2a2a;">₹${price.toFixed(2)}</td></tr>
      <tr><td style="color: #aaa; padding: 8px 0; border-bottom: 1px solid #2a2a2a;">Quantity</td><td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #2a2a2a;">${quantity}</td></tr>
      <tr><td style="color: #aaa; padding: 8px 0;">Total</td><td style="text-align: right; padding: 8px 0; font-weight: bold; color: #6366f1;">₹${totalValue.toFixed(2)}</td></tr>
    </table>
  </div>
</body>
</html>`;
}
