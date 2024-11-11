"use strict";

const dayjs = require("dayjs");
const { env } = require("@strapi/utils");

const isTesting = env.bool("IS_TESTING", false);

async function handleStatusTransition(event) {
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

  if (
    changedStatus(currentStates.roughness, nextStates.roughness, Status.READY, Status.DONE) &&
    isStatus(nextStates.breathiness, Status.WAITING)
  ) {
    setEventState(event, "1-day-cooldown");
  } else if (
    changedStatus(currentStates.breathiness, nextStates.breathiness, Status.READY, Status.DONE) &&
    isStatus(nextStates.roughness, Status.WAITING)
  ) {
    setEventState(event, "1-day-cooldown");
  } else if (Object.values(nextStates).every((status) => status === Status.DONE || status === Status.NOT_NEEDED)) {
    setEventState(event, "7-day-cooldown");
  }
}

async function handleAfterUpdate(event) {
  const { result = {} } = event;
  const userProgress = await findUserProgressBySessionId(result.id);

  if (!userProgress) return;

  const { user, program, sessions } = userProgress;
  const updatedUserProgress = {};

  const eventName = String(event.state);

  const statuses = {
    roughness: result.trainingRoughnessStatus,
    breathiness: result.trainingBreathinessStatus,
    assessment: result.assessmentStatus,
  };

  updatedUserProgress.status = Object.values(statuses).includes(Status.INVALID)
    ? Status.INVALID
    : Object.values(statuses).includes(Status.READY)
    ? Status.READY
    : Status.WAITING;

  switch (eventName) {
    case "1-day-cooldown":
      await handleOneDayCooldown({
        updatedUserProgress,
        user,
      });
      break;
    case "7-day-cooldown":
      await handleSevenDayCooldown({
        updatedUserProgress,
        user,
        program,
        sessions,
      });
      break;
  }

  if (Object.keys(updatedUserProgress).length > 0) {
    const { newSessionId, ...data } = updatedUserProgress;
    await strapi.entityService.update("api::user-progress.user-progress", userProgress.id, {
      data: {
        ...data,
        sessions: {
          connect: [newSessionId],
        },
      },
    });
  }
}

async function handleOneDayCooldown({ updatedUserProgress, user }) {
  strapi.log.info("AfterUpdate - 1 day cooldown");

  const emailService = strapi.services["api::email.email"];

  const dueDate = isTesting
    ? getNextTimeout(TIMEOUTS.THIRTY_MINUTES).toISOString()
    : getNextTimeout(TIMEOUTS.TWO_DAYS_ROUNDED).toISOString();
  const reminderDate = isTesting
    ? getNextTimeout(TIMEOUTS.ONE_MINUTE).toISOString()
    : getNextTimeout(TIMEOUTS.ONE_DAY).toISOString();

  updatedUserProgress.nextDueDate = dueDate;
  updatedUserProgress.timeoutEndDate = reminderDate;

  const {
    email,
    additionalData: { name },
  } = user;

  emailService.sendEmailTemplate(email, EmailTemplateReference.ONE_DAY_COOLDOWN, {
    user: { name },
    startDate: formatEmailDate(dayjs().add(1, "day")),
    endDate: formatEmailDate(dayjs().add(2, "day").add(1, "hour")),
  });

  await scheduleEmailToQueue({
    to: email,
    scheduledTime: reminderDate,
    templateReferenceId: EmailTemplateReference.REMINDER,
    templateData: { user: { name } },
  });
}

