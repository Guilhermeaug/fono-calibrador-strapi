"use strict";

const { Features, CollectionsIdentifier } = require("../../../constants");
const { emailTemplateReference } = require("../../email/constants");
const { Status } = require("../../user-progress/constants");
const dayjs = require("dayjs");

async function scheduleEmailToQueue(data) {
  return strapi.entityService.create("api::email-queue.email-queue", {
    data,
  });
}

function formatEmailDate(date) {
  const dateObj = dayjs(date);
  return {
    day: dateObj.format("DD/MM"),
    hour: dateObj.hour(),
  };
}

const updateStatus = (current, next) =>
  current !== Status.DONE && current !== Status.NOT_NEEDED ? next : current;

module.exports = ({ strapi }) => ({
  answerService: strapi.services[CollectionsIdentifier.Answer],
  emailService: strapi.services[CollectionsIdentifier.Email],

  /**
   * Fetches user progress and program data for a given user and program
   * Moved from user-progress controller
   */
  async _fetchUserProgressAndProgram(programId, userId, options = {}) {
    const { populateProgram = [], populateUserProgress = ["sessions"] } = options;

    return Promise.all([
      strapi.db.query(CollectionsIdentifier.UserProgress).findOne({
        populate: populateUserProgress,
        where: {
          program: programId,
          user: userId,
        },
      }),
      strapi.entityService.findOne(CollectionsIdentifier.Program, programId, {
        populate: populateProgram,
      }),
    ]);
  },

  /**
   * Gets the start date for the favorite feature
   * Moved from user-progress controller
   */
  _getFavoriteFeatureStartDate(lastSession, favoriteFeature) {
    if (favoriteFeature === Features.Roughness) {
      return lastSession.trainingRoughnessResults.startDate;
    } else if (favoriteFeature === Features.Breathiness) {
      return lastSession.trainingBreathinessResults.startDate;
    }
  },

  /**
   * Check if all statuses are finished (DONE or NOT_NEEDED)
   * Moved from user-progress controller
   */
  _areAllStatusesFinished(statuses) {
    return Object.values(statuses).every(
      (status) => status === Status.DONE || status === Status.NOT_NEEDED
    );
  },

  /**
   * Handle email notifications based on timing
   * Moved from user-progress controller
   */
  async _handleEmailNotifications(auth, userProgress, timeoutEndDate, nextDueDate) {
    if (!timeoutEndDate) {
      return Promise.resolve();
    }

    const { email, name } = auth;

    // Schedule reminder email
    const emailPromise = scheduleEmailToQueue({
      to: email,
      scheduledTime: timeoutEndDate,
      templateReferenceId: emailTemplateReference.reminder,
      data: { user: { name } },
      userProgress: { connect: [userProgress.id] },
    });

    // Send cooldown email immediately
    this.emailService.sendEmailTemplate(email, emailTemplateReference.cooldown, {
      user: { name },
      startDate: formatEmailDate(timeoutEndDate),
      endDate: formatEmailDate(nextDueDate),
    });

    return emailPromise;
  },

  /**
   * Determines the next state of user progress after a training submission.
   * Encapsulates logic for status updates, due dates, and new session creation.
   * Moved from user-progress controller
   */
  _determineNextStateAfterTraining({
    userProgress,
    program,
    lastSession, // The session *before* applying the current training update
    updatedSessionData, // Data for the training just completed
    input, // The raw input from the request
  }) {
    const userSessionsLength = userProgress.sessions.length;
    const isLastOverallSession = userSessionsLength === program.numberOfSessions;
    const favoriteFeature = userProgress.favoriteFeature ?? input.feature;

    const currentSessionStatuses = {
      assessmentStatus: lastSession.assessmentStatus,
      trainingRoughnessStatus:
        updatedSessionData.trainingRoughnessStatus || lastSession.trainingRoughnessStatus,
      trainingBreathinessStatus:
        updatedSessionData.trainingBreathinessStatus || lastSession.trainingBreathinessStatus,
    };

    // Determine if the *other* training is now ready or stays waiting
    if (input.feature === Features.Roughness) {
      currentSessionStatuses.trainingBreathinessStatus = isLastOverallSession
        ? updateStatus(lastSession.trainingBreathinessStatus, Status.READY)
        : updateStatus(lastSession.trainingBreathinessStatus, Status.WAITING);
    } else {
      currentSessionStatuses.trainingRoughnessStatus = isLastOverallSession
        ? updateStatus(lastSession.trainingRoughnessStatus, Status.READY)
        : updateStatus(lastSession.trainingRoughnessStatus, Status.WAITING);
    }

    const areAllSessionTasksFinished = this._areAllStatusesFinished(currentSessionStatuses);
    const isAnyTrainingPending = [
      currentSessionStatuses.trainingRoughnessStatus,
      currentSessionStatuses.trainingBreathinessStatus,
    ].includes(Status.WAITING);

    let nextUserStatus = Status.READY;
    let nextDueDate = null;
    let timeoutEndDate = null;
    let newSessionId = null;

    if (isAnyTrainingPending) {
      nextUserStatus = Status.WAITING;
      nextDueDate = dayjs(input.startDate).add(3, "day").toISOString();
      timeoutEndDate = dayjs(input.startDate).add(1, "day").subtract(1, "hour").toISOString();
    } else if (areAllSessionTasksFinished) {
      if (isLastOverallSession) {
        nextUserStatus = Status.DONE;
      } else {
        nextUserStatus = Status.WAITING;
        // Calculate break start date (assessment or favorite training start)
        const breakStartDate = lastSession.assessmentRoughnessResults?.startDate
          ? dayjs(lastSession.assessmentRoughnessResults.startDate)
          : dayjs(this._getFavoriteFeatureStartDate(lastSession, favoriteFeature));

        nextDueDate = breakStartDate.add(9, "day").toISOString();
        timeoutEndDate = breakStartDate.add(7, "day").subtract(1, "hour").toISOString();

        newSessionId = true; // Flag to create session later
      }
    }

    return {
      nextUserStatus,
      nextDueDate,
      timeoutEndDate,
      favoriteFeature,
      updatedSessionStatuses: currentSessionStatuses, // Contains the final statuses for the *current* session
      needsNewSession: !!newSessionId,
    };
  },

  /**
   * Processes the submission of an assessment.
   */
  async processAssessmentSubmission(auth, input) {
    strapi.log.info(
      `Processing assessment submission for user ${auth.id}, program ${input.programId}`
    );

    const [userProgress, program] = await this._fetchUserProgressAndProgram(
      input.programId,
      auth.id,
      { populateProgram: ["assessment"] }
    );

    if (!program?.assessment || !userProgress || userProgress.status !== Status.READY) {
      strapi.log.warn(
        `Assessment submission rejected for user ${auth.id}. Invalid state or data. Status: ${userProgress?.status}`
      );
      throw new Error(`Cannot process assessment. User not ready or program data missing.`);
    }

    const { roughnessResults, breathinessResults } = this.answerService.computeAssessmentResults({
      audios: input.audios,
      assessment: program.assessment,
    });

    if (!userProgress.sessions || userProgress.sessions.length === 0) {
      strapi.log.error(
        `User ${auth.id} has no sessions associated with progress ${userProgress.id}`
      );
      throw new Error("User progress is missing session data.");
    }

    const userSessionsLength = userProgress.sessions.length;
    const currentSessionId = userProgress.sessions[userSessionsLength - 1].id;
    const isFirstSession = userSessionsLength === 1;
    const isLastSession = userSessionsLength === program.numberOfSessions;

    const initialTrainingStatus = isFirstSession || isLastSession ? Status.READY : Status.WAITING;
    const favoriteFeature = userProgress.favoriteFeature;

    const trainingRoughnessStatus = favoriteFeature
      ? favoriteFeature === Features.Roughness
        ? Status.READY
        : initialTrainingStatus
      : initialTrainingStatus;
    const trainingBreathinessStatus = favoriteFeature
      ? favoriteFeature === Features.Breathiness
        ? Status.READY
        : initialTrainingStatus
      : initialTrainingStatus;

    const updatedSessionData = {
      assessmentRoughnessResults: {
        startDate: input.startDate,
        endDate: input.endDate,
        audios: roughnessResults,
      },
      assessmentBreathinessResults: {
        startDate: input.startDate,
        endDate: input.endDate,
        audios: breathinessResults,
      },
      assessmentStatus: Status.DONE,
      trainingRoughnessStatus: trainingRoughnessStatus,
      trainingBreathinessStatus: trainingBreathinessStatus,
    };

    const updatedUserProgressData = {
      status: Status.READY,
      nextDueDate: dayjs(input.startDate).add(1, "day").toISOString(),
      nextTimeoutEndDate: null,
    };

    const updatedSession = await strapi.db.transaction(async () => {
      const sessionUpdate = await strapi.entityService.update(
        CollectionsIdentifier.UserSessionProgress,
        currentSessionId,
        { data: updatedSessionData }
      );
      await strapi.entityService.update(CollectionsIdentifier.UserProgress, userProgress.id, {
        data: updatedUserProgressData,
      });

      return sessionUpdate;
    });

    strapi.log.info(
      `Assessment submitted successfully for user ${auth.id}. Session ${currentSessionId} updated.`
    );
    return updatedSession;
  },

  /**
   * Processes the submission of a training session.
   */
  async processTrainingSubmission(auth, input) {
    strapi.log.info(
      `Processing training submission for user ${auth.id}, program ${input.programId}, feature ${input.feature}`
    );

    const [userProgress, program] = await this._fetchUserProgressAndProgram(
      input.programId,
      auth.id,
      {
        populateProgram: ["training"],
        populateUserProgress: {
          sessions: {
            populate: [
              "assessmentRoughnessResults",
              "trainingRoughnessResults",
              "trainingBreathinessResults",
            ],
          },
        },
      }
    );

    if (!program?.training || !userProgress || userProgress.status !== Status.READY) {
      strapi.log.warn(
        `Training submission rejected for user ${auth.id}. Invalid state or data. Status: ${userProgress?.status}`
      );
      throw new Error(`Cannot process training. User not ready or program data missing.`);
    }

    if (!userProgress.sessions || userProgress.sessions.length === 0) {
      strapi.log.error(
        `User ${auth.id} has no sessions associated with progress ${userProgress.id}`
      );
      throw new Error("User progress is missing session data.");
    }

    const lastSessionFromDB = userProgress.sessions[userProgress.sessions.length - 1];
    const currentSessionId = lastSessionFromDB.id;

    if (lastSessionFromDB.assessmentStatus === Status.READY) {
      strapi.log.warn(`User ${auth.id} attempted training before assessment was DONE.`);
      throw new Error("Assessment must be completed before training for this session.");
    }

    const results = this.answerService.computeTrainingResults({
      audios: input.audios,
      training: program.training,
      feature: input.feature,
    });

    const trainingUpdateData = {};
    const commonResults = {
      startDate: input.startDate,
      endDate: input.endDate,
      audios: results,
    };
    if (input.feature === Features.Roughness) {
      trainingUpdateData.trainingRoughnessResults = commonResults;
      trainingUpdateData.trainingRoughnessStatus = Status.DONE;
    } else {
      trainingUpdateData.trainingBreathinessResults = commonResults;
      trainingUpdateData.trainingBreathinessStatus = Status.DONE;
    }

    const {
      nextUserStatus,
      nextDueDate,
      timeoutEndDate,
      favoriteFeature,
      updatedSessionStatuses,
      needsNewSession,
    } = this._determineNextStateAfterTraining({
      userProgress,
      program,
      lastSession: lastSessionFromDB,
      updatedSessionData: trainingUpdateData,
      input,
    });

    const updatedSessionResult = await strapi.db.transaction(async () => {
      let newSessionId = null;
      const userProgressUpdateData = {
        status: nextUserStatus,
        nextDueDate,
        timeoutEndDate,
        favoriteFeature,
      };

      if (needsNewSession) {
        const nextSessionIndex = userProgress.sessions.length + 1;
        // TODO: Refine this logic based on exact assessment frequency rule (e.g., every 3rd session?)
        const isAssessmentNeededForNewSession = nextSessionIndex % 3 === 0; // Example: Assessment on 1, 3, 5, etc.

        const newSession = await strapi.entityService.create(
          CollectionsIdentifier.UserSessionProgress,
          {
            data: {
              trainingRoughnessStatus: Status.WAITING,
              trainingBreathinessStatus: Status.WAITING,
              assessmentStatus: isAssessmentNeededForNewSession
                ? Status.WAITING
                : Status.NOT_NEEDED,
            },
          }
        );
        newSessionId = newSession.id;
        // Add connection to user progress update data
        userProgressUpdateData.sessions = { connect: [newSessionId] };
      }

      const finalSessionUpdate = { ...trainingUpdateData, ...updatedSessionStatuses };
      const updatedSession = await strapi.entityService.update(
        CollectionsIdentifier.UserSessionProgress,
        currentSessionId,
        { data: finalSessionUpdate }
      );

      await strapi.entityService.update(CollectionsIdentifier.UserProgress, userProgress.id, {
        data: userProgressUpdateData,
      });

      return updatedSession; // Return the updated session from the transaction
    });

    if (timeoutEndDate && nextDueDate) {
      await this._handleEmailNotifications(auth, userProgress, timeoutEndDate, nextDueDate);
    }

    strapi.log.info(
      `Training submitted successfully for user ${auth.id}. Session ${currentSessionId} updated. Next status: ${nextUserStatus}`
    );
    return updatedSessionResult;
  },
});
