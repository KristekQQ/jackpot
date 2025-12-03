document.addEventListener("DOMContentLoaded", async () => {
  try {
    const player = await window.jackpotReady;
    if (!player) return;

    while (true) {
      if (player.animations.has("JACKPOT_BEGIN")) await player.play("JACKPOT_BEGIN");
      if (player.animations.has("PRIZE_BEGIN")) await player.play("PRIZE_BEGIN");
      if (player.animations.has("PRIZE_STOP")) await player.play("PRIZE_STOP");
      if (player.animations.has("PRIZE_COUNTDOWN")) await player.play("PRIZE_COUNTDOWN");
      if (player.animations.has("PRIZE_COUNTDOWN_END")) await player.play("PRIZE_COUNTDOWN_END");
      if (player.animations.has("JACKPOT_END")) await player.play("JACKPOT_END");
    }
  } catch (e) {
    console.error(e);
  }
});
