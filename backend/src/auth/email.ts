export interface InvitationEmail {
  recipientName: string;
  recipientEmail: string;
  token: string;
  expiresAt: Date;
}

export interface InvitationMailer {
  sendInvitation(message: InvitationEmail): Promise<void>;
  sendPasswordReset(message: InvitationEmail): Promise<void>;
}

const ZEPTOMAIL_ENDPOINT = "https://api.zeptomail.com/v1.1/email";

export class ZeptoMailInvitationMailer implements InvitationMailer {
  async sendInvitation(message: InvitationEmail): Promise<void> {
    return this.sendAccountEmail(message, false);
  }

  async sendPasswordReset(message: InvitationEmail): Promise<void> {
    return this.sendAccountEmail(message, true);
  }

  private async sendAccountEmail(message: InvitationEmail, reset: boolean): Promise<void> {
    const token = process.env.ZEPTOMAIL_API_TOKEN;
    const fromAddress = process.env.ZEPTOMAIL_FROM_EMAIL;
    const fromName = process.env.ZEPTOMAIL_FROM_NAME ?? "Prime Haven Properties";
    const appOrigin = process.env.APP_ORIGIN;
    if (!token || !fromAddress || !appOrigin) throw new Error("Invitation email is not configured.");
    const origin = new URL(appOrigin);
    if (origin.href !== `${origin.origin}/` || (origin.protocol !== "https:" &&
      !(origin.protocol === "http:" && process.env.AUTH_ALLOW_LOCAL_HTTP === "true" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)))) {
      throw new Error("Invitation URL origin is invalid.");
    }
    const acceptanceUrl = new URL(reset ? "/reset-password" : "/activate", origin);
    acceptanceUrl.searchParams.set("token", message.token);
    const safeName = escapeHtml(message.recipientName);
    const link = escapeHtml(acceptanceUrl.toString());
    const action = reset ? "Reset your password" : "Activate account";
    const lifetime = reset ? "30 minutes" : "48 hours";
    const response = await fetch(ZEPTOMAIL_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Zoho-enczapikey ${token}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        from: { address: fromAddress, name: fromName },
        to: [{ email_address: { address: message.recipientEmail, name: message.recipientName } }],
        subject: reset ? "Reset your Prime Haven Properties password" : "Activate your Prime Haven Properties account",
        htmlbody: `<p>Hello ${safeName},</p><p>This single-use link expires in ${lifetime}, at ${message.expiresAt.toISOString()}.</p><p><a href="${link}">${action}</a></p>`,
        textbody: `Hello ${message.recipientName},\n\n${action}: ${acceptanceUrl}\n\nThis single-use link expires in ${lifetime}, at ${message.expiresAt.toISOString()}.`,
      }),
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
    if (!response.ok) throw new Error("ZeptoMail rejected the invitation message.");
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
