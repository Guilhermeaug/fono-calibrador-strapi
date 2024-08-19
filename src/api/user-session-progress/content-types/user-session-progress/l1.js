"use strict";

const dayjs = require('dayjs');

async function findUserProgressBySessionId(sessionId) {
  try {
    return strapi.db.query("api::user-progress.user-progress").findOne({
      populate: {
        sessions: true,
        program: true,
        user: {
          populate: { additionalData: true },
        }
      },
      where: {
        sessions: {
          $in: [sessionId],
        },
      },
    });
  } catch (error) {
    return null;
  }
}

module.exports = {
  async beforeUpdate(event) {
    const { data, where } = event.params;
    const current = await strapi.entityService.findOne("api::user-session-progress.user-session-progress", where.id);

    const currentTrainingRoughness = current.trainingRoughnessStatus;
    const currentTrainingBreathiness = current.trainingBreathinessStatus;
    const currentAssessment = current.assessmentStatus;
    const nextTrainingRoughness = data.trainingRoughnessStatus || currentTrainingRoughness;
    const nextTrainingBreathiness = data.trainingBreathinessStatus || currentTrainingBreathiness;
    const nextAssessment = data.assessmentStatus || currentAssessment;

    // Intervalo entre treinos
    if (
      changedFromTo(currentTrainingRoughness, nextTrainingRoughness, Status.READY, Status.DONE) &&
      isWaiting(nextTrainingBreathiness)
    ) {
      event.state = "1-day:cooldown;trainingBreathinessStatus";
    }
    if (
      changedFromTo(currentTrainingBreathiness, nextTrainingBreathiness, Status.READY, Status.DONE) &&
      isWaiting(nextTrainingRoughness)
    ) {
      event.state = "1-day:cooldown;trainingRoughnessStatus";
    }
    // Intervalo entre sessões
    if (
      isDone(nextTrainingRoughness) &&
      isDone(nextTrainingBreathiness) &&
      (isDone(nextAssessment) || isNotNeeded(nextAssessment))
    ) {
      event.state = "7-day:cooldown";
    }

    if (
      nextTrainingBreathiness === Status.INVALID ||
      nextTrainingRoughness === Status.INVALID ||
      nextAssessment === Status.INVALID
    ) {
      event.state = "invalidate-user";
    }
  },

  async afterUpdate(event) {
    const { result = {}, params: { where } } = event;

    const emailService = strapi.services["api::email.email"]
    const cronService = strapi.services["api::cron.cron"];

    const userProgress = await findUserProgressBySessionId(result.id);
    const { email, additionalData: { name } } = userProgress.user;
    const currentSessionsLength = userProgress.sessions.length;
    const updatedUserProgress = {};

    const userPayload = {
      name: name
    }

    let eventName = '';
    let eventKey = '';

    if (event.state) {
      const stateString = String(event.state);
      eventName = stateString.split(";")[0];
      eventKey = stateString.split(";")[1];
    }

    if (eventName === "1-day:cooldown") {
      console.warn("AfterUpdate", "Sending Email to User (1-day:cooldown)");
      updatedUserProgress.status = Status.WAITING;
      const tomorrowDate = dayjs().add(1, 'day').format('DD/MM');
      const twoDaysFromNow = dayjs().add(2, 'day').format('DD/MM');
      emailService.sendEmailTemplate(email, 2, {
        user: userPayload,
        startDate: {
          day: tomorrowDate,
          hour: new Date().getHours() + 1,
        },
        endDate: {
          day: twoDaysFromNow,
          hour: new Date().getHours() + 1,
        }
      })
      cronService.scheduleVerify({
        schedule: dayjs().add(2, 'day').add(1, 'hour').toDate(),
        userSessionId: where.id,
        state: {
          [eventKey]: Status.DONE,
        }
      })
      cronService.scheduleRememberEmail({
        schedule: dayjs().add(1, 'day').add(1, 'hour').toDate(),
        userSessionId: where.id,
        emailTemplate: {
          templateReferenceId: 5,
          to: email,
          data: {
            user: userPayload
          }
        },
        state: {
          [eventKey]: Status.READY,
        }
      })
    } else if (eventName === "7-day:cooldown") {
      if (userProgress.program.numberOfSessions === currentSessionsLength) {
        updatedUserProgress.status = Status.DONE;
        strapi.log.warn("AfterUpdate", "Sending Email to User - Program Done");
        emailService.sendEmailTemplate(email, 4, {
          user: userPayload
        })
      } else {
        console.warn("AfterUpdate", "Sending Email to User (7-day:cooldown)");
        updatedUserProgress.status = Status.WAITING;
        const isAssessmentNeeded = (currentSessionsLength + 1) % 3 === 0;
        const newSession = await strapi.entityService.create("api::user-session-progress.user-session-progress", {
          data: {
            assessmentStatus: isAssessmentNeeded ? "WAITING" : "NOT_NEEDED",
          },
        });
        const currentSessionsIds = userProgress.sessions.map((session) => session.id);
        updatedUserProgress.sessions = [...currentSessionsIds, newSession.id];

        const startDate = dayjs().add(7, 'day').format('DD/MM');
        const endDate = dayjs().add(8, 'day').format('DD/MM');
        emailService.sendEmailTemplate(email, 3, {
          user: userPayload,
          startDate: {
            day: startDate,
            hour: new Date().getHours() + 1,
          },
          endDate: {
            day: endDate,
            hour: new Date().getHours() + 1,
          }
        })

        cronService.scheduleVerify({
          schedule: dayjs().add(8, 'day').add(1, 'hour').toDate(),
          userSessionId: where.id,
          state: {
            assessmentStatus: Status.DONE
          }
        })
        cronService.scheduleRememberEmail({
          schedule: dayjs().add(7, 'day').add(1, 'hour').toDate(),
          userSessionId: where.id,
          emailTemplate: {
            templateReferenceId: 5,
            to: email,
            data: {
              user: userPayload
            }
          },
          state: {
            [eventKey]: Status.DONE,
          }
        })
      }
    } else if (eventName === "invalidate-user") {
      console.warn("AfterUpdate", "Invalidating User Progress");
      updatedUserProgress.status = Status.INVALID
    }

    if (Object.keys(updatedUserProgress).length === 0) {
      return;
    }
    await strapi.entityService.update("api::user-progress.user-progress", userProgress.id, {
      data: {
        ...updatedUserProgress,
      },
    });
  },
};

const Status = {
  DONE: "DONE",
  READY: "READY",
  WAITING: "WAITING",
  NOT_NEEDED: "NOT_NEEDED",
  INVALID: "INVALID",
};

function isDone(status) {
  return status === Status.DONE;
}

function isReady(status) {
  return status === Status.READY;
}

function isWaiting(status) {
  return status === Status.WAITING;
}

function isNotNeeded(status) {
  return status === Status.NOT_NEEDED;
}

function changedFromTo(current, next, from, to) {
  return current === from && next === to;
}
