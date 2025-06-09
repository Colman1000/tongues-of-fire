/**
 * Converts SRT subtitle format to VTT format.
 * @param srtContent The content of the .srt file.
 * @returns The content in .vtt format.
 */
export function srtToVtt(srtContent: string): string {
  let vtt = "WEBVTT\n\n";
  vtt += srtContent
    .replace(/\r/g, "")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2") // Convert timestamp comma to period
    .split("\n\n")
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      // Remove the numeric SRT counter
      return lines.length > 1 && lines[1].includes("-->")
        ? lines.slice(1).join("\n")
        : block;
    })
    .join("\n\n");
  return vtt;
}

/**
 * Converts VTT subtitle format to SRT format.
 * @param vttContent The content of the .vtt file.
 * @returns The content in .srt format.
 */
export function vttToSrt(vttContent: string): string {
  let srt = "";
  const blocks = vttContent
    .replace(/\r/g, "")
    .replace("WEBVTT", "")
    .trim()
    .split("\n\n");

  let counter = 1;
  for (const block of blocks) {
    if (!block.trim()) continue;
    const lines = block.split("\n");
    const timeLineIndex = lines.findIndex((line) => line.includes("-->"));

    if (timeLineIndex !== -1) {
      srt += `${counter++}\n`;
      // Convert timestamp period to comma
      srt +=
        lines[timeLineIndex].replace(/(\d{2}:\d{2}:\d{2})\.(\d{3})/g, "$1,$2") +
        "\n";
      srt += lines.slice(timeLineIndex + 1).join("\n") + "\n\n";
    }
  }
  return srt.trim();
}
