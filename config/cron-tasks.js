const dayjs = require("dayjs");

const { env } = require("@strapi/utils");

const isTesting = env.bool("IS_TESTING", false);

module.exports = {
  emailQueue: {
    task: async ({ strapi }) => {
      strapi.log.info("Running email-queue cronjob");

      const emailService = strapi.services["api::email.email"];

      const now = dayjs();
      const emailsInQueue = await strapi.entityService.findMany("api::email-queue.email-queue", {
        filters: {
          scheduledTime: {
            $lte: now,
          },
          isStale: {
            $eq: false,
          },
        },
        populate: ["userProgress"],
      });
      strapi.log.info(`Found ${emailsInQueue.length} emails to be sent`);

      await Promise.all(
        emailsInQueue.map(async (email) => {
          const { to, templateReferenceId, data, userProgress } = email;
          const timeoutEndDate = userProgress?.timeoutEndDate
            ? dayjs(userProgress.timeoutEndDate)
            : null;

          const shouldSendEmail =
            !timeoutEndDate || timeoutEndDate.isSame(now, "minute") || timeoutEndDate.isBefore(now);

          if (shouldSendEmail) {
            await emailService.sendEmailTemplate(to, templateReferenceId, data);
          }
          await strapi.entityService.update("api::email-queue.email-queue", email.id, {
            data: { isStale: true },
          });
        })
      );
    },
    options: {
      rule: isTesting ? "*/1 * * * *" : "0 * * * *",
    },
  },
};
