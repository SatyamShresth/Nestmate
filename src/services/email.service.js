// src/services/email.service.js
// Uses Resend — https://resend.com (3000 free emails/month)
//
// .env mein sirf ye 2 lines chahiye:
//   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
//   EMAIL_FROM=NestMate <onboarding@resend.dev>

/**
 * Send password reset email using Resend API
 * @param {string} toEmail   – user ka email
 * @param {string} toName    – user ka naam
 * @param {string} resetToken – plain token (not hashed)
 */
export async function sendPasswordResetEmail(toEmail, toName, resetToken) {
  console.log(
  "RESEND_API_KEY =",
  process.env.RESEND_API_KEY ? "FOUND" : "MISSING"
  );
  const apiKey    = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || 'NestMate <onboarding@resend.dev>';
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5000';
  console.log("CLIENT_URL =", process.env.CLIENT_URL);
  const resetLink = `${clientUrl}/?token=${resetToken}&email=${encodeURIComponent(toEmail)}`;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set in .env');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    fromEmail,
      to:      [toEmail],
      subject: 'Reset your NestMate password',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
          <div style="text-align:center;margin-bottom:24px">
            <h1 style="color:#1a3a2e;font-size:1.5rem;margin:0">🏠 NestMate</h1>
          </div>
          <div style="background:#fff;border-radius:10px;padding:28px 24px;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
            <h2 style="color:#1a3a2e;font-size:1.1rem;margin:0 0 12px">Reset your password</h2>
            <p style="color:#4b5563;font-size:0.9rem;line-height:1.6;margin:0 0 20px">
              Hi ${toName},<br><br>
              We received a request to reset the password for your NestMate account.
              Click the button below to set a new password.
            </p>
            <a href="${resetLink}"
              style="display:inline-block;background:#1a3a2e;color:#fff;text-decoration:none;
                    padding:12px 28px;border-radius:8px;font-size:0.9rem;font-weight:600">
              Reset Password
            </a>
            <p style="color:#9ca3af;font-size:0.8rem;margin:20px 0 0;line-height:1.5">
              This link expires in <strong>1 hour</strong>.<br>
              If you didn't request this, you can safely ignore this email.
            </p>
          </div>
          <p style="text-align:center;color:#9ca3af;font-size:0.75rem;margin-top:20px">
            NestMate · Find your perfect roommate
          </p>
        </div>`,
      text: `Reset your NestMate password\n\nHi ${toName},\n\nClick the link below to reset your password (expires in 1 hour):\n${resetLink}\n\nIf you didn't request this, ignore this email.`,
    }),
  });

  // if (!res.ok) {
  //   const err = await res.json().catch(() => ({}));
  //   throw new Error(`Resend API error: ${err.message || res.status}`);
  // }

console.log("Sending email to:", toEmail);
console.log("Using API Key:", apiKey ? "FOUND" : "MISSING");
console.log("From Email:", fromEmail);

  return await res.json();
}

export async function sendVerificationEmail(
  toEmail,
  toName,
  verifyToken
) {
  console.log('VERIFY EMAIL FUNCTION CALLED');
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  const clientUrl = process.env.CLIENT_URL;

  const verifyLink =
    `${clientUrl}/?verifyToken=${verifyToken}&email=${encodeURIComponent(toEmail)}`;

  const res = await fetch('https://api.resend.com/emails', {
    method:'POST',
    headers:{
      Authorization:`Bearer ${apiKey}`,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({
      from:fromEmail,
      to:[toEmail],
      subject:'Verify your NestMate account',
      html:`
      <h2>Welcome to NestMate</h2>

      <p>Hi ${toName},</p>

      <p>Please verify your email address.</p>

      <a href="${verifyLink}">
        Verify Email
      </a>

      <p>This link expires in 24 hours.</p>
      `
    })
  });

const result = await res.json();

console.log('VERIFY EMAIL RESPONSE:', result);

return result;
}