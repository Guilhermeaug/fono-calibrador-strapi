"use strict";

const { createCoreService } = require("@strapi/strapi").factories;

const { Features } = require("../../../constants");
const { Status } = require("../constants");

module.exports = createCoreService("api::user-progress.user-progress", ({ strapi }) => ({
  unlock: async (userProgressId) => {
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

    const updateStatuses = () => {
      if (userProgress.favoriteFeature === Features.Roughness) {
        if (lastSession.trainingRoughnessStatus === Status.WAITING) {
          return { trainingRoughnessStatus: Status.READY };
        } else if (lastSession.trainingRoughnessStatus === Status.DONE) {
          return { trainingBreathinessStatus: Status.READY };
        }
      } else if (userProgress.favoriteFeature === Features.Breathiness) {
        if (lastSession.trainingBreathinessStatus === Status.WAITING) {
          return { trainingBreathinessStatus: Status.READY };
        } else if (lastSession.trainingBreathinessStatus === Status.DONE) {
          return { trainingRoughnessStatus: Status.READY };
        }
      }
      return {
        trainingRoughnessStatus: lastSession.trainingRoughnessStatus,
        trainingBreathinessStatus: lastSession.trainingBreathinessStatus,
      };
    };

    const lastSessionIndex = userProgress.sessions.length - 1;
    const lastSession = userProgress.sessions[lastSessionIndex];

    const isAssessmentComplete = [Status.DONE, Status.NOT_NEEDED].includes(
      lastSession.assessmentStatus
    );

    const updatedSessionData = isAssessmentComplete
      ? updateStatuses()
      : { assessmentStatus: Status.READY };
    const updatedUserProgressData = {
      status: Status.READY,
      timeoutEndDate: null,
    }

    const [updatedUser, updatedSession] = await Promise.all([
      strapi.entityService.update("api::user-progress.user-progress", userProgressId, {
        data: updatedUserProgressData,
      }),
      strapi.entityService.update(
        "api::user-session-progress.user-session-progress",
        lastSession.id,
        {
          data: updatedSessionData,
        }
      ),
    ]);

    userProgress.sessions[lastSessionIndex] = updatedSession;

    return {
      ...userProgress,
      ...updatedUser,
    };
  },

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

    const [updatedUser, updatedSession] = await Promise.all([
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

    userProgress.sessions[lastSessionIndex] = updatedSession;

    return {
      ...userProgress,
      ...updatedUser,
    };
  },

  revalidate: async (userProgressId) => {
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
        if (lastSession[status] === Status.INVALID) {
          lastSession[status] = Status.READY;
        }
      }
    );

    const [updatedUser, updatedSession] = await Promise.all([
      strapi.entityService.update("api::user-progress.user-progress", userProgressId, {
        data: { status: Status.READY, nextDueDate: null, timeoutEndDate: null },
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

    userProgress.sessions[lastSessionIndex] = updatedSession;

    return {
      ...userProgress,
      ...updatedUser,
    };
  }
  
}));
