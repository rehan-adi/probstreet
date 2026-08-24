export function otpEmailHtml(otp: string): string {
	return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family: Arial, sans-serif; background: #0f0f0f; color: #fff; padding: 40px; margin: 0;">
  <div style="max-width: 480px; margin: 0 auto; background: #1a1a1a; border-radius: 12px; padding: 32px; border: 1px solid #2a2a2a;">
    <h1 style="color: #6366f1; margin: 0 0 4px; font-size: 22px;">Probstreet</h1>
    <p style="color: #666; margin: 0 0 32px; font-size: 13px;">Opinion Trading Platform</p>
    <h2 style="margin: 0 0 12px; font-size: 18px;">Your Login Code</h2>
    <p style="color: #aaa; margin-bottom: 24px; font-size: 14px;">
      Use this code to sign in. It expires in <strong style="color: #fff;">5 minutes</strong>.
    </p>
    <div style="background: #2a2a2a; border-radius: 10px; padding: 24px; text-align: center; letter-spacing: 10px; font-size: 38px; font-weight: bold; color: #6366f1; font-family: monospace;">
      ${otp}
    </div>
    <p style="color: #444; margin-top: 28px; font-size: 12px; line-height: 1.5;">
      If you did not request this code, you can safely ignore this email.
      Someone may have typed your email address by mistake.
    </p>
  </div>
</body>
</html>`;
}
