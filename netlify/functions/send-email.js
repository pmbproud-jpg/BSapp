const nodemailer = require("nodemailer");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const GMAIL_USER = process.env.GMAIL_USER || "";
  const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || "";

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: "Gmail SMTP not configured" }) };
  }

  try {
    const { to, userName, actionLink } = JSON.parse(event.body || "{}");

    if (!to || !actionLink) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: "Missing: to, actionLink" }) };
    }

    const name = userName || to;

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    });

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc;">
  <div style="background: #fff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">
    <h1 style="color: #1e293b; font-size: 24px; margin: 0 0 8px;">BSapp</h1>
    <p style="color: #64748b; font-size: 14px; margin: 0 0 24px;">Baustellenmanagement</p>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6;">
      Hallo <strong>${name}</strong>,
    </p>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6;">
      Ihr Konto wurde erstellt. Bitte klicken Sie auf den Button unten, um Ihr Passwort zu erstellen:
    </p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${actionLink}" 
         style="background: #2563eb; color: #fff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block;">
        Passwort erstellen
      </a>
    </div>

    <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
      Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br>
      <a href="${actionLink}" style="color: #2563eb; word-break: break-all;">${actionLink}</a>
    </p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">

    <p style="color: #334155; font-size: 16px; line-height: 1.6;">
      Cześć <strong>${name}</strong>,
    </p>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6;">
      Twoje konto zostało utworzone. Kliknij poniższy przycisk, aby utworzyć hasło:
    </p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${actionLink}" 
         style="background: #2563eb; color: #fff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block;">
        Utwórz hasło
      </a>
    </div>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
    
    <p style="color: #94a3b8; font-size: 12px; text-align: center;">
      Login: <strong>${to}</strong><br>
      Dieser Link ist 24 Stunden gültig. / Ten link jest ważny 24 godziny.
    </p>
  </div>
</body>
</html>`.trim();

    await transporter.sendMail({
      from: `"BSapp" <${GMAIL_USER}>`,
      to: to,
      subject: "BSapp – Passwort erstellen / Utwórz hasło",
      html: htmlContent,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message || "Internal error" }),
    };
  }
};
