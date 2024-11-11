"use strict";

const { Status } = require("../constants");

/**
 * user-progress service
 */

const { createCoreService } = require("@strapi/strapi").factories;

module.exports = createCoreService("api::user-progress.user-progress", ({ strapi }) => ({
  invalidate: async (userProgressId) => {
    const userProgress = strapi.entityService.findOne("api::user-progress.user-progress", userProgressId, {
      populate: ["sessions"],
    });

    if (!userProgress || !userProgress.sessions) {
      throw new Error(`User progress with id ${userProgressId} not found`);
    }

    const lastSessionIdx = userProgress.sessions.length - 1;
    const lastSession = userProgress.sessions[lastSessionIdx];

    ["trainingRoughnessStatus", "trainingBreathinessStatus", "assessmentStatus"].forEach((status) => {
      if (lastSession[status] === Status.READY) {
        lastSession[status] = Status.INVALID;
      }
    });

    await strapi.entityService.update("api::user-progress.user-progress", userProgressId, {
      data: { status: Status.INVALID, nextDueDate: null, timeoutEndDate: null },
    });
    await strapi.entityService.update("api::user-session-progress.user-session-progress", lastSession.id, {
      data: {
        trainingRoughnessStatus: lastSession.trainingRoughnessStatus,
        trainingBreathinessStatus: lastSession.trainingBreathinessStatus,
        assessmentStatus: lastSession.assessmentStatus,
      },
    });

    userProgress[lastSessionIdx] = lastSession;

    return userProgress;
  },
}));
