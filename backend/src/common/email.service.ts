import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendPasswordResetEmail(
    toEmail: string,
    rawToken: string,
  ): Promise<void> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const cleanFrontendUrl = frontendUrl.replace(/\/+$/, '');
    const resetUrl = `${cleanFrontendUrl}/#/reset-password?token=${encodeURIComponent(rawToken)}`;

    const apiKey = this.configService.get<string>('EMAIL_PROVIDER_API_KEY');
    const fromEmail =
      this.configService.get<string>('EMAIL_FROM') || 'noreply@primeplate.com';

    const subject = 'PrimePlate Password Reset';
    const textContent = `Someone requested a password reset for your PrimePlate account.

Reset Password: ${resetUrl}

This link expires in 15 minutes.

If you did not request this, you can ignore this email.`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <h2 style="color: #0f172a;">PrimePlate Password Reset</h2>
        <p>Someone requested a password reset for your PrimePlate account.</p>
        <div style="margin: 24px 0;">
          <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="font-size: 14px; color: #64748b;">This link expires in 15 minutes.</p>
        <p style="font-size: 14px; color: #64748b;">If you did not request this, you can ignore this email.</p>
      </div>
    `;

    if (apiKey) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [toEmail],
            subject,
            html: htmlContent,
            text: textContent,
          }),
        });

        if (!response.ok) {
          this.logger.error(
            `Transactional email delivery failed with status ${response.status}`,
          );
        } else {
          this.logger.log(
            `Password reset email successfully dispatched to subscriber.`,
          );
        }
      } catch (err: any) {
        this.logger.error(`Error sending password reset email: ${err.message}`);
      }
    } else {
      this.logger.log(
        `[EmailService] Password reset link generated for ${toEmail}: ${resetUrl}`,
      );
    }
  }
}
