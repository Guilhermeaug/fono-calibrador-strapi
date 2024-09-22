"use strict";

/**
 * A set of functions called "actions" for `email`
 */
const yup = require("yup");

module.exports = {
  sendContactEmail: async (ctx, next) => {
    const schema = yup.object().shape({
      email: yup.string().email().required(),
      content: yup.string().required(),
    });

    try {
      await schema.validate(ctx.request.body);
    } catch (error) {
      return ctx.badRequest(error.errors);
    }

    const emailService = strapi.plugins["email"].services.email;
    const { email, content } = ctx.request.body;

    await emailService.send({
      to: "calibradorauditivo@mkt.medicina.ufmg.br",
      subject: `Recebido na tela de Contato via ${email}`,
      text: content,
    });

    return ctx.send({ message: "Email sent" });
  },

  sendEmailTemplate: async (ctx, next) => {
    const schema = yup.object().shape({
      templateReferenceId: yup.number().required(),
      to: yup.string().email(),
      data: yup.object(),
    });

    try {
      await schema.validate(ctx.request.body);
    } catch (error) {
      return ctx.badRequest(error.errors);
    }

    const { to, templateReferenceId, data } = ctx.request.body;

    const emailService = strapi.services["api::email.email"];
    await emailService.sendEmailTemplate(to, templateReferenceId, data);

    strapi.log.info(`Email sent to ${to} with template ${templateReferenceId}`);

    return ctx.send({ message: "Email sent" });
  },
};
