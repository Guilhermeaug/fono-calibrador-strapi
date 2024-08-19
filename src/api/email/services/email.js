'use strict';

/**
 * email service
 */
module.exports = () => ({
  sendEmailTemplate: async (to, templateReferenceId, data) => {
    const emailService = strapi.plugins['email-designer'].services.email;

    try {
      await emailService.sendTemplatedEmail(
        {
          to,
        },
        { templateReferenceId },
         data
      );
    } catch (err) {
      return err;
    }

    return 'sent';
  }
});
