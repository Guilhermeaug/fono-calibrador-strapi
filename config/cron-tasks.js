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
  invalidateUsers: {
    task: async ({ strapi }) => {
      strapi.log.info("Running invalidate-users cronjob");

      const userProgressService = strapi.services["api::user-progress.user-progress"];

      const now = dayjs();
      const usersThatNeedUpdate = await strapi.entityService.findMany(
        "api::user-progress.user-progress",
        {
          filters: {
            nextDueDate: {
              $lte: now,
            },
          },
        }
      );
      
      const usersIds = usersThatNeedUpdate.map((user) => user.id);
      strapi.log.info(`Invalidated users: ${usersIds.join(", ")}`);

      await Promise.all(
        usersThatNeedUpdate.map((userProgress) => {
          userProgressService.invalidate(userProgress.id);
        })
      );
    },
    options: {
      rule: isTesting ? "*/1 * * * *" : "10 * * * *",
    },
  },
  unlockUsers: {
    task: async ({ strapi }) => {
      strapi.log.info("Running unlock-users cronjob");

      const userProgressService = strapi.services["api::user-progress.user-progress"];

      const now = dayjs();
      const usersThatNeedUpdate = await strapi.entityService.findMany(
        "api::user-progress.user-progress",
        {
          filters: {
            timeoutEndDate: {
              $lte: now,
            },
            status: {
              $eq: "WAITING"
            }
          },
        }
      );
     
      const usersIds = usersThatNeedUpdate.map((user) => user.id);
      strapi.log.info(`Unlocked users: ${usersIds.join(", ")}`);

      await Promise.all(
        usersThatNeedUpdate.map((userProgress) => {
          userProgressService.unlock(userProgress.id);
        })
      );
    },
    options: {
      rule: isTesting ? "*/1 * * * *" : "15 * * * *",
    },
  },
};
