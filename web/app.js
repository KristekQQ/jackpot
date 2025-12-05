document.addEventListener("DOMContentLoaded", async () => {
    try {
        // Path to the animation JSON (change here if you want a different animation)

        const jsonPath = "../res/exportJosn/jackpot.json";

        const player = await main(jsonPath);
        if (!player) return;
        player.playNested("display_bg", "UNIVERZAL", "NoLoopAction");
        // player.setLabel("price", {
        //     text: "124.4",
        //     color: "#360000",
        //     fontSize: 64,          // nebo "64px"
        //     fontWeight: 300,       // lehčí váha
        //     fontFamily: "Roboto",  // nebo vlastní název
        //     letterSpacing: "0.08em",
        //     textShadow: "0 18px 22px rgba(0,0,0,0.35)"
        // });
        player.setLabel("price", {
            text: "124.4"});
        while (true) {

            // player.setText("price", "124.4");
          if (player.animations.has("JACKPOT_BEGIN")) await player.play("JACKPOT_BEGIN");
            // player.playNested("display_bg", "GOLD", "NoLoopAction")
          if (player.animations.has("PRIZE_BEGIN")) await player.play("PRIZE_BEGIN")
            player.playNested("display_bg", "GOLD", "NoLoopAction")
          if (player.animations.has("PRIZE_STOP")) await player.play("PRIZE_STOP");
            player.playNested("display_bg", "BRONZE", "NoLoopAction")
          if (player.animations.has("PRIZE_COUNTDOWN")) await player.play("PRIZE_COUNTDOWN");
            player.playNested("display_bg", "SILVER", "NoLoopAction")
          if (player.animations.has("PRIZE_COUNTDOWN_END")) await player.play("PRIZE_COUNTDOWN_END");
          if (player.animations.has("JACKPOT_END")) await player.play("JACKPOT_END");
        }


        // const jsonPath = "../res/Bliss/common/bigwinAnim.json";
        // const player = await main(jsonPath);
        // if (!player) return;
        // while (true) {
        //     await player.play("PRICE_SHOW")
        //     await player.play("PRICE_START")
        //     await player.play("PRICE_STOP")
        // }


        // const jsonPath = "../res/freespins/freespin_anim.json";
        // const player = await main(jsonPath);
        // player.setText("numbers_txt", "12");
        // player.setText("title_txt", "asi freespin");
        // if (!player) return;
        // while (true) {
        //     await player.play("SHOW")
        //     await player.play("HIDE")
        //     // await player.play("PRICE_STOP")
        // }


        // const jsonPath = "../res/crystal/scene.json";
        // const player = await main(jsonPath);
        // if (!player) return;
        // while (true) {
        //     // await player.play("PRICE_SHOW")
        //     // await player.play("PRICE_START")
        //     // await player.play("PRICE_STOP")
        // }
    } catch (e) {
        console.error(e);
    }
});
