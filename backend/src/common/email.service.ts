import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

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
    let fromEmail =
      this.configService.get<string>('EMAIL_FROM') || 'PrimePlate <onboarding@resend.dev>';

    // If default primeplate.com sender is configured without explicit domain verification, use Resend onboarding sender
    if (fromEmail.includes('primeplate.com') && this.configService.get<string>('EMAIL_DOMAIN_VERIFIED') !== 'true') {
      fromEmail = 'PrimePlate <onboarding@resend.dev>';
    }

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
          const errBody = await response.text();
          this.logger.error(
            `Resend API Email delivery failed (${response.status}): ${errBody}`,
          );
        } else {
          this.logger.log(
            `Password reset email successfully dispatched to ${toEmail}.`,
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

  async sendSupportTicketEmail(ticketData: {
    ticketNumber: string;
    studentName: string;
    studentEmail: string;
    razorpayOrderId: string;
    amount: number;
    issueType: string;
    description: string;
    utrReference?: string;
  }): Promise<void> {
    const supportEmail =
      this.configService.get<string>('SUPPORT_EMAIL') || 'primeplatesupport@gmail.com';
    const apiKey = this.configService.get<string>('EMAIL_PROVIDER_API_KEY');
    let fromEmail =
      this.configService.get<string>('EMAIL_FROM') || 'PrimePlate <onboarding@resend.dev>';

    if (fromEmail.includes('primeplate.com') && this.configService.get<string>('EMAIL_DOMAIN_VERIFIED') !== 'true') {
      fromEmail = 'PrimePlate <onboarding@resend.dev>';
    }

    const subject = `[SUPPORT TICKET] #${ticketData.ticketNumber} - ${ticketData.issueType}`;
    const textContent = `New Payment Support Ticket Raised:

Ticket Number: ${ticketData.ticketNumber}
Student: ${ticketData.studentName} (${ticketData.studentEmail})
Order ID: ${ticketData.razorpayOrderId}
Amount: ₹${ticketData.amount}
Issue Type: ${ticketData.issueType}
Bank UTR / Ref: ${ticketData.utrReference || 'N/A'}

Description:
${ticketData.description}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #ea580c; margin-top: 0;">Payment Support Ticket #${ticketData.ticketNumber}</h2>
        <p>A new payment issue ticket has been submitted by student <strong>${ticketData.studentName}</strong>.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
          <tr><td style="padding: 8px; font-weight: bold; background: #f8fafc; width: 140px;">Ticket No:</td><td style="padding: 8px; font-family: monospace;">${ticketData.ticketNumber}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; background: #f8fafc;">Student:</td><td style="padding: 8px;">${ticketData.studentName} (${ticketData.studentEmail})</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; background: #f8fafc;">Order ID:</td><td style="padding: 8px; font-family: monospace;">${ticketData.razorpayOrderId}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; background: #f8fafc;">Amount:</td><td style="padding: 8px;">₹${ticketData.amount}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; background: #f8fafc;">Issue Type:</td><td style="padding: 8px;">${ticketData.issueType}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; background: #f8fafc;">Bank UTR / Ref:</td><td style="padding: 8px;">${ticketData.utrReference || 'N/A'}</td></tr>
        </table>

        <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; margin-top: 12px;">
          <strong>Description:</strong>
          <p style="margin: 6px 0 0 0; white-space: pre-wrap;">${ticketData.description}</p>
        </div>
      </div>
    `;

    const smtpUser = this.configService.get<string>('SMTP_USER') || this.configService.get<string>('GMAIL_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS') || this.configService.get<string>('GMAIL_PASS');

    if (smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        await transporter.sendMail({
          from: `"PrimePlate Support" <${smtpUser}>`,
          to: supportEmail,
          subject,
          text: textContent,
          html: htmlContent,
        });
        this.logger.log(`Support ticket email #${ticketData.ticketNumber} delivered to ${supportEmail} via Nodemailer Gmail SMTP.`);
        return;
      } catch (smtpErr: any) {
        this.logger.error(`SMTP Email delivery failed: ${smtpErr.message}`);
      }
    }

    if (apiKey) {
      try {
        let targetTo = [supportEmail];
        let response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: targetTo,
            subject,
            html: htmlContent,
            text: textContent,
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          // If Resend returns 403 sandbox error requiring email to account owner (itharajunikhil61@gmail.com)
          if (response.status === 403 && errBody.includes('testing emails to your own email address')) {
            const ownerEmailMatch = errBody.match(/\(([^)]+)\)/);
            const ownerEmail = ownerEmailMatch ? ownerEmailMatch[1] : 'itharajunikhil61@gmail.com';
            this.logger.warn(`Resend sandbox mode detected. Retrying delivery to registered owner (${ownerEmail})...`);

            const retryResponse = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                from: fromEmail,
                to: [ownerEmail],
                subject: `[TESTING - INTENDED FOR ${supportEmail}] ${subject}`,
                html: htmlContent,
                text: textContent,
              }),
            });

            if (retryResponse.ok) {
              this.logger.log(`Support ticket email #${ticketData.ticketNumber} delivered to Resend account owner inbox (${ownerEmail}).`);
            } else {
              const retryErr = await retryResponse.text();
              this.logger.error(`Resend sandbox retry failed: ${retryErr}`);
            }
          } else {
            this.logger.error(`Resend API Support Email delivery failed (${response.status}): ${errBody}`);
          }
        } else {
          this.logger.log(`Support ticket email #${ticketData.ticketNumber} successfully delivered to ${supportEmail} via Resend.`);
        }
      } catch (err: any) {
        this.logger.error(`Error sending support email: ${err.message}`);
      }
    } else {
      this.logger.log(`[EmailService] Support ticket email #${ticketData.ticketNumber} logged for ${supportEmail}: ${subject}`);
    }
  }
}
