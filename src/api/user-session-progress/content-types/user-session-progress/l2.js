"use strict";

const dayjs = require('dayjs');

const Status = {
  DONE: "DONE",
  READY: "READY",
  WAITING: "WAITING",
  NOT_NEEDED: "NOT_NEEDED",
  INVALID: "INVALID",
};

const TIMEOUTS = {
  ONE_DAY_COOLDOWN: { days: 1, hours: 0 },
  ONE_DAY_ROUNDED_COOLDOWN: { days: 1, hours: 1 },
  TWO_DAYS_COOLDOWN: { days: 2, hours: 0 },
  TWO_DAYS_ROUNDED_COOLDOWN: { days: 2, hours: 1 },
  SEVEN_DAYS_COOLDOWN: { days: 7, hours: 0 },
  SEVEN_DAYS_ROUNDED_COOLDOWN: { days: 7, hours: 1 },
  EIGHT_DAYS_COOLDOWN: { days: 8, hours: 0 },
  EIGHT_DAYS_ROUNDED_COOLDOWN: { days: 8, hours: 1 },
  // Testing timeouts
  ONE_MINUTE: { days: 0, hours: 0, minutes: 1 },
  TWO_MINUTES: { days: 0, hours: 0, minutes: 2 },
  THREE_MINUTES: { days: 0, hours: 0, minutes: 3 },
  FIVE_MINUTES: { days: 0, hours: 0, minutes: 5 },
};

const EmailTemplateReference = {
  PROGRAM_COMPLETED: 4,
  ONE_DAY_COOLDOWN: 2,
  SEVEN_DAY_COOLDOWN: 3,
  REMINDER: 5,
};

function isStatus(status, expected) {
  return status === expected;
}

function changedStatus(current, next, from, to) {
  return current === from && next === to;
}

function getNextTimeout(timeout) {
  return dayjs().add(timeout.days, 'day').add(timeout.hours, 'hour').add(timeout.minutes || 0, 'minute').toDate();
}

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

function setEventState(event, state) {
  event.state = state;
}

module.exports = {
  async beforeUpdate(event) {
    const { data, where } = event.params;
    const current = await strapi.entityService.findOne("api::user-session-progress.user-session-progress", where.id);

    const currentStates = {
      roughness: current.trainingRoughnessStatus,
      breathiness: current.trainingBreathinessStatus,
      assessment: current.assessmentStatus,
    };

    const nextStates = {
      roughness: data.trainingRoughnessStatus || currentStates.roughness,
      breathiness: data.trainingBreathinessStatus || currentStates.breathiness,
      assessment: data.assessmentStatus || currentStates.assessment,
    };

    if (changedStatus(currentStates.roughness, nextStates.roughness, Status.READY, Status.DONE) &&
      isStatus(nextStates.breathiness, Status.WAITING)) {
      setEventState(event, "1-day:cooldown;trainingBreathinessStatus");
    } else if (changedStatus(currentStates.breathiness, nextStates.breathiness, Status.READY, Status.DONE) &&
      isStatus(nextStates.roughness, Status.WAITING)) {
      setEventState(event, "1-day:cooldown;trainingRoughnessStatus");
    } else if (isStatus(nextStates.roughness, Status.DONE) &&
      isStatus(nextStates.breathiness, Status.DONE) &&
      (isStatus(nextStates.assessment, Status.DONE) || isStatus(nextStates.assessment, Status.NOT_NEEDED))) {
      setEventState(event, "7-day:cooldown");
    } else if ([nextStates.roughness, nextStates.breathiness, nextStates.assessment].includes(Status.INVALID)) {
      setEventState(event, "invalidate-user");
    }
  },

  async afterUpdate(event) {
    const { result = {}, params: { where } } = event;
    const emailService = strapi.services["api::email.email"];
    const cronService = strapi.services["api::cron.cron"];
    const userProgress = await findUserProgressBySessionId(result.id);

    if (!userProgress) return;

    const { email, additionalData: { name } } = userProgress.user;
    const userPayload = { name };
    const currentSessionsLength = userProgress.sessions.length;
    const updatedUserProgress = {};

    const [eventName, eventKey] = String(event.state).split(";");

    const statuses = {
      roughness: result.trainingRoughnessStatus,
      breathiness: result.trainingBreathinessStatus,
      assessment: result.assessmentStatus,
    }
    if (Object.values(statuses).includes(Status.INVALID)) {
      updatedUserProgress.status = Status.INVALID;
    } else if (Object.values(statuses).includes(Status.READY)) {
      updatedUserProgress.status = Status.READY;
    } else {
      updatedUserProgress.status = Status.WAITING;
    }

    if (eventName === "1-day:cooldown") {
      handleOneDayCooldown(emailService, cronService, email, userPayload, where.id, eventKey, updatedUserProgress);
    } else if (eventName === "7-day:cooldown") {
      await handleSevenDayCooldown(emailService, cronService, strapi, userProgress, currentSessionsLength, userPayload, where.id, updatedUserProgress);
    } else if (eventName === "invalidate-user") {
      console.warn("AfterUpdate", "Invalidating User Progress");
    }

    if (Object.keys(updatedUserProgress).length > 0) {
      await strapi.entityService.update("api::user-progress.user-progress", userProgress.id, { data: updatedUserProgress });
    }
  },
};

