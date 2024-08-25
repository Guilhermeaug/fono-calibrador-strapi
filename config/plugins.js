module.exports = ({ env }) => ({
  "users-permissions": {
    config: {
      register: {
        allowedFields: ["hasAcceptedTerms", "firstPacStatus", "finalPacStatus", "additionalData", "pacLink", "name"],
      },
      jwt: {
        expiresIn: "60 days",
      },
    },
  },
  email: {
    config: {
      provider: "nodemailer",
      providerOptions: {
        host: env("SMTP_HOST"),
        port: env("SMTP_PORT", 587),
        auth: {
          user: env("SMTP_USERNAME"),
          pass: env("SMTP_PASSWORD"),
        },
      },
      settings: {
        defaultFrom: "Calibrador Auditivo <calibradorauditivo@mkt.medicina.ufmg.br>",
        defaultReplyTo: "calibradorauditivo@mkt.medicina.ufmg.br",
      },
    },
  },
});
