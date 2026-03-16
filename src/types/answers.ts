/** User answer options and their score mappings */
export const ANSWER_SCORES = {
  strongly_agree: 2,
  agree: 1,
  neutral: 0,
  disagree: -1,
  strongly_disagree: -2,
  not_interested: null,
} as const;

export type AnswerOption = keyof typeof ANSWER_SCORES;