function handleOneDayCooldown(emailService, cronService, email, userPayload, sessionId, eventKey, updatedUserProgress) {
  console.warn("AfterUpdate", "Sending Email to User (1-day:cooldown)");

  emailService.sendEmailTemplate(email, EmailTemplateReference.ONE_DAY_COOLDOWN, {
    user: userPayload,
    startDate: formatDate(dayjs().add(1, 'day')),
    endDate: formatDate(dayjs().add(2, 'day').add(1, 'hour')),
  });
  cronService.scheduleVerify({
    schedule: getNextTimeout(TIMEOUTS.TWO_MINUTES),
    userSessionId: sessionId,
    state: { $eq: { [eventKey]: Status.DONE } }
  });
  cronService.scheduleStatusTransition({
    schedule: getNextTimeout(TIMEOUTS.ONE_MINUTE),
    userSessionId: sessionId,
    state: { [eventKey]: Status.READY }
  })
  cronService.scheduleRememberEmail({
    schedule: getNextTimeout(TIMEOUTS.ONE_MINUTE),
    userSessionId: sessionId,
    emailTemplate: {
      templateReferenceId: EmailTemplateReference.REMINDER,
      to: email,
      data: { user: userPayload }
    },
    state: { [eventKey]: Status.DONE }
  });
}

async function handleSevenDayCooldown(emailService, cronService, strapi, userProgress, currentSessionsLength, userPayload, sessionId, updatedUserProgress) {
  if (userProgress.program.numberOfSessions === currentSessionsLength) {
    updatedUserProgress.status = Status.DONE;
    strapi.log.warn("AfterUpdate", "Sending Email to User - Program Done");
    emailService.sendEmailTemplate(userProgress.user.email, EmailTemplateReference.PROGRAM_COMPLETED, { user: userPayload });
  } else {
    console.warn("AfterUpdate", "Sending Email to User (7-day:cooldown)");
    const isAssessmentNeeded = (currentSessionsLength + 1) % 3 === 0;

    const newSessionAssessmentStatus = isAssessmentNeeded ? Status.WAITING : Status.NOT_NEEDED;
    const newSession = await strapi.entityService.create("api::user-session-progress.user-session-progress", {
      data: { assessmentStatus: newSessionAssessmentStatus },
    });

    updatedUserProgress.sessions = [...userProgress.sessions.map(s => s.id), newSession.id];

    emailService.sendEmailTemplate(userProgress.user.email, EmailTemplateReference.SEVEN_DAY_COOLDOWN, {
      user: userPayload,
      startDate: formatDate(dayjs().add(7, 'day')),
      endDate: formatDate(dayjs().add(8, 'day').add(1, 'hour')),
    });

    if (isAssessmentNeeded) {
      cronService.scheduleVerify({
        schedule: getNextTimeout(TIMEOUTS.THREE_MINUTES),
        userSessionId: newSession.id,
        state: {
          $eq: {
            assessmentStatus: Status.DONE,
          },
          $or: {
            trainingRoughnessStatus: Status.DONE,
            trainingBreathinessStatus: Status.DONE,
          }
        }
      });
      cronService.scheduleStatusTransition({
        schedule: getNextTimeout(TIMEOUTS.ONE_MINUTE),
        userSessionId: newSession.id,
        state: { assessmentStatus: Status.READY }
      })
      cronService.scheduleRememberEmail({
        schedule: getNextTimeout(TIMEOUTS.ONE_MINUTE),
        userSessionId: newSession.id,
        emailTemplate: {
          templateReferenceId: EmailTemplateReference.REMINDER,
          to: userProgress.user.email,
          data: { user: userPayload }
        },
        state: { assessmentStatus: Status.DONE }
      });
    } else {
      cronService.scheduleVerify({
        schedule: getNextTimeout(TIMEOUTS.THREE_MINUTES),
        userSessionId: newSession.id,
        state: {
          $or: {
            trainingRoughnessStatus: Status.DONE,
            trainingBreathinessStatus: Status.DONE,
          }
        }
      });
      cronService.scheduleStatusTransition({
        schedule: getNextTimeout(TIMEOUTS.ONE_MINUTE),
        userSessionId: newSession.id,
        state: { trainingRoughnessStatus: Status.READY, trainingBreathinessStatus: Status.READY }
      })
      cronService.scheduleRememberEmail({
        schedule: getNextTimeout(TIMEOUTS.ONE_MINUTE),
        userSessionId: newSession.id,
        emailTemplate: {
          templateReferenceId: EmailTemplateReference.REMINDER,
          to: userProgress.user.email,
          data: { user: userPayload }
        },
        state: { trainingRoughnessStatus: Status.DONE, trainingBreathinessStatus: Status.DONE }
      });
    }
  }
}

function formatDate(date) {
  return {
    day: date.format('DD/MM'),
    hour: date.hour()
  };
}
