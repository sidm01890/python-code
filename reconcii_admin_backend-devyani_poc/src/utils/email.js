const nodemailer = require("nodemailer");

const sendEmail = async ({ to, subject, text }) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false, // true for 465, false for other ports like 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text,
    });

    console.log("Email sent: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    throw new Error("Failed to send email");
  }
};

module.exports = { sendEmail };
