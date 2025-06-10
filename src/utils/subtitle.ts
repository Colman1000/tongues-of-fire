/**
 * Calculates the total duration of a subtitle file in seconds.
 * It finds the last timestamp in the file and converts it to seconds.
 * @param content The string content of the .srt or .vtt file.
 * @returns The total duration in seconds.
 */
export function calculateSubtitleDuration(content: string): number {
  const timestamps = content.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/g);

  if (!timestamps || timestamps.length === 0) {
    return 0;
  }

  const lastTimestamp = timestamps[timestamps.length - 1];
  const parts = lastTimestamp.split(/[:,.]/);

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2], 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Calculates the credits used based on subtitle duration.
 * The rule is configurable via environment variables.
 * @param durationInSeconds The duration of the subtitle file.
 * @returns The number of credits used.
 */
export function calculateCredits(durationInSeconds: number): number {
  if (durationInSeconds <= 0) {
    return 0;
  }

  // Read configuration from environment variables
  const costPerBlock = parseFloat(process.env.CREDIT_COST_PER_BLOCK!);
  const blockDurationMinutes = parseInt(
    process.env.CREDIT_BLOCK_DURATION_MINUTES!,
    10,
  );
  const secondsInBlock = blockDurationMinutes * 60;

  if (secondsInBlock <= 0) {
    return 0; // Avoid division by zero if config is invalid
  }

  const blocks = Math.ceil(durationInSeconds / secondsInBlock);

  return blocks * costPerBlock;
}
