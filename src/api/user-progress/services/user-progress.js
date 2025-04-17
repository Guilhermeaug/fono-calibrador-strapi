"use strict";

const { createCoreService } = require("@strapi/strapi").factories;
const dayjs = require("dayjs"); // Import dayjs

const { Features, CollectionsIdentifier } = require("../../../constants");
const { Status } = require("../constants");

var self = {
  /**
   * Validates user authentication
   * @param {object} ctx - Koa context
   * @returns {boolean} isAuthenticated
   */
  _validateAuth: (ctx) => {
    if (!ctx.state.user) {
      ctx.unauthorized();
      return false;
    }
    return true;
  },

  /**
   * Determines the next status to set to READY based on priority.
   * Priority: Assessment > Favorite Feature Training > Other Training.
   * Only updates if the current status is WAITING.
   * @param {object} userProgress - The user progress object.
   * @param {object} lastSession - The last session object.
   * @returns {object} The status update object (e.g., { assessmentStatus: Status.READY }) or {}.
   */
  _determineUnlockStatusUpdate: (userProgress, lastSession) => {
    const { favoriteFeature = "" } = userProgress;
    const { assessmentStatus, trainingRoughnessStatus, trainingBreathinessStatus } = lastSession;

    // 1. Assessment Priority
    if (assessmentStatus === Status.WAITING) {
      return { assessmentStatus: Status.READY };
    }

    // 2. Last Overall Session Check or No Favorite Feature
    const isLastOverallSession =
      userProgress.sessions.length === userProgress.program.numberOfSessions;

    if (isLastOverallSession || !favoriteFeature) {
      const trainingsToUpdate = {};
      if (trainingRoughnessStatus === Status.WAITING) {
        trainingsToUpdate.trainingRoughnessStatus = Status.READY;
      }
      if (trainingBreathinessStatus === Status.WAITING) {
        trainingsToUpdate.trainingBreathinessStatus = Status.READY;
      }
      return trainingsToUpdate;
    }

    // 3. Favorite Feature Priority
    if (favoriteFeature === Features.Roughness && trainingRoughnessStatus === Status.WAITING) {
      return { trainingRoughnessStatus: Status.READY };
    }
    if (favoriteFeature === Features.Breathiness && trainingBreathinessStatus === Status.WAITING) {
      return { trainingBreathinessStatus: Status.READY };
    }

    // 3. Other Feature Priority (if favorite is done or not waiting)
    if (favoriteFeature === Features.Roughness && trainingBreathinessStatus === Status.WAITING) {
      return { trainingBreathinessStatus: Status.READY };
    }
    if (favoriteFeature === Features.Breathiness && trainingRoughnessStatus === Status.WAITING) {
      return { trainingRoughnessStatus: Status.READY };
    }

    return {};
  },

  /**
   * Unlock the user progress, clearing the timeout and updating the status
   * @param {number} userProgressId - ID of the user progress
   * @return {Promise<object>} updatedUserProgress
   */
  unlock: async (userProgressId) => {
    strapi.log.info(`Unlocking user progress with id ${userProgressId}`);

    const userProgress = await strapi.entityService.findOne(
      CollectionsIdentifier.UserProgress,
      userProgressId,
      {
        populate: {
          sessions: true,
          program: {
            fields: ["id", "numberOfSessions"],
          },
        },
      }
    );

    if (!userProgress || !userProgress.sessions?.length) {
      strapi.log.error(`User progress with id ${userProgressId} not found or has no sessions.`);
      throw new Error(`User progress with id ${userProgressId} not found or has no sessions.`);
    }

    const lastSessionIndex = userProgress.sessions.length - 1;
    const lastSession = userProgress.sessions[lastSessionIndex];

    const updatedSessionData = self._determineUnlockStatusUpdate(userProgress, lastSession);

    const updatedUserProgressData = {
      status: Status.READY,
      timeoutEndDate: null,
    };

    const [updatedUserProgress, updatedSession] = await strapi.db.transaction(async () => {
      const updatedUserProgress = await strapi.entityService.update(
        CollectionsIdentifier.UserProgress,
        userProgressId,
        {
          data: updatedUserProgressData,
        }
      );

      let updatedSession = null;
      if (Object.keys(updatedSessionData).length > 0) {
        updatedSession = await strapi.entityService.update(
          CollectionsIdentifier.UserSessionProgress,
          lastSession.id,
          { data: updatedSessionData }
        );
      }

      return [updatedUserProgress, updatedSession || lastSession];
    });

    userProgress.sessions[lastSessionIndex] = updatedSession;

    return {
      ...userProgress, // Contains original data + updated session
      ...updatedUserProgress, // Contains updated status, timeoutEndDate
    };
  },

  /**
   * Invalidates the user progress by setting the status to INVALID and updating session statuses.
   * @param {number} userProgressId - ID of the user progress
   * @return {Promise<object>} updatedUserProgress
   * @throws {Error} If user progress not found or has no sessions.
   */
  invalidate: async (userProgressId) => {
    strapi.log.info(`Invalidating user progress with id ${userProgressId}`);

    const userProgress = await strapi.entityService.findOne(
      CollectionsIdentifier.UserProgress,
      userProgressId,
      {
        populate: ["sessions"],
      }
    );

    // Use early return for error case
    if (!userProgress || !userProgress.sessions?.length) {
      strapi.log.error(`User progress with id ${userProgressId} not found or has no sessions.`);
      // Consider throwing an error or returning a more specific error indicator
      return userProgress;
    }

    const lastSessionIndex = userProgress.sessions.length - 1;
    const lastSession = userProgress.sessions[lastSessionIndex];

    // Prepare session data updates, only including statuses that are currently READY
    const updatedSessionData = {};
    if (
      lastSession.trainingRoughnessStatus === Status.READY ||
      lastSession.trainingRoughnessStatus === Status.WAITING
    ) {
      updatedSessionData.trainingRoughnessStatus = Status.INVALID;
    }
    if (
      lastSession.trainingBreathinessStatus === Status.READY ||
      lastSession.trainingBreathinessStatus === Status.WAITING
    ) {
      updatedSessionData.trainingBreathinessStatus = Status.INVALID;
    }
    if (
      lastSession.assessmentStatus === Status.READY ||
      lastSession.assessmentStatus === Status.WAITING
    ) {
      updatedSessionData.assessmentStatus = Status.INVALID;
    }

    const updatedUserProgressData = {
      status: Status.INVALID,
      nextDueDate: null,
      timeoutEndDate: null,
    };

    // Perform updates concurrently
    const [updatedUser, updatedSession] = await Promise.all([
      strapi.entityService.update(CollectionsIdentifier.UserProgress, userProgressId, {
        data: updatedUserProgressData,
      }),
      // Only update session if there are changes
      Object.keys(updatedSessionData).length > 0
        ? strapi.entityService.update(CollectionsIdentifier.UserSessionProgress, lastSession.id, {
            data: updatedSessionData,
          })
        : Promise.resolve(lastSession),
    ]);

    // Update the session in the userProgress object
    userProgress.sessions[lastSessionIndex] = updatedSession;

    // Return the merged updated user progress
    return {
      ...userProgress, // Contains original data + potentially updated session
      ...updatedUser, // Contains updated status, nextDueDate, timeoutEndDate
    };
  },

  /**
   * Revalidates a user's progress, setting INVALID statuses back to READY.
   * @param {object} params - Parameters object.
   * @param {number} params.userId - The ID of the user.
   * @param {number} params.programId - The ID of the program.
   * @returns {Promise<object>} The updated user progress object.
   * @throws {Error} If user progress is not found or has no sessions.
   */
  revalidate: async ({ userId, programId }) => {
    strapi.log.info(`Revalidating progress for user ${userId}, program ${programId}`);

    const userProgress = await self.alignProgress({ userId, programId });

    if (!userProgress || !userProgress.sessions?.length) {
      const errorMsg = `User progress not found or has no sessions for user ${userId}, program ${programId}. Cannot revalidate.`;
      strapi.log.error(errorMsg);
      throw new Error(errorMsg);
    }

    const lastSessionIndex = userProgress.sessions.length - 1;
    const lastSession = userProgress.sessions[lastSessionIndex];

    let updatedSessionData = {};
    if (lastSession.trainingRoughnessStatus === Status.INVALID) {
      updatedSessionData.trainingRoughnessStatus = Status.WAITING;
    }
    if (lastSession.trainingBreathinessStatus === Status.INVALID) {
      updatedSessionData.trainingBreathinessStatus = Status.WAITING;
    }
    if (lastSession.assessmentStatus === Status.INVALID) {
      updatedSessionData.assessmentStatus = Status.WAITING;
    }

    const statusToMakeReady = self._determineUnlockStatusUpdate(userProgress, updatedSessionData);
    updatedSessionData = {
      ...updatedSessionData,
      ...statusToMakeReady,
    };

    const updatedUserProgressData = {
      status: Status.READY,
      nextDueDate: null,
      timeoutEndDate: null,
    };

    const [updatedUserProgressResult, updatedSessionResult] = await strapi.db.transaction(
      async () => {
        const updatedUP = await strapi.entityService.update(
          CollectionsIdentifier.UserProgress,
          userProgress.id,
          { data: updatedUserProgressData }
        );

        let updatedSess = lastSession;
        if (Object.keys(updatedSessionData).length > 0) {
          updatedSess = await strapi.entityService.update(
            CollectionsIdentifier.UserSessionProgress,
            lastSession.id,
            { data: updatedSessionData }
          );
        }
        return [updatedUP, updatedSess];
      }
    );

    userProgress.sessions[lastSessionIndex] = updatedSessionResult;

    return {
      ...userProgress,
      ...updatedUserProgressResult,
    };
  },

  /**
   * Restarts the user's progress for a specific program.
   * Deletes old sessions and creates a new initial session.
   * @param {object} params - Parameters object.
   * @param {number} params.userId - The ID of the user.
   * @param {number} params.programId - The ID of the program.
   * @returns {Promise<object>} The updated user progress object.
   * @throws {Error} If user progress is not found.
   */
  restartUserProgress: async ({ userId, programId }) => {
    strapi.log.info(`Restarting progress for user ${userId}, program ${programId}`);

    const userProgress = await strapi.db.query(CollectionsIdentifier.UserProgress).findOne({
      where: { user: userId, program: programId },
      populate: { sessions: { fields: ["id"] } },
    });

    if (!userProgress) {
      const errorMsg = `User progress not found for user ${userId}, program ${programId}. Cannot restart.`;
      strapi.log.error(errorMsg);
      throw new Error(errorMsg);
    }

    const oldSessionIds = userProgress.sessions?.map((s) => s.id) || [];

    const updatedUserProgress = await strapi.db.transaction(async () => {
      // 1. Create the new initial session
      const newSession = await strapi.entityService.create(
        CollectionsIdentifier.UserSessionProgress,
        {
          data: {
            assessmentStatus: Status.READY,
            trainingRoughnessStatus: Status.WAITING,
            trainingBreathinessStatus: Status.WAITING,
          },
        }
      );

      // 2. Update user progress: reset status, clear dates/feature, connect new session
      const updatedUP = await strapi.entityService.update(
        CollectionsIdentifier.UserProgress,
        userProgress.id,
        {
          data: {
            status: Status.READY,
            nextDueDate: null,
            timeoutEndDate: null,
            favoriteFeature: null,
            sessions: {
              disconnect: oldSessionIds,
              connect: [newSession.id],
            },
          },
          populate: ["sessions"], // Repopulate sessions to include the new one
        }
      );

      // 3. Delete old sessions (if any) after disconnecting them
      // if (oldSessionIds.length > 0) {
      //   await strapi.db.query(CollectionsIdentifier.UserSessionProgress).deleteMany({
      //     where: { id: { $in: oldSessionIds } },
      //   });
      // }

      return updatedUP;
    });

    return updatedUserProgress;
  },

  /**
   * Clears the timeout for a user's progress if it's currently in WAITING status.
   * @param {object} params - Parameters object.
   * @param {number} params.userId - The ID of the user.
   * @param {number} params.programId - The ID of the program.
   * @returns {Promise<object>} The user progress object (potentially updated).
   * @throws {Error} If user progress is not found.
   */
  clearUserTimeout: async ({ userId, programId }) => {
    strapi.log.info(`Attempting to clear timeout for user ${userId}, program ${programId}`);

    let userProgress = await self.alignProgress({ userId, programId });

    if (!userProgress) {
      const errorMsg = `User progress not found for user ${userId}, program ${programId}. Cannot clear timeout.`;
      strapi.log.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (userProgress.status === Status.WAITING) {
      strapi.log.info(`User ${userId} is in WAITING status. Unlocking.`);
      userProgress = await self.unlock(userProgress.id);
    } else {
      strapi.log.info(`User ${userId} is not in WAITING status. No timeout to clear.`);
    }

    return userProgress;
  },

  alignProgress: async ({ userId, programId }) => {
    strapi.log.info(`Aligning progress for user ${userId}, program ${programId}`);

    const userProgress = await strapi.db.query(CollectionsIdentifier.UserProgress).findOne({
      where: {
        program: programId,
        user: userId,
      },
      populate: {
        sessions: true,
        program: {
          fields: ["id", "numberOfSessions"],
        },
      },
    });

    if (!userProgress) {
      strapi.log.error(`User progress not found for user ${userId}, program ${programId}`);
      throw new Error(`User progress not found for user ${userId}, program ${programId}`);
    }

    const now = dayjs();
    const nextDueDate = userProgress.nextDueDate && dayjs(userProgress.nextDueDate);
    const timeoutEndDate = userProgress.timeoutEndDate && dayjs(userProgress.timeoutEndDate);

    if (nextDueDate && now.isAfter(nextDueDate)) {
      strapi.log.info(`User ${userId} progress is overdue. Invalidating.`);
      return self.invalidate(userProgress.id);
    }

    if (timeoutEndDate && now.isAfter(timeoutEndDate)) {
      strapi.log.info(`User ${userId} timeout ended. Unlocking.`);
      return self.unlock(userProgress.id);
    }

    strapi.log.info(`Progress is already aligned for user ${userId}`);

    return userProgress;
  },
};

module.exports = createCoreService("api::user-progress.user-progress", ({}) => self);
