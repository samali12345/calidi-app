const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendVerificationEmail = async (to, token) => {
  const verifyUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"Calidi Clothing" <${process.env.SMTP_USER}>`,
    to,
    subject: "Verify your Calidi account",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Welcome to Calidi</h2>
        <p>Click the button below to verify your email address:</p>
        <a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:4px;">
          Verify Email
        </a>
        <p style="margin-top:16px;color:#888;font-size:13px;">This link expires in 24 hours.</p>
      </div>
    `,
  });
};

module.exports = { sendVerificationEmail };
