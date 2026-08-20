import { Resend } from "resend";

let client: Resend | null = null;

function getClient() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

export async function sendEmail({
  subject,
  html,
}: {
  subject: string;
  html: string;
}) {
  const resend = getClient();
  const to = process.env.ALERT_EMAIL_TO;
  if (!resend || !to) {
    console.warn("sendEmail skipped: RESEND_API_KEY or ALERT_EMAIL_TO not set");
    return;
  }
  try {
    await resend.emails.send({
      from: "Polymarket App <onboarding@resend.dev>",
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error("sendEmail failed:", err);
  }
}
