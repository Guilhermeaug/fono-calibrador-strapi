const { Features } = require("../../../constants");

const yup = require("yup");

module.exports = {
  submitAssessmentSchema: yup.object().shape({
    programId: yup.number().required(),
    startDate: yup.string().required(),
    endDate: yup.string().required(),
    audios: yup.array().of(
      yup.object().shape({
        duration: yup.number().required(),
        identifier: yup.string().required(),
        numberOfAudioClicks: yup.number().required(),
        roughness: yup.number().required(),
        breathiness: yup.number().required(),
      })
    ),
  }),
  submitTrainingSchema: yup.object().shape({
    programId: yup.number().required(),
    feature: yup.string().required().oneOf([Features.Roughness, Features.Breathiness]),
    startDate: yup.string().required(),
    endDate: yup.string().required(),
    audios: yup.array().of(
      yup.object().shape({
        duration: yup.number().required(),
        identifier: yup.string().required(),
        numberOfAttempts: yup.number().required(),
        numberOfAudioClicks: yup.number().required(),
        value: yup.number().required(),
      })
    ),
  }),
  alignProgressSchema: yup.object().shape({
    programId: yup.number().required(),
  }),
  restartSessionSchema: yup.object().shape({
    programId: yup.number().required(),
  }),
  clearTimeoutSchema: yup.object().shape({
    userId: yup.number().required(),
  }),
};
