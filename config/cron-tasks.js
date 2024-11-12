const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");

const { env } = require("@strapi/utils");

const isTesting = env.bool("IS_TESTING", false);

dayjs.extend(utc);

module.exports = {
  emailQueue: {
    task: async ({ strapi }) => {
      strapi.log.info("Running email-queue cronjob");

      const emailService = strapi.services["api::email.email"];

      const now = dayjs().utc().toISOString();
      const emailsInQueue = await strapi.entityService.findMany("api::email-queue.email-queue", {
        filters: {
          scheduledTime: {
            $lte: now,
          },
          isStale: {
            $eq: false,
          },
        },
      });
      strapi.log.info(`Found ${emailsInQueue.length} emails to be sent`);

      await Promise.all(
        emailsInQueue.map(async (email) => {
          const { to, templateReferenceId, data } = email;
          await emailService.sendEmailTemplate(to, templateReferenceId, data);
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
  updateUsersProgress: {
    task: async ({ strapi }) => {
      strapi.log.info("Running update-users-progress cronjob");

      const userProgressService = strapi.services["api::user-progress.user-progress"];

      const now = dayjs().utc().toISOString();
      const usersThatNeedUpdate = await strapi.entityService.findMany("api::user-progress.user-progress", {
        filters: {
          nextDueDate: {
            $lte: now,
          },
        },
      });
      strapi.log.info(`Found ${usersThatNeedUpdate.length} users to be updated`);

      await Promise.all(
        usersThatNeedUpdate.map(async (userProgress) => {
          userProgressService.invalidate(userProgress.id);
        })
      );
    },
    options: {
      rule: "15 * * * *",
    },
  },
};
