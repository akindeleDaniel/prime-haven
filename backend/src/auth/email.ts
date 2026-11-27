export interface InvitationEmail {
  recipientName: string;
  recipientEmail: string;
  token: string;
  expiresAt: Date;
}

export interface InvitationMailer {
  sendInvitation(message: InvitationEmail): Promise<void>;
}

const ZEPTOMAIL_ENDPOINT = "https://api.zeptomail.com/v1.1/email";

export class ZeptoMailInvitationMailer implements InvitationMailer {
  async sendInvitation(message: InvitationEmail): Promise<void> {
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
    const acceptanceUrl = new URL("/activate", origin);
    acceptanceUrl.searchParams.set("token", message.token);
    const safeName = escapeHtml(message.recipientName);
    const link = escapeHtml(acceptanceUrl.toString());
    const response = await fetch(ZEPTOMAIL_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Zoho-enczapikey ${token}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        from: { address: fromAddress, name: fromName },
        to: [{ email_address: { address: message.recipientEmail, name: message.recipientName } }],
        subject: "Activate your Prime Haven Properties account",
        htmlbody: `<p>Hello ${safeName},</p><p>Set your password to activate your agent account. This single-use link expires in 48 hours, at ${message.expiresAt.toISOString()} UTC.</p><p><a href="${link}">Activate account</a></p>`,
        textbody: `Hello ${message.recipientName},\n\nActivate your Prime Haven Properties account by setting a password: ${acceptanceUrl}\n\nThis single-use link expires in 48 hours, at ${message.expiresAt.toISOString()} UTC.`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("ZeptoMail rejected the invitation message.");
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
