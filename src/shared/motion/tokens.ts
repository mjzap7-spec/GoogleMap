/** Keep animation timings together so motion can be tuned without editing screens. */
export const motion = {
  pageEnterDuration: 120,
  pageExitDuration: 0,
  nativePageDuration: 120,
  chatEnterDuration: 160,
  messageEnterDuration: 150,
  buttonDuration: 70,
  buttonReleaseDuration: 130,
  buttonPressedScale: 0.985,
  feedbackEnterDuration: 100,
  feedbackExitDuration: 130,
} as const;