async function handleSevenDayCooldown({ updatedUserProgress, user, program, sessions }) {
  strapi.log.info("AfterUpdate - 7 day cooldown");

  const emailService = strapi.services["api::email.email"];

  const { numberOfSessions } = program;
  const {
    email,
    additionalData: { name },
  } = user;
  const sessionsLength = sessions.length;

  if (numberOfSessions === sessionsLength) {
    strapi.log.info("Program Done");

    updatedUserProgress.status = Status.DONE;
    updatedUserProgress.nextDueDate = null;
    updatedUserProgress.timeoutEndDate = null;
    await strapi.entityService.update("plugin::users-permissions.user", user.id, {
      data: {
        finalPacStatus: "READY",
      },
    });
    emailService.sendEmailTemplate(email, EmailTemplateReference.PROGRAM_COMPLETED, {
      user: { name },
    });

    return;
  }

  strapi.log.info("Program Continues");

  const dueDate = isTesting
    ? getNextTimeout(TIMEOUTS.THIRTY_MINUTES).toISOString()
    : getNextTimeout(TIMEOUTS.EIGHT_DAYS_ROUNDED).toISOString();
  const reminderDate = isTesting
    ? getNextTimeout(TIMEOUTS.ONE_MINUTE).toISOString()
    : getNextTimeout(TIMEOUTS.SEVEN_DAYS).toISOString();

  updatedUserProgress.nextDueDate = dueDate;
  updatedUserProgress.timeoutEndDate = reminderDate;

  const isAssessmentNeeded = (sessionsLength + 1) % 3 === 0;
  const newSessionAssessmentStatus = isAssessmentNeeded ? Status.WAITING : Status.NOT_NEEDED;
  const newSession = await strapi.entityService.create("api::user-session-progress.user-session-progress", {
    data: { assessmentStatus: newSessionAssessmentStatus },
  });
  updatedUserProgress.newSessionId = newSession.id;

  emailService.sendEmailTemplate(email, EmailTemplateReference.SEVEN_DAY_COOLDOWN, {
    user: { name },
    startDate: formatEmailDate(dayjs().add(7, "day")),
    endDate: formatEmailDate(dayjs().add(8, "day").add(1, "hour")),
  });

  await scheduleEmailToQueue({
    to: email,
    scheduledTime: reminderDate,
    templateReferenceId: EmailTemplateReference.REMINDER,
    templateData: { user: { name } },
  });
}

async function scheduleEmailToQueue({ to, scheduledTime, templateReferenceId, templateData }) {
  return strapi.entityService.create("api::email-queue.email-queue", {
    data: {
      to,
      scheduledTime,
      templateReferenceId,
      data: templateData,
    },
  });
}

const Status = {
  DONE: "DONE",
  READY: "READY",
  WAITING: "WAITING",
  NOT_NEEDED: "NOT_NEEDED",
  INVALID: "INVALID",
};

const TIMEOUTS = {
  ONE_DAY: { days: 1, hours: 0 },
  ONE_DAY_ROUNDED: { days: 1, hours: 1 },
  TWO_DAYS: { days: 2, hours: 0 },
  TWO_DAYS_ROUNDED: { days: 2, hours: 1 },
  SEVEN_DAYS: { days: 7, hours: 0 },
  SEVEN_DAYS_ROUNDED: { days: 7, hours: 1 },
  EIGHT_DAYS: { days: 8, hours: 0 },
  EIGHT_DAYS_ROUNDED: { days: 8, hours: 1 },
  // Testing timeouts
  ONE_MINUTE: { minutes: 1 },
  FIVE_MINUTES: { minutes: 5 },
  TEN_MINUTES: { minutes: 10 },
  FIFTEEN_MINUTES: { minutes: 15 },
  THIRTY_MINUTES: { minutes: 30 },
};

const EmailTemplateReference = {
  PROGRAM_COMPLETED: 4,
  ONE_DAY_COOLDOWN: 2,
  SEVEN_DAY_COOLDOWN: 3,
  REMINDER: 5,
};

const isStatus = (status, expected) => status === expected;

const changedStatus = (current, next, from, to) => current === from && next === to;

function getNextTimeout(timeout) {
  const { days = 0, hours = 0, minutes = 0 } = timeout;
  const date = dayjs().add(days, "day").add(hours, "hour").add(minutes, "minute");
  return isTesting ? date : date.startOf("hour");
}

const setEventState = (event, state) => {
  event.state = state;
};

function formatEmailDate(date) {
  return {
    day: date.format("DD/MM"),
    hour: date.hour(),
  };
}

async function findUserProgressBySessionId(sessionId) {
  try {
    return strapi.db.query("api::user-progress.user-progress").findOne({
      populate: {
        sessions: true,
        program: true,
        user: { populate: { additionalData: true } },
      },
      where: { sessions: { $in: [sessionId] } },
    });
  } catch (error) {
    console.error("Error fetching user progress in lifycicle hook:", error);
    return null;
  }
}

module.exports = {
  async beforeUpdate(event) {
    await handleStatusTransition(event);
  },
  async afterUpdate(event) {
    await handleAfterUpdate(event);
  },
};
