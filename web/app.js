document.addEventListener("DOMContentLoaded", async () => {
    try {
        // Path to the animation JSON (change here if you want a different animation)

        // const jsonPath = "../res/exportJosn/jackpot.json";
        //
        // const player = await main(jsonPath);
        // if (!player) return;
        //
        // while (true) {
        //   if (player.animations.has("JACKPOT_BEGIN")) await player.play("JACKPOT_BEGIN");
        //   if (player.animations.has("PRIZE_BEGIN")) await player.play("PRIZE_BEGIN");
        //   if (player.animations.has("PRIZE_STOP")) await player.play("PRIZE_STOP");
        //   if (player.animations.has("PRIZE_COUNTDOWN")) await player.play("PRIZE_COUNTDOWN");
        //   if (player.animations.has("PRIZE_COUNTDOWN_END")) await player.play("PRIZE_COUNTDOWN_END");
        //   if (player.animations.has("JACKPOT_END")) await player.play("JACKPOT_END");
        // }


        const jsonPath = "../res/Bliss/common/bigwinAnim.json";
        const player = await main(jsonPath);
        if (!player) return;
        while (true) {
            await player.play("PRICE_SHOW")
            await player.play("PRICE_START")
            await player.play("PRICE_STOP")
        }
    } catch (e) {
        console.error(e);
    }
});
