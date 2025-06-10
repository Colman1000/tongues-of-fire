/**
 * Calculates the total duration of a subtitle file in seconds.
 * It finds the last timestamp in the file and converts it to seconds.
 * @param content The string content of the .srt or .vtt file.
 * @returns The total duration in seconds.
 */
export function calculateSubtitleDuration(content: string): number {
  // Regex to find all timestamps like 00:00:00,000 or 00:00:00.000
  const timestamps = content.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/g);

  if (!timestamps || timestamps.length === 0) {
    return 0;
  }

  // The last timestamp in the file marks the end time.
  const lastTimestamp = timestamps[timestamps.length - 1];
  const parts = lastTimestamp.split(/[:,.]/);

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2], 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Calculates the credits used based on subtitle duration.
 * The rule is 0.5 credits for every 15-minute block (or part thereof).
 * @param durationInSeconds The duration of the subtitle file.
 * @returns The number of credits used.
 */
export function calculateCredits(durationInSeconds: number): number {
  if (durationInSeconds <= 0) {
    return 0;
  }
  const minutesInBlock = 15;
  const secondsInBlock = minutesInBlock * 60; // 900 seconds

  // Calculate how many 15-minute blocks are needed.
  // Math.ceil ensures that even 1 second into a new block counts as a full block.
  const blocks = Math.ceil(durationInSeconds / secondsInBlock);

  return blocks * 0.5;
}
