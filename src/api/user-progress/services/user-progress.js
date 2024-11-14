"use strict";

const { createCoreService } = require("@strapi/strapi").factories;

const { Status } = require("../constants");

module.exports = createCoreService("api::user-progress.user-progress", ({ strapi }) => ({
  invalidate: async (userProgressId) => {
    const userProgress = await strapi.entityService.findOne(
      "api::user-progress.user-progress",
      userProgressId,
      {
        populate: ["sessions"],
      }
    );

    if (!userProgress || !userProgress.sessions) {
      strapi.log.error(`User progress with id ${userProgressId} not found`);
      return userProgress;
    }

    const lastSessionIndex = userProgress.sessions.length - 1;
    const lastSession = userProgress.sessions[lastSessionIndex];

    ["trainingRoughnessStatus", "trainingBreathinessStatus", "assessmentStatus"].forEach(
      (status) => {
        if (lastSession[status] === Status.READY) {
          lastSession[status] = Status.INVALID;
        }
      }
    );

    await Promise.all([
      strapi.entityService.update("api::user-progress.user-progress", userProgressId, {
        data: { status: Status.INVALID, nextDueDate: null, timeoutEndDate: null },
      }),
      strapi.entityService.update(
        "api::user-session-progress.user-session-progress",
        lastSession.id,
        {
          data: {
            trainingRoughnessStatus: lastSession.trainingRoughnessStatus,
            trainingBreathinessStatus: lastSession.trainingBreathinessStatus,
            assessmentStatus: lastSession.assessmentStatus,
          },
        }
      ),
    ]);

    userProgress.sessions[lastSessionIndex] = lastSession;

    return userProgress;
  },
}));
